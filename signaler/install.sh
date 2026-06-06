#!/usr/bin/env bash
# install.sh — build and install the JamRTC signaling server
# Run as normal user from the signaler directory: bash install.sh
set -euo pipefail

WORK_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_USER="$(whoami)"
SERVICE_FILE=/etc/systemd/system/jamrtc-signaler.service

echo "==> Working directory: $WORK_DIR"
echo "==> Service user: $SERVICE_USER"

echo "==> Checking Go..."
if ! command -v go &>/dev/null; then
    echo "ERROR: Go not found. Install it first: https://go.dev/dl/"
    exit 1
fi
echo "    $(go version)"

echo "==> Building..."
cd "$WORK_DIR"
go mod download
go build -o signaler .
echo "    Built $WORK_DIR/signaler"

echo "==> Writing service file (needs sudo)..."
sudo tee "$SERVICE_FILE" > /dev/null << UNIT
[Unit]
Description=JamRTC WebRTC Signaling Server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$WORK_DIR
EnvironmentFile=-$WORK_DIR/.env
ExecStart=$WORK_DIR/signaler -addr :8987
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jamrtc-signaler
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
UNIT

echo "==> Enabling and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable jamrtc-signaler
sudo systemctl restart jamrtc-signaler

echo ""
echo "✅ Done!"
echo "   Status : $(systemctl is-active jamrtc-signaler)"
echo "   Logs   : journalctl -u jamrtc-signaler -f"
echo "   Port   : 8987"
if [[ ! -f "$WORK_DIR/.env" ]]; then
    echo ""
    echo "   💡 For ntfy notifications:"
    echo "      cp $WORK_DIR/.env.example $WORK_DIR/.env && nano $WORK_DIR/.env"
fi
