# Ubuntu Deployment

This project can be deployed on Ubuntu with `systemd`. The backend serves both
the API and the built frontend.

## One-Command Deploy

On a fresh Ubuntu server, replace the repository URL and run:

```bash
git clone https://github.com/luorguanghui/openai-image2api-web.git
cd openai-image2api-web
sudo bash scripts/deploy-ubuntu.sh
```

The app will listen on port `3001`:

```text
http://YOUR_SERVER_IP:3001/
```

## Deploy With Nginx And Domain

Point your domain DNS record to the server, then run:

```bash
git clone https://github.com/luorguanghui/openai-image2api-web.git
cd openai-image2api-web
sudo bash scripts/deploy-ubuntu.sh --domain img.example.com --install-nginx
```

Then open:

```text
http://img.example.com/
```

To enable HTTPS:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d img.example.com
```

## Deploy Directly From GitHub URL

If you do not want to clone manually:

```bash
curl -fsSL https://raw.githubusercontent.com/luorguanghui/openai-image2api-web/main/scripts/deploy-ubuntu.sh \
  | sudo bash -s -- --repo https://github.com/luorguanghui/openai-image2api-web.git
```

With Nginx:

```bash
curl -fsSL https://raw.githubusercontent.com/luorguanghui/openai-image2api-web/main/scripts/deploy-ubuntu.sh \
  | sudo bash -s -- \
    --repo https://github.com/luorguanghui/openai-image2api-web.git \
    --domain img.example.com \
    --install-nginx
```

## Configuration

The script writes `/opt/openai-image2api-web/.env` by default.

Useful options:

```bash
sudo bash scripts/deploy-ubuntu.sh \
  --port 3001 \
  --api-base-url https://api.apimart.ai \
  --api-key sk-xxxx \
  --cors-origin https://img.example.com
```

The API key can also be entered in the web UI, so `--api-key` is optional.

## Operations

Check service status:

```bash
sudo systemctl status openai-image2api-web
```

View logs:

```bash
sudo journalctl -u openai-image2api-web -f
```

Redeploy after pulling latest code:

```bash
cd /opt/openai-image2api-web
sudo bash scripts/deploy-ubuntu.sh
```

Redeploy by fetching from GitHub:

```bash
sudo bash /opt/openai-image2api-web/scripts/deploy-ubuntu.sh \
  --repo https://github.com/luorguanghui/openai-image2api-web.git
```
