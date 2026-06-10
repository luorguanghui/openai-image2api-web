# Ubuntu Deployment

This project can run on Ubuntu with `systemd`. The backend serves the API and
the built frontend from one Node.js service.

The deployment script installs system packages, installs Node.js 20 when needed,
creates a non-root service user, clones or updates the repository, installs npm
dependencies, builds the app, writes a systemd unit, optionally configures
nginx, restarts the service, and checks `/api/health`.

## First Deployment

Run the script as root on an Ubuntu server. If you run it from a cloned checkout,
the script deploys that checkout. If you run it from somewhere else and omit
`--repo`, it clones the default repository:

```bash
sudo bash scripts/deploy-ubuntu.sh
```

The default repository is:

```text
https://github.com/luorguanghui/openai-image2api-web.git
```

To deploy without cloning manually:

```bash
curl -fsSL https://raw.githubusercontent.com/luorguanghui/openai-image2api-web/main/scripts/deploy-ubuntu.sh \
  | sudo bash -s --
```

The app listens on port `3001` by default:

```text
http://YOUR_SERVER_IP:3001/
```

## First Deployment With MySQL And Admin Values

The app uses MySQL. Provide your MySQL connection and first admin credentials on
the first deploy, or edit `/opt/openai-image2api-web/.env` before starting
traffic.

```bash
sudo bash scripts/deploy-ubuntu.sh \
  --mysql-host 127.0.0.1 \
  --mysql-port 3306 \
  --mysql-user image2api \
  --mysql-password 'change-this-mysql-password' \
  --mysql-database openai_image2api \
  --admin-username admin \
  --admin-password 'change-this-admin-password'
```

The legacy `OPENAI_API_KEY` environment value is optional because admins can
configure a global API key in the web UI.

```bash
sudo bash scripts/deploy-ubuntu.sh --api-key sk-xxxx
```

## Deploy With Nginx And A Domain

Point your domain DNS record to the server, then run:

```bash
sudo bash scripts/deploy-ubuntu.sh \
  --domain img.example.com \
  --install-nginx
```

Open:

```text
http://img.example.com/
```

To enable HTTPS:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d img.example.com
```

## Update Or Redeploy

For an existing checkout, the script performs this update flow:

1. `git fetch --prune origin`
2. `git checkout <branch>`
3. `git reset --hard origin/<branch>`
4. install dependencies
5. build the frontend and backend
6. restart systemd
7. run the local health check

Redeploy the default branch:

```bash
sudo bash /opt/openai-image2api-web/scripts/deploy-ubuntu.sh
```

Redeploy a specific branch:

```bash
sudo bash /opt/openai-image2api-web/scripts/deploy-ubuntu.sh --branch main
```

Redeploy from an explicit repository URL:

```bash
sudo bash /opt/openai-image2api-web/scripts/deploy-ubuntu.sh \
  --repo https://github.com/luorguanghui/openai-image2api-web.git \
  --branch main
```

Sensitive `.env` values are preserved on redeploy unless explicitly supplied.
For example, this changes only the admin password value:

```bash
sudo bash /opt/openai-image2api-web/scripts/deploy-ubuntu.sh \
  --admin-password 'new-admin-password'
```

## Environment File

The default environment file is:

```text
/opt/openai-image2api-web/.env
```

Edit it directly when you need to change runtime settings:

```bash
sudo nano /opt/openai-image2api-web/.env
sudo systemctl restart openai-image2api-web
```

The script ensures missing defaults such as `PORT`, `NODE_ENV`,
`API_BASE_URL`, MySQL host/port/user/database, and admin username. Sensitive
values are not overwritten during redeploy unless you pass the matching option:

```text
OPENAI_API_KEY
MYSQL_PASSWORD
ADMIN_PASSWORD
HTTPS_PROXY
```

Common options:

```bash
sudo bash scripts/deploy-ubuntu.sh \
  --port 3001 \
  --api-base-url https://api.apimart.ai \
  --cors-origin https://img.example.com \
  --mysql-host 127.0.0.1 \
  --mysql-port 3306 \
  --mysql-user image2api \
  --mysql-password 'change-this-mysql-password' \
  --mysql-database openai_image2api \
  --admin-username admin \
  --admin-password 'change-this-admin-password'
```

## Service, Logs, And Health Check

Check service status:

```bash
sudo systemctl status openai-image2api-web --no-pager
```

View live logs:

```bash
sudo journalctl -u openai-image2api-web -f
```

View recent logs:

```bash
sudo journalctl -u openai-image2api-web -n 200 --no-pager
```

Run the health check manually:

```bash
curl -fsS http://127.0.0.1:3001/api/health
```

If you changed `PORT` in `.env`, use that port in the health URL.

Restart the service:

```bash
sudo systemctl restart openai-image2api-web
```

## Troubleshooting

Check whether the service is listening:

```bash
sudo ss -ltnp | grep node
```

Validate nginx configuration:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
```

Check MySQL connectivity from the server:

```bash
mysql -h 127.0.0.1 -P 3306 -u image2api -p -e 'SELECT 1;'
```

If the service fails with `DB_UNAVAILABLE`, confirm these `.env` values:

```text
MYSQL_HOST
MYSQL_PORT
MYSQL_USER
MYSQL_PASSWORD
MYSQL_DATABASE
```

If the health check fails after a deploy, inspect the service and logs:

```bash
sudo systemctl status openai-image2api-web --no-pager
sudo journalctl -u openai-image2api-web -n 200 --no-pager
curl -v http://127.0.0.1:3001/api/health
```

If generated images cannot be written, repair ownership and restart:

```bash
sudo mkdir -p /opt/openai-image2api-web/server/data /opt/openai-image2api-web/server/public/generated
sudo chown -R image2api:image2api /opt/openai-image2api-web/server/data /opt/openai-image2api-web/server/public
sudo systemctl restart openai-image2api-web
```

If you use an HTTPS proxy for upstream API requests:

```bash
sudo bash /opt/openai-image2api-web/scripts/deploy-ubuntu.sh \
  --https-proxy http://127.0.0.1:7890
```
