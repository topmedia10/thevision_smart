#!/usr/bin/env bash
# Idempotent installer for the EC2 services (Amazon Linux 2023).
# Run as root (SSM runs as root). Assumes the instance profile `smart-ec2-role`
# is attached (for Secrets Manager / SQS / DynamoDB access).
#
# The application source is expected at /opt/thevision-smart/src.tar.gz
# (delivered out-of-band by the deploy step) OR already extracted to
# /opt/thevision-smart. This script builds it, writes the env file from
# Secrets Manager, and installs the systemd units + nginx config.
set -euo pipefail

REGION="il-central-1"
ACCOUNT_ID="975050130305"
APP_DIR="/opt/thevision-smart"
ENV_FILE="/etc/thevision-smart.env"
APP_USER="smartapp"

echo "==> [1/7] Base packages (Node 20, nginx)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null)" != v20* ]]; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
fi
dnf install -y nginx tar gzip

echo "==> [2/7] App user + directory"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"

echo "==> [3/7] Extract source (if a tarball is present)"
if [[ -f "$APP_DIR/src.tar.gz" ]]; then
  tar -xzf "$APP_DIR/src.tar.gz" -C "$APP_DIR"
  rm -f "$APP_DIR/src.tar.gz"
fi

echo "==> [4/7] Build"
cd "$APP_DIR"
npm ci --no-audit --no-fund
npm run build
npm prune --omit=dev
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> [5/7] Env file from Secrets Manager + CDK outputs"
EC2_API_TOKEN="$(aws secretsmanager get-secret-value --region "$REGION" \
  --secret-id smart/ec2-api-token --query SecretString --output text)"
# Global SMS secret is JSON { apiKey, originator } — may be empty pre-go-live.
GSMS_JSON="$(aws secretsmanager get-secret-value --region "$REGION" \
  --secret-id smart/global-sms --query SecretString --output text 2>/dev/null || echo '{}')"
GSMS_KEY="$(echo "$GSMS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log((JSON.parse(s||"{}").apiKey)||"")}catch{console.log("")}})')"
GSMS_ORIG="$(echo "$GSMS_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log((JSON.parse(s||"{}").originator)||"")}catch{console.log("")}})')"

umask 077
cat > "$ENV_FILE" <<EOF
AWS_REGION=$REGION
PORT=8080
EC2_API_TOKEN=$EC2_API_TOKEN
GLOBAL_SMS_HOST=http://api.itnewsletter.co.il
GLOBAL_SMS_API_KEY=$GSMS_KEY
GLOBAL_SMS_ORIGINATOR=$GSMS_ORIG
SQS_QUEUE_URL=https://sqs.$REGION.amazonaws.com/$ACCOUNT_ID/sms-outbox
TABLE_SMS_IDEMPOTENCY=smart-sms-idempotency
TABLE_SMS_ACTIVITY_LOG=smart-sms-activity-log
TABLE_EMPLOYEES=smart-employees
INTER_SEND_DELAY_MS=80
IDEMPOTENCY_TTL_DAYS=7
EOF
chmod 600 "$ENV_FILE"

echo "==> [6/7] systemd units"
cp "$APP_DIR/systemd/thevision-smart-api.service" /etc/systemd/system/
cp "$APP_DIR/systemd/thevision-smart-worker.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable thevision-smart-api.service thevision-smart-worker.service
# Use restart (not `enable --now`) so a re-run picks up env/secret/code changes
# even when the services are already running.
systemctl restart thevision-smart-api.service
systemctl restart thevision-smart-worker.service

echo "==> [7/7] nginx"
mkdir -p /var/www/certbot
cp "$APP_DIR/nginx/api.thevision.co.il.conf" /etc/nginx/conf.d/
# AL2023 default nginx.conf includes /etc/nginx/conf.d/*.conf
nginx -t
systemctl enable --now nginx
systemctl reload nginx || systemctl restart nginx

echo "==> DONE. Local checks:"
sleep 2
curl -fsS http://127.0.0.1:8080/health && echo
echo "Services:"
systemctl is-active thevision-smart-api.service thevision-smart-worker.service nginx || true
echo
echo "NEXT (manual, after DNS api.thevision.co.il -> 51.84.169.45):"
echo "  dnf install -y python3-pip && pip3 install certbot certbot-nginx"
echo "  certbot --nginx -d api.thevision.co.il --non-interactive --agree-tos -m <you@email>"
