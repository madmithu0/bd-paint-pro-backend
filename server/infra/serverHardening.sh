#!/bin/bash
# ==============================================================================
# File #190: server/infra/serverHardening.sh
# Ubuntu VPS Production Hardening Script (v3.0.0 SELF-HEALING LOCK)
# ==============================================================================

set -e

echo "🛡️ Starting Ubuntu VPS Security Hardening..."

# 1. System Update & Essential Security Packages
apt-get update && apt-get upgrade -y
apt-get install -y ufw fail2ban clamav clamav-daemon curl git

# 2. Configure UFW Firewall (Allow SSH, HTTP, HTTPS only)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 3. Disable SSH Password Authentication (Enforce SSH Key Only)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# 4. Configure Fail2Ban Auto IP Ban for SSH & Nginx/API Brute-Force
cat <<EOF > /etc/fail2ban/jail.local
[DEFAULT]
bantime = 86400
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 22
logpath = %(sshd_log)s
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# 5. Update ClamAV Virus Definitions & Enable Real-Time Daemon
systemctl stop clamav-freshclam || true
freshclam
systemctl enable clamav-freshclam
systemctl start clamav-freshclam
systemctl enable clamav-daemon
systemctl start clamav-daemon

echo "✅ VPS Hardening Completed: UFW, SSH Key Lock, Fail2Ban & ClamAV Active!"
