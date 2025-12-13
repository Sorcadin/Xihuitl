# Xihuitl Discord Bot

A Discord bot with timezone management and virtual pet game features.

## Features

### 🕐 Time Commands
Help your Discord community coordinate across timezones:
- **`/time set location`** - Set your timezone by location name (e.g., "Tokyo", "New York")
- **`/time get user`** - Check what time it is for any user
- **`/time get location`** - Check current time in any location
- **`/time all`** - View everyone's local times grouped by timezone
- **Auto-mention replies** - Bot automatically responds with time when users are mentioned (2-hour cooldown)

### 🐾 Pet System
Adopt and care for virtual pets:
- **`/pet adopt`** - Interactive pet adoption with species browsing
- **`/pet info`** - View your pet's status, hunger level, and age
- **`/pet feed`** - Feed your pet to restore hunger (autocomplete search)
- **`/pet rename`** - Give your pet a new name
- **`/pet bag`** - Manage your inventory (50 item capacity)
- **`/pet storage`** - Access unlimited storage space
- **`/pet daily`** - Claim daily food rewards (20-hour cooldown)

**Pet Features:**
- 6 unique species with different types (beast, plant, insect, construct)
- Hunger system that decays over time
- Item system with food and inventory management
- Daily reward system with cooldowns

## Quick Start

### For New Deployments

See **[CDK_SETUP.md](CDK_SETUP.md)** for complete infrastructure deployment guide.

### For Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally (requires AWS credentials)
npm run dev

# Deploy to production
make deploy
```

## Available Commands

### Makefile Commands

```bash
# Development
make build              # Compile TypeScript to JavaScript
make clean              # Remove compiled files

# Deployment
make deploy             # Build and deploy bot to EC2
make deploy.commands    # Register slash commands with Discord

# Infrastructure (AWS CDK)
make infra.synth        # Generate CloudFormation template
make infra.deploy       # Deploy infrastructure to AWS
make infra.diff         # Preview infrastructure changes
make infra.destroy      # Destroy infrastructure (with safety delay)
```

### NPM Scripts

```bash
npm run build           # Compile TypeScript
npm run dev             # Run bot locally with ts-node
npm start               # Run compiled bot from dist/

# CDK commands
npm run cdk:synth       # Synthesize CloudFormation
npm run cdk:deploy      # Deploy infrastructure
npm run cdk:diff        # Show changes
npm run cdk:destroy     # Destroy stack
```

## Project Structure

```
Xihuitl/
├── src/
│   ├── pet/
│   │   ├── commands/         # Pet slash command handlers
│   │   ├── services/         # Pet, inventory, daily reward services
│   │   └── constants/        # Pet species and item definitions
│   ├── time/
│   │   ├── commands/         # Time slash command handlers
│   │   └── services/         # Timezone and geocoding services
│   ├── services/             # Shared AWS services (DynamoDB, S3)
│   └── index.ts              # Bot entry point
├── infra/
│   └── lib/xiuh-stack.ts     # AWS CDK infrastructure definition
├── assets/                   # Pet species images (deployed to S3)
├── dist/                     # Compiled JavaScript (gitignored)
└── CDK_SETUP.md              # Infrastructure deployment guide
```

## Infrastructure Overview

The bot runs on AWS with a cost-optimized setup:

- **EC2 t4g.micro** (ARM64 Graviton) - Runs the bot 24/7
- **DynamoDB** (on-demand) - Two tables:
  - `xiuh-time` - User timezone preferences (simple key-value)
  - `xiuh-pets` - Pet system (single-table design with PK/SK)
- **S3 Bucket** - Pet species images (private, presigned URLs)
- **IAM Role** - Scoped permissions for DynamoDB read/write and S3 read
- **Security Group** - SSH access for deployment

**Cost**: Free for first 12 months, then ~$6-8/month

See [CDK_SETUP.md](CDK_SETUP.md) for detailed infrastructure setup and deployment.

## Monitoring & Debugging

### Check Bot Status

```bash
# SSH into EC2 instance
ssh -i ~/.ssh/xiuh-bot-key.pem ec2-user@YOUR_EC2_IP

# Check service status
sudo systemctl status xiuh-bot

# View live logs
sudo journalctl -u xiuh-bot -f

# Restart bot
sudo systemctl restart xiuh-bot
```

### Check AWS Resources

```bash
# List DynamoDB tables
aws dynamodb list-tables

# View S3 bucket contents
aws s3 ls s3://xiuh-pet-images/

# Check CloudFormation stack
aws cloudformation describe-stacks --stack-name XiuhStack
```

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Discord.js v14 (optimized caching)
- **Cloud**: AWS (EC2, DynamoDB, S3)
- **Infrastructure**: AWS CDK
- **APIs**: Google Geocoding & Timezone APIs (optional)
