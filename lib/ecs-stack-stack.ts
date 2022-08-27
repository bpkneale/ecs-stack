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
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { ClientStackConfig } from '../config/config';

type EcsStackProps = StackProps & {
  config: ClientStackConfig
}

export class EcsStackStack extends Stack {
  _props: EcsStackProps;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    this._props = props;
    const config = props.config;

    const vpc = new ec2.Vpc(this, this.resourceName('vpc'), {
      cidr: '10.0.0.0/16',
      maxAzs: 2
    });

    const secret = new secretsmanager.Secret(this, this.resourceName('rdsSecret'), {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'mysql' }),
        generateStringKey: 'password',
        excludeCharacters: "% +~`#$&*()|[]{}:;<>?!'/@\"\\"
      },
    });

    const rdsCluster = new rds.DatabaseCluster(this, this.resourceName('mysql'), {
      engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_2_10_2 }),
      credentials: {
        username: 'admin',
        password: secret.secretValueFromJson('password')
      },
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
    
    const ecsCluster = new ecs.Cluster(this, this.resourceName('cluster'), {
      vpc,
      containerInsights: true
    });

    const ecrRepo = ecr.Repository.fromRepositoryName(this, this.resourceName('ecr'), config.apiRepo)

    // Create a load-balanced Fargate service and make it public
    const fargate = new ecs_patterns.ApplicationLoadBalancedFargateService(this, this.resourceName('fargate'), {
      cluster: ecsCluster, // Required
      cpu: 256, // Default is 256
      desiredCount: 1, // Default is 1
      taskImageOptions: { 
        containerPort: 8000,
        image: ecs.ContainerImage.fromEcrRepository(ecrRepo),
        secrets: {
          // This pulls the secret at container startup and sets it as an env var
          'MYSQL_PASSWORD': ecs.Secret.fromSecretsManager(secret)
        }
      },
      memoryLimitMiB: 512, // Default is 512
      publicLoadBalancer: true,
    });

    const taskDefinition = fargate.service.taskDefinition;
    
    // Add email sending ability to ECS task
    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      resources: ['*'],
      actions: ['ses:SendEmail'],
    }))

    // Allow pulling of image from ECR repo
    ecrRepo.grantPull(taskDefinition.taskRole);
    
    // Allow fargate to read secret
    secret.grantRead(taskDefinition.taskRole);
  }

  private resourceName(resource: string) {
    return `${this._props.config.env}-${this._props.config.client}-${resource}`
  }
}
