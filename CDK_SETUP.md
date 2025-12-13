# AWS CDK Infrastructure Setup Guide

This guide walks you through deploying the Xihuitl Discord bot infrastructure to AWS using CDK.

**Purpose**: Set up production infrastructure (EC2, DynamoDB, S3) to run the bot 24/7 on AWS.

## Prerequisites

### 1. Install AWS CLI
```bash
# macOS
brew install awscli

# Or download from: https://aws.amazon.com/cli/
```

### 2. Install AWS CDK CLI
```bash
npm install -g aws-cdk
```

### 3. Configure AWS Credentials

```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key  
- Default region: `us-east-1`
- Default output format: `json`

### 4. Verify Your Setup

```bash
aws sts get-caller-identity
cdk --version
```

## Initial Setup

### Step 1: Bootstrap CDK in Your AWS Account

This is a one-time setup per AWS account/region:

```bash
cdk bootstrap aws://ACCOUNT-NUMBER/us-east-2
```

Replace `ACCOUNT-NUMBER` with your AWS account ID (from `aws sts get-caller-identity`).

### Step 2: Create Required SSM Parameters

Before deploying infrastructure, you need to create three SSM parameters:

#### a) EC2 Key Pair Name

First, create an EC2 key pair if you don't have one:

```bash
# Create a new key pair
aws ec2 create-key-pair \
  --key-name xiuh-bot-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/xiuh-bot-key.pem

# Set proper permissions
chmod 400 ~/.ssh/xiuh-bot-key.pem

# Verify key pair was created
aws ec2 describe-key-pairs --key-names xiuh-bot-key
```

Then store the key pair name in SSM:

```bash
aws ssm put-parameter \
  --name "/xiuh/ec2-keypair-name" \
  --value "xiuh-bot-key" \
  --type "String" \
  --description "EC2 key pair name for Xihuitl bot"
```

#### b) Discord Bot Token

Store your Discord bot token as a SecureString:

```bash
aws ssm put-parameter \
  --name "/xiuh/discord-token" \
  --value "YOUR_DISCORD_BOT_TOKEN_HERE" \
  --type "SecureString" \
  --description "Discord bot token for Xihuitl"
```

**Important**: Replace `YOUR_DISCORD_BOT_TOKEN_HERE` with your actual Discord bot token.

#### c) Google API Key (Optional)

For `/time set location:CityName` to work, you need a Google API key:

```bash
aws ssm put-parameter \
  --name "/xiuh/google-api-key" \
  --value "YOUR_GOOGLE_API_KEY_HERE" \
  --type "SecureString" \
  --description "Google API key for Geocoding and Timezone APIs"
```

**How to get a Google API key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or use an existing one
3. Enable "Geocoding API" and "Time Zone API"
4. Create credentials → API key
5. Restrict the API key to only these two APIs for security

**Note**: This is optional. If not provided, the `/time set location` feature won't work, but users can still use `/time get user`.

#### d) Verify Parameters

```bash
# Verify parameters were created
aws ssm get-parameters-by-path --path "/xiuh"

# Or check individual parameters
aws ssm get-parameter --name "/xiuh/ec2-keypair-name"
aws ssm get-parameter --name "/xiuh/discord-token" --with-decryption
aws ssm get-parameter --name "/xiuh/google-api-key" --with-decryption
```

### Step 3: Install Project Dependencies

```bash
npm install
```

### Step 4: Prepare Pet Images

Ensure you have pet species images in the `assets/` folder:

```bash
# Images should be PNG format named by species ID
assets/
  ├── vigilup.png
  ├── archino.png
  ├── anobite.png
  ├── cladily.png
  ├── hullet.png
  └── gytop.png
```

These will be automatically deployed to S3 during infrastructure deployment.

### Step 5: Deploy the Infrastructure

```bash
make infra.deploy
```

This will:
- Create two DynamoDB tables:
  - `xiuh-time` - User timezone preferences
  - `xiuh-pets` - Pet system (single-table design with PK/SK)
- Create an S3 bucket (`xiuh-pet-images`) and upload pet images
- Launch an EC2 instance (t4g.micro - ARM64 Graviton)
- Set up IAM roles with appropriate permissions
- Configure security groups
- Bootstrap the EC2 instance with Node.js and systemd service

**Note**: The deployment will show you a summary and ask for confirmation. Type `y` to proceed.

### Step 6: Save the Outputs

After deployment completes, CDK will output important information:

```
Outputs:
XiuhStack.InstancePublicIp = xxx.xxx.xxx.xxx
XiuhStack.InstancePublicDnsName = ec2-xxx-xxx-xxx-xxx.us-east-2.compute.amazonaws.com
XiuhStack.DynamoDBTableName = xiuh-time
XiuhStack.PetsTableName = xiuh-pets
XiuhStack.PetImagesBucketName = xiuh-pet-images
XiuhStack.BotRoleArn = arn:aws:iam::...
XiuhStack.SecurityGroupId = sg-...
```

**Save the InstancePublicIp** - you'll need it for deployment!

### Step 7: Update Your .env File

Create or update your `.env` file with the following:

```bash
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

# AWS Configuration
AWS_REGION=us-east-2
TIMEZONE_TABLE=xiuh-time       # Optional, defaults to xiuh-time
PETS_TABLE=xiuh-pets           # Optional, defaults to xiuh-pets
IMAGE_BUCKET=xiuh-pet-images   # Optional, defaults to xiuh-pet-images

# Google API (Optional - for time location lookups)
GOOGLE_API_KEY=your_google_api_key_here  # Optional, only needed for /time set location

# EC2 Configuration (for deployment only)
EC2_HOST=xxx.xxx.xxx.xxx  # Use the InstancePublicIp from CDK outputs
EC2_USER=ec2-user
SSH_KEY=~/.ssh/xiuh-bot-key.pem
REMOTE_DIR=/home/ec2-user/xiuh-bot
SSH_DEPLOY_IP=xxx.xxx.xxx.xxx/32  # Your IP for SSH access (for CDK deployment)
```

### Step 8: Wait for EC2 Bootstrap to Complete

The EC2 instance needs a few minutes to complete its initialization:

```bash
# Wait 2-3 minutes, then check bootstrap log
ssh -i ~/.ssh/xiuh-bot-key.pem ec2-user@$EC2_HOST \
  "cat /var/log/xiuh-bootstrap.log"

# Should show: "Bootstrap complete at [timestamp]"
```
### Step 9: Deploy the Bot Application

Now you can deploy your bot code to the EC2 instance:

```bash
make deploy
```

This will:
1. Build your TypeScript code
2. Package the application
3. Upload to EC2
4. Install dependencies
5. Restart the bot service

### Step 10: Register Discord Slash Commands

```bash
make deploy.commands
```

**🎉 Deployment Complete!** Your bot should now be running on EC2.

Check status:
```bash
ssh -i ~/.ssh/xiuh-bot-key.pem ec2-user@$EC2_HOST "sudo systemctl status xiuh-bot"
```

## Post-Deployment

### Monitoring the Bot

```bash
# SSH into your instance
ssh -i ~/.ssh/xiuh-bot-key.pem ec2-user@YOUR_EC2_IP

# View live logs
sudo journalctl -u xiuh-bot -f

# Restart if needed
sudo systemctl restart xiuh-bot
```

### Updating Bot Code

After making code changes:

```bash
make deploy
```

This builds, uploads, and restarts the bot without touching infrastructure.

### Updating Infrastructure

If you modify `infra/lib/xiuh-stack.ts`:

```bash
make infra.diff    # Preview changes
make infra.deploy  # Apply changes
```

### Destroying Infrastructure

**⚠️ WARNING**: This deletes your EC2 instance and all bot data.

```bash
make infra.destroy
```

**Note**: DynamoDB tables and S3 bucket have `RETAIN` policy and won't be auto-deleted.

To manually delete:
```bash
# Delete DynamoDB tables
aws dynamodb delete-table --table-name xiuh-time
aws dynamodb delete-table --table-name xiuh-pets

# Empty and delete S3 bucket
aws s3 rm s3://xiuh-pet-images --recursive
aws s3 rb s3://xiuh-pet-images
```

## Free Tier Considerations

This setup is designed to stay within AWS Free Tier limits:

- **EC2**: t4g.micro instance (750 hours/month free for 12 months)
- **DynamoDB**: On-demand pricing (25 GB storage free forever, 2.5M reads + 1M writes/month free)
- **S3**: 5 GB storage free (first 12 months), 20K GET requests free
- **SSM Parameter Store**: Standard parameters are free
- **Data Transfer**: First 100 GB/month outbound is free

**Important**: 
- Running the instance 24/7 = ~720 hours/month (within free tier)
- After 12 months, t4g.micro costs ~$6/month (cheaper than t3.micro!)
- DynamoDB on-demand is typically $0/month for small bots
- S3 costs ~$0.12/month for 5GB after first year
- **Total estimated cost after free tier: $6-8/month**

## Troubleshooting

### CDK Bootstrap Error

If you get a bootstrap error:
```bash
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-2
```

### SSM Parameter Not Found

Verify your parameters exist:

```bash
# List all xiuh parameters
aws ssm get-parameters-by-path --path "/xiuh"

# Check individual parameters
aws ssm get-parameter --name "/xiuh/ec2-keypair-name"
aws ssm get-parameter --name "/xiuh/discord-token" --with-decryption
```

### EC2 Instance Not Accessible

Check security group allows your IP:

```bash
# Get your current IP
curl -s ifconfig.me

# Add your current IP to security group (get sg-id from CDK outputs)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 22 \
  --cidr $(curl -s ifconfig.me)/32
```

### Bot Won't Start

SSH into the instance and check:
```bash
# Check Node.js is installed
node --version

# Check systemd service exists
systemctl list-unit-files | grep xiuh

# Check service status
sudo systemctl status xiuh-bot

# View full logs
sudo journalctl -u xiuh-bot --no-pager

# Check environment variables
cat /home/ec2-user/xiuh-bot/.env
```

### Pet Images Not Loading

Verify S3 bucket and images:
```bash
# List images in S3 bucket
aws s3 ls s3://xiuh-pet-images/

# Verify IAM permissions
aws iam get-role-policy --role-name xiuh-bot-role --policy-name [policy-name]

# Test presigned URL generation locally
# (ensure AWS credentials are configured)
```

### DynamoDB Access Issues

Check table exists and permissions:
```bash
# Verify tables exist
aws dynamodb describe-table --table-name xiuh-time
aws dynamodb describe-table --table-name xiuh-pets

# Check IAM role has permissions
aws iam list-role-policies --role-name xiuh-bot-role
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       AWS us-east-2                             │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ EC2 Instance (t4g.micro - ARM64 Graviton)                  │ │
│  │ - Amazon Linux 2023                                        │ │
│  │ - Node.js (latest LTS)                                     │ │
│  │ - Xihuitl Discord Bot                                      │ │
│  │ - systemd service                                          │ │
│  └────────┬───────────────────────────────────────────────────┘ │
│           │                                                      │
│           │ IAM Role (Read/Write)                               │
│           │                                                      │
│  ┌────────▼──────────────┐  ┌──────────────────────────────┐   │
│  │ DynamoDB Tables       │  │ S3 Bucket                    │   │
│  │                       │  │ xiuh-pet-images              │   │
│  │ xiuh-time             │  │ - Pet species images (PNG)   │   │
│  │ - PK: user_id         │  │ - Private (presigned URLs)   │   │
│  │ - timezone data       │  │ - Read-only for bot          │   │
│  │                       │  └──────────────────────────────┘   │
│  │ xiuh-pets             │                                      │
│  │ - PK: User#id         │                                      │
│  │ - SK: Profile/Pet/    │                                      │
│  │       Inventory       │                                      │
│  │ - Single-table design │                                      │
│  │ - On-demand billing   │                                      │
│  └───────────────────────┘                                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SSM Parameter Store                                      │  │
│  │ - /xiuh/discord-token      (SecureString, required)      │  │
│  │ - /xiuh/ec2-keypair-name   (String, required)            │  │
│  │ - /xiuh/google-api-key     (SecureString, optional)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## DynamoDB Table Structures

### xiuh-time (Simple Table)
```
Partition Key: user_id
No Sort Key

Example items:
{
  user_id: "123456789",
  timezone: "America/New_York",
  display_location: "New York, NY, USA"
}
```

### xiuh-pets (Single-Table Design)
```
Partition Key: PK
Sort Key: SK

Example items:
# User Profile
{
  PK: "User#123456789",
  SK: "Profile",
  activePetId: "uuid-here",
  lastDailyReward: 1234567890
}

# Pet Data
{
  PK: "User#123456789",
  SK: "Pet#uuid-here",
  name: "Fluffy",
  species: "VIGILUP",
  hunger: 80,
  lastFedAt: 1234567890,
  adoptedAt: 1234567890
}

# Inventory (Bag or Storage)
{
  PK: "User#123456789",
  SK: "Inventory#bag",
  items: {
    "apple": 5,
    "banana": 3
  }
}
```

**Benefits of Single-Table Design:**
- Atomic operations across related entities (transactions)
- Efficient queries with composite keys
- Cost-effective (one table instead of many)

## Next Steps

1. **Invite your bot to Discord**: Use the Discord Developer Portal to generate an invite URL
2. **Test commands**: Try `/time set`, `/pet adopt`, etc.
3. **Monitor logs**: `ssh` into EC2 and run `sudo journalctl -u xiuh-bot -f`
4. **Check AWS costs**: Visit AWS Billing Dashboard to ensure you're within free tier

## Useful AWS Commands

```bash
# Check EC2 instances
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress]' --output table

# Check DynamoDB tables
aws dynamodb list-tables

# View S3 bucket contents
aws s3 ls s3://xiuh-pet-images/

# Get user data (example)
aws dynamodb get-item --table-name xiuh-pets \
  --key '{"PK": {"S": "User#123456789"}, "SK": {"S": "Profile"}}'

# Check CloudFormation stack
aws cloudformation describe-stacks --stack-name XiuhStack
```
