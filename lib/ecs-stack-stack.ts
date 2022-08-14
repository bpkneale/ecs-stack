import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export class EcsStackStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 2
    });
    
    const ecsCluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      containerInsights: true
    });

    const ecrRepo = ecr.Repository.fromRepositoryName(this, 'ECR', "ecs-stack")

    // Create a load-balanced Fargate service and make it public
    const fargate = new ecs_patterns.ApplicationLoadBalancedFargateService(this, "MyFargateService", {
      cluster: ecsCluster, // Required
      cpu: 256, // Default is 256
      desiredCount: 1, // Default is 1
      taskImageOptions: { 
        containerPort: 8000,
        image: ecs.ContainerImage.fromEcrRepository(ecrRepo),
      },
      memoryLimitMiB: 512, // Default is 512
      publicLoadBalancer: true,
    });

    const taskDefinition = fargate.service.taskDefinition;
    
    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['ses:SendEmail'],
    }))
    ecrRepo.grantPull(taskDefinition.taskRole);

    // const rdsCluster = new rds.DatabaseCluster(this, 'Database', {
    //   engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_08_1 }),
    //   credentials: rds.Credentials.fromGeneratedSecret('admin'), // Optional - will default to 'admin' username and generated password
    //   defaultDatabaseName: 'db',
    //   instances: 1,
    //   instanceProps: {
    //     // optional , defaults to t3.medium
        
    //     instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
    //     vpcSubnets: {
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
    //     },
    //     vpc,
    //   },
    // });
    
  }
}
