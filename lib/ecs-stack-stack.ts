import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as iam from 'aws-cdk-lib/aws-iam';


export class EcsStackStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
    });

    const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true
    });
    
    // Change to fargate
    const ecsCluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      containerInsights: true
    });

    

    // Create a load-balanced Fargate service and make it public
    new ecs_patterns.ApplicationLoadBalancedFargateService(this, "MyFargateService", {
      cluster: ecsCluster, // Required
      cpu: 256, // Default is 256
      desiredCount: 1, // Default is 1
      taskImageOptions: { 
        containerPort: 8080,
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample") 
      },
      memoryLimitMiB: 512, // Default is 512
      publicLoadBalancer: false
    });
    
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
    
    taskDefinition.addContainer('DefaultContainer', {
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      portMappings: [
        {
          containerPort: 8080,
          hostPort: 8080
        }
      ],
      memoryLimitMiB: 512,
    });
    
    // Instantiate an Amazon ECS Service
    const ecsService = new ecs.Ec2Service(this, 'Service', {
      cluster: ecsCluster,
      taskDefinition,
    });

    const rdsCluster = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_08_1 }),
      credentials: rds.Credentials.fromGeneratedSecret('admin'), // Optional - will default to 'admin' username and generated password
      defaultDatabaseName: 'db',
      instances: 1,
      instanceProps: {
        // optional , defaults to t3.medium
        
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        },
        vpc,
      },
    });

    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['ses:SendEmail'],
    }))
    
    // Add a listener and open up the load balancer's security group
    // to the world.
    const listener = lb.addListener('Listener', {
      port: 80,
    
      // 'open: true' is the default, you can leave it out if you want. Set it
      // to 'false' and use `listener.connections` if you want to be selective
      // about who can access the load balancer.
      open: true,
    });
    
    // Create an AutoScaling group and add it as a load balancing
    // target to the listener.
    listener.addTargets('ApplicationFleet', {
      port: 8080,
      targets: [ecsService]
    });
  }
}
