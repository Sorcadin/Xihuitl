#!/bin/bash
set -euo pipefail

if [ ! -f ".env" ]; then
    echo "❌ .env file missing!"
    exit 1
fi

# Load .env so we can reuse the same connection details as the Makefile
set -a
source .env
set +a

EC2_HOST="${EC2_HOST:-}"
SSH_KEY="${SSH_KEY:-./my-key.pem}"

if [ -z "$EC2_HOST" ]; then
    echo "❌ EC2_HOST is not set in .env"
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH Key file not found at $SSH_KEY"
    exit 1
fi

echo "🛠️  Starting Build and Deploy process..."
make deploy