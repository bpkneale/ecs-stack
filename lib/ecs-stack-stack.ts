import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as ecs from 'aws-cdk-lib/aws-ecs';

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
    
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      capacity: {
        instanceType: new ec2.InstanceType("t2.micro")
      }
    });
    
    // Add capacity to it
    // cluster.addCapacity('DefaultAutoScalingGroupCapacity', {
    //   instanceType: new ec2.InstanceType("t2.xlarge"),
    //   desiredCapacity: 3,
    // });
    
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
    
    taskDefinition.addContainer('DefaultContainer', {
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      portMappings: [
        {
          containerPort: 5000,
          hostPort: 5000
        }
      ],
      memoryLimitMiB: 512,
    });
    
    // Instantiate an Amazon ECS Service
    const ecsService = new ecs.Ec2Service(this, 'Service', {
      cluster,
      taskDefinition,
    });
    
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
