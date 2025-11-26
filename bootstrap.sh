#!/bin/bash
set -euo pipefail

if [ ! -f ".env" ]; then
    echo "❌ .env file missing!"
    exit 1
fi

set -a
source .env
set +a

EC2_USER="${EC2_USER:-ec2-user}"
EC2_HOST="${EC2_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-/home/ec2-user/xiuh-bot}"
SSH_KEY="${SSH_KEY:-./my-key.pem}"
SERVICE_FILE="${SERVICE_FILE:-/etc/systemd/system/discordbot.service}"
NODE_BIN="${NODE_BIN:-}"

if [ -z "$EC2_HOST" ]; then
    echo "❌ EC2_HOST is not set in .env"
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH Key file not found at $SSH_KEY"
    exit 1
fi

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"
REMOTE="${EC2_USER}@${EC2_HOST}"

echo "🔍 Checking Node.js on remote host..."
REMOTE_NODE_PATH=$(ssh $SSH_OPTS "$REMOTE" "bash -s" <<'EOSSH'
set -u

have_node() {
    command -v node >/dev/null 2>&1
}

if have_node; then
    command -v node
    exit 0
fi

install_node() {
    if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y nodejs18 >/dev/null 2>&1 && return 0
        sudo dnf install -y nodejs >/dev/null 2>&1 && return 0
    elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y nodejs >/dev/null 2>&1 && return 0
    elif command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update >/dev/null 2>&1
        sudo apt-get install -y nodejs npm >/dev/null 2>&1 && return 0
    fi
    return 1
}

if install_node && have_node; then
    command -v node
else
    exit 1
fi
EOSSH
)

REMOTE_NODE_PATH=$(echo "$REMOTE_NODE_PATH" | tail -n 1 | tr -d '\r')

if [ -z "$REMOTE_NODE_PATH" ]; then
    echo "❌ Unable to locate or install Node.js on the remote host. Set NODE_BIN in .env if Node is in a custom location."
    exit 1
fi

if [ -z "$NODE_BIN" ]; then
    NODE_BIN="$REMOTE_NODE_PATH"
fi

echo "📁 Ensuring remote directory ${REMOTE_DIR} exists..."
ssh $SSH_OPTS "$REMOTE" "mkdir -p '${REMOTE_DIR}'"

SERVICE_UNIT=$(cat <<EOF
[Unit]
Description=Discord Timezone Bot
After=network.target

[Service]
Type=simple
User=${EC2_USER}
WorkingDirectory=${REMOTE_DIR}
EnvironmentFile=${REMOTE_DIR}/.env
ExecStart=${NODE_BIN} ${REMOTE_DIR}/dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
)

echo "🔧 Provisioning systemd service..."
ssh $SSH_OPTS "$REMOTE" "sudo tee '${SERVICE_FILE}' > /dev/null <<'SERVICE'
${SERVICE_UNIT}
SERVICE
sudo systemctl daemon-reload
sudo systemctl enable discordbot >/dev/null 2>&1 || true
echo '✅ systemd service ready (will start after first deploy).'
"

echo "🎉 Bootstrap complete. Run ./deploy.sh to ship the bot."

