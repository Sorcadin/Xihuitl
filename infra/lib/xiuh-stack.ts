import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

/**
 * Xihuitl Discord Bot Stack
 * 
 * This stack provisions all infrastructure for the Xihuitl Discord timezone bot:
 * - EC2 instance (t3.micro) for running the bot
 * - DynamoDB table for storing user timezone preferences
 * - IAM roles for EC2 with appropriate permissions
 * - Security groups for SSH access
 * - SSM parameters for configuration management
 */
export class XiuhStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // DynamoDB Table for Timezones
    // ========================================
    const timezoneTable = new dynamodb.Table(this, 'UserTimezonesTable', {
      tableName: 'xiuh-time',
      partitionKey: {
        name: 'user_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing (free tier friendly)
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Don't delete user data when stack is destroyed
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false, // Disable to stay within free tier
      },
    });

    // ========================================
    // DynamoDB Table for Pets
    // ========================================
    const petsTable = new dynamodb.Table(this, 'PetsTable', {
      tableName: 'xiuh-pets',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
    });

    // ========================================
    // S3 Bucket for Pet Images
    // ========================================
    const petImagesBucket = new s3.Bucket(this, 'PetImagesBucket', {
      bucketName: `xiuh-pet-images`,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [{
        transitions: [{
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(0),  // Immediate
        }],    
      }]
    });

    // ========================================
    // SSM Parameters for Configuration
    // ========================================

    // Reference to existing parameters that user must create manually:
    // - /xiuh/ec2-keypair-name: Name of EC2 key pair for SSH access
    // - /xiuh/discord-token: Discord bot token (SecureString)
    const keypairNameParam = ssm.StringParameter.fromStringParameterName(
      this,
      'KeypairNameParam',
      '/xiuh/ec2-keypair-name'
    );
    
    // Reference the key pair for EC2 instance
    const keyPair = ec2.KeyPair.fromKeyPairName(
      this,
      'BotKeyPair',
      keypairNameParam.stringValue
    );

    // ========================================
    // VPC - Use default VPC (free tier)
    // ========================================
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
      isDefault: true,
    });

    // ========================================
    // Security Group for EC2 Instance
    // ========================================
    const sshIp = process.env.SSH_DEPLOY_IP;
    if (!sshIp) {
        throw new Error('SSH_DEPLOY_IP environment variable is required to deploy infrastructure. Please check your .env file.');
    }
  
    const botSecurityGroup = new ec2.SecurityGroup(this, 'BotSecurityGroup', {
      vpc,
      securityGroupName: 'xiuh-bot-sg',
      description: 'Security group for Xihuitl Discord bot EC2 instance',
      allowAllOutbound: true,
    });

    botSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(sshIp), 
      ec2.Port.tcp(22),
      'Allow SSH access from deployment machine only'
    );

    // ========================================
    // IAM Role for EC2 Instance
    // ========================================
    const botRole = new iam.Role(this, 'BotRole', {
      roleName: 'xiuh-bot-role',
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM role for Xihuitl Discord bot EC2 instance',
      managedPolicies: [
        // SSM Session Manager (optional, for SSH alternative)
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // Grant DynamoDB permissions
    timezoneTable.grantReadWriteData(botRole);
    petsTable.grantReadWriteData(botRole);

    // Grant S3 read permissions for pet images
    petImagesBucket.grantRead(botRole);

    // Grant SSM Parameter Store read permissions
    botRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ssm:GetParameter',
          'ssm:GetParameters',
          'ssm:GetParametersByPath',
        ],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/xiuh/*`,
        ],
      })
    );

    // ========================================
    // EC2 Instance for Discord Bot
    // ========================================
    
    // Get latest Amazon Linux 2023 AMI for ARM64 (Graviton)
    const amznLinux2023 = ec2.MachineImage.latestAmazonLinux2023({
      cpuType: ec2.AmazonLinuxCpuType.ARM_64,
    });

    // UserData script - Handles bootstrap.sh functionality
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -euo pipefail',
      '',
      '# Update system',
      'dnf update -y',
      '',
      '# Install Node.js (latest LTS available on AL2023)',
      'dnf install -y nodejs npm',
      '',
      '# Verify Node.js installation',
      'node --version',
      'npm --version',
      '',
      '# Create application directory',
      'mkdir -p /home/ec2-user/xiuh-bot',
      'chown ec2-user:ec2-user /home/ec2-user/xiuh-bot',
      '',
      '# Create systemd service file',
      'cat > /etc/systemd/system/xiuh-bot.service <<EOF',
      '[Unit]',
      'Description=Xihuitl Discord Timezone Bot',
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      'User=ec2-user',
      'WorkingDirectory=/home/ec2-user/xiuh-bot',
      'EnvironmentFile=/home/ec2-user/xiuh-bot/.env',
      'ExecStart=/usr/bin/node /home/ec2-user/xiuh-bot/dist/index.js',
      'Restart=on-failure',
      'RestartSec=10',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      '',
      '# Enable systemd service (will start after first deployment)',
      'systemctl daemon-reload',
      'systemctl enable xiuh-bot',
      '',
      '# Signal completion',
      'echo "Bootstrap complete at $(date)" > /var/log/xiuh-bootstrap.log',
    );

    const botInstance = new ec2.Instance(this, 'BotInstance', {
      instanceName: 'xiuh-bot',
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,  // Graviton2 (ARM64)
        ec2.InstanceSize.MICRO
      ),
      machineImage: amznLinux2023,
      securityGroup: botSecurityGroup,
      role: botRole,
      keyPair: keyPair,
      userData: userData,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    // ========================================
    // S3 Bucket Deployment
    // ========================================
    new s3deploy.BucketDeployment(this, 'DeployPetImages', {
      destinationBucket: petImagesBucket, 
      sources: [s3deploy.Source.asset('./assets')],
      prune: true, 
    });

    // ========================================
    // Stack Outputs
    // ========================================
    new cdk.CfnOutput(this, 'InstanceId', {
      value: botInstance.instanceId,
      description: 'EC2 Instance ID',
      exportName: 'XiuhBotInstanceId',
    });

    new cdk.CfnOutput(this, 'InstancePublicIp', {
      value: botInstance.instancePublicIp,
      description: 'EC2 Instance Public IP (use this for EC2_HOST in .env)',
      exportName: 'XiuhBotPublicIp',
    });

    new cdk.CfnOutput(this, 'InstancePublicDnsName', {
      value: botInstance.instancePublicDnsName,
      description: 'EC2 Instance Public DNS Name',
      exportName: 'XiuhBotPublicDns',
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: timezoneTable.tableName,
      description: 'DynamoDB Table Name for timezones',
      exportName: 'XiuhUserTimezonesTable',
    });

    new cdk.CfnOutput(this, 'PetsTableName', {
      value: petsTable.tableName,
      description: 'DynamoDB Table Name for pets',
      exportName: 'XiuhPetsTable',
    });

    new cdk.CfnOutput(this, 'PetImagesBucketName', {
      value: petImagesBucket.bucketName,
      description: 'S3 Bucket Name for pet images',
      exportName: 'XiuhPetImagesBucket',
    });

    new cdk.CfnOutput(this, 'BotRoleArn', {
      value: botRole.roleArn,
      description: 'IAM Role ARN for the bot EC2 instance',
      exportName: 'XiuhBotRoleArn',
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: botSecurityGroup.securityGroupId,
      description: 'Security Group ID for the bot instance',
      exportName: 'XiuhBotSecurityGroupId',
    });
  }
}
