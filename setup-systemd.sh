#!/bin/bash
# Setup script for Web MIDI Streamer systemd service

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Get UV path
UV_PATH=$(which uv)
if [ -z "$UV_PATH" ]; then
    echo "Error: uv not found in PATH"
    echo "Please install uv first: pip install uv"
    exit 1
fi

# Get current user and group
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

# Service file path
SERVICE_FILE="/etc/systemd/system/web-midi-streamer.service"

echo "Creating systemd service file..."
echo "UV Path: $UV_PATH"
echo "Working Directory: $SCRIPT_DIR"
echo "User: $CURRENT_USER"
echo "Group: $CURRENT_GROUP"

# Create systemd service file content
cat > /tmp/web-midi-streamer.service << EOF
[Unit]
Description=Web MIDI Streamer WebRTC Service
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
Group=$CURRENT_GROUP
WorkingDirectory=$SCRIPT_DIR
ExecStart=$UV_PATH run $SCRIPT_DIR/server.py
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "Service file created at /tmp/web-midi-streamer.service"
echo ""
echo "IMPORTANT: Configure the server before installing:"
echo "  1. Copy .env.example to .env in $SCRIPT_DIR"
echo "  2. Edit .env to set your desired PORT and other settings"
echo ""
echo "To install the service, run the following commands as root:"
echo ""
echo "  sudo cp /tmp/web-midi-streamer.service $SERVICE_FILE"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable web-midi-streamer.service"
echo "  sudo systemctl start web-midi-streamer.service"
echo ""
echo "To check status:"
echo "  sudo systemctl status web-midi-streamer.service"
echo ""
echo "To view logs:"
echo "  sudo journalctl -u web-midi-streamer.service -f"
