#!/usr/bin/env bash
# One-time setup for a fresh Debian/Ubuntu VPS that will run api-test-gateway's
# staging deployment. Run as root (or with sudo) on the target host once.
#
# Usage: ./provision-staging-host.sh <deploy-user>
set -euo pipefail

DEPLOY_USER="${1:?usage: provision-staging-host.sh <deploy-user>}"

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys.d"

echo "Next steps:"
echo "1. Generate a deploy key pair locally: ssh-keygen -t ed25519 -f deploy_key -N ''"
echo "2. Append deploy_key.pub to /home/$DEPLOY_USER/.ssh/authorized_keys on this host"
echo "3. Store deploy_key's private key contents as the STAGING_SSH_KEY GitHub Actions secret"
echo "4. As $DEPLOY_USER: git clone the repo to ~/api-test-gateway, copy .env.example to .env, fill it in, chmod 600 .env"
echo "5. Point the STAGING_HOST github variable at this host and STAGING_USER at $DEPLOY_USER"
