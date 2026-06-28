# EC2 services runbook

Instance `i-08b5b54881a151608` · Elastic IP `51.84.169.45` · Amazon Linux 2023.
Two systemd services + nginx. All access via SSM (no SSH needed).

## What's installed
| Unit | Purpose |
|---|---|
| `thevision-smart-api.service` | Express API on `127.0.0.1:8080` (`/health`, `/balance`, `/send-otp`) |
| `thevision-smart-worker.service` | SQS worker draining `sms-outbox` → Global SMS |
| `nginx` | Reverse proxy `:80` → `:8080` (+ ACME webroot) |

App dir `/opt/thevision-smart` · env file `/etc/thevision-smart.env` (mode 600).

## Deploy / redeploy code
From the repo (`ec2/`):
```bash
tar -czf /tmp/smart-ec2-src.tar.gz src systemd nginx setup package.json package-lock.json tsconfig.json
# build SSM params (see project history) and:
aws ssm send-command --region il-central-1 --instance-ids i-08b5b54881a151608 \
  --document-name AWS-RunShellScript --parameters file:///tmp/ssm-params.json
```
`setup/install.sh` is idempotent — safe to re-run. It rebuilds, rewrites the env
file from Secrets Manager, and restarts the services.

## Common ops (via SSM AWS-RunShellScript)
```bash
systemctl status thevision-smart-worker
journalctl -u thevision-smart-worker -n 100 --no-pager
systemctl restart thevision-smart-api thevision-smart-worker
# after editing the Global SMS secret, refresh env + restart:
bash /opt/thevision-smart/setup/install.sh
```

## Remaining go-live steps (need you)
1. **DNS**: `A  api.thevision.co.il → 51.84.169.45`.
2. **Security group** `sg-025c2df4f971ce7a1`: open inbound **80** and **443**
   (currently only 22). Needed for certbot + external HTTPS from Lambdas/Vercel.
   ```bash
   aws ec2 authorize-security-group-ingress --region il-central-1 --group-id sg-025c2df4f971ce7a1 \
     --ip-permissions \
       'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0,Description=HTTP}]' \
       'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0,Description=HTTPS}]'
   ```
3. **TLS** (after DNS resolves):
   ```bash
   dnf install -y python3-pip && pip3 install certbot certbot-nginx
   certbot --nginx -d api.thevision.co.il --non-interactive --agree-tos -m you@example.com
   systemctl enable --now certbot-renew.timer 2>/dev/null || true
   ```
4. **Global SMS secret**: put the **rotated** key + approved originator into
   `smart/global-sms` as JSON, then re-run `install.sh`:
   ```bash
   aws secretsmanager put-secret-value --region il-central-1 --secret-id smart/global-sms \
     --secret-string '{"apiKey":"<ROTATED_KEY>","originator":"<APPROVED_SENDER>"}'
   ```

## Health
```bash
curl -s http://127.0.0.1:8080/health           # {"ok":true}
curl -s -H "Authorization: Bearer <EC2_API_TOKEN>" http://127.0.0.1:8080/balance
```
The `EC2_API_TOKEN` value lives in `/etc/thevision-smart.env` and in secret
`smart/ec2-api-token` (also set as a Vercel/Lambda env var).
