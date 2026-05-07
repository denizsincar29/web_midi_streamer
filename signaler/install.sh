#!/usr/bin/env bash
# install.sh — build and install the WebRTC signaling server on Debian
# Run as root:  sudo bash install.sh
set -euo pipefail

INSTALL_DIR=/home/deniz/signaler
SERVICE_USER=denizsincar29
SERVICE_GROUP=deniz
SERVICE_FILE=/etc/systemd/system/signaler.service
BINARY=$INSTALL_DIR/signaler

echo "==> Installing Go (if not present)…"
if ! command -v go &>/dev/null; then
    apt-get update -q
    apt-get install -y golang
fi
echo "    Go $(go version)"

echo "==> Creating install directory…"
mkdir -p "$INSTALL_DIR"
chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"

echo "==> Copying source…"
cp main.go go.mod go.sum "$INSTALL_DIR/"
chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"/{main.go,go.mod,go.sum}

echo "==> Building binary…"
cd "$INSTALL_DIR"
# Download dependency and build as the service user so module cache is correct
sudo -u "$SERVICE_USER" go mod download
sudo -u "$SERVICE_USER" go build -o "$BINARY" .
echo "    Built $BINARY"

echo "==> Installing systemd service…"
cp "$(dirname "$0")/signaler.service" "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable signaler
systemctl restart signaler

echo ""
echo "✅ Done!"
echo "   Status : $(systemctl is-active signaler)"
echo "   Logs   : journalctl -u signaler -f"
echo "   Port   : 8765  (ws://$(hostname -I | awk '{print $1}'):8765/signal)"
echo ""
echo "   If you have a firewall, open port 8765:"
echo "     ufw allow 8765/tcp"
echo ""
echo "   To use TLS (wss://), put nginx/caddy in front and proxy to localhost:8765."
