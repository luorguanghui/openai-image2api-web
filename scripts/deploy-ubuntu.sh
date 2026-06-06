#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="openai-image2api-web"
APP_USER="image2api"
APP_DIR="/opt/${APP_NAME}"
REPO_URL=""
BRANCH="main"
PORT="3001"
API_BASE_URL="https://api.apimart.ai"
OPENAI_API_KEY=""
CORS_ORIGIN=""
DOMAIN=""
INSTALL_NGINX="false"
HTTPS_PROXY_URL=""

usage() {
  cat <<'USAGE'
Usage:
  sudo bash scripts/deploy-ubuntu.sh [options]

Options:
  --repo URL            Git repository URL to clone/update on the server.
  --branch NAME         Git branch to deploy. Default: main.
  --dir PATH            Install directory. Default: /opt/openai-image2api-web.
  --user NAME           Linux service user. Default: image2api.
  --port PORT           Backend port. Default: 3001.
  --api-key KEY         Optional OPENAI_API_KEY value written to .env.
  --api-base-url URL    API base URL. Default: https://api.apimart.ai.
  --cors-origin URL     Optional CORS origin. Empty means same-origin only.
  --domain DOMAIN       Domain used for nginx server_name.
  --install-nginx       Install and configure nginx reverse proxy.
  --https-proxy URL     Set HTTPS proxy for API requests (e.g. http://127.0.0.1:7890).
  -h, --help            Show this help.

Examples:
  sudo bash scripts/deploy-ubuntu.sh
  sudo bash scripts/deploy-ubuntu.sh --repo https://github.com/OWNER/openai-image2api-web.git
  sudo bash scripts/deploy-ubuntu.sh --repo https://github.com/OWNER/openai-image2api-web.git --domain img.example.com --install-nginx
  sudo bash scripts/deploy-ubuntu.sh --https-proxy http://127.0.0.1:7890
USAGE
}

log() {
  printf '\n[%s] %s\n' "$(date +'%H:%M:%S')" "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_URL="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --dir)
      APP_DIR="${2:-}"
      shift 2
      ;;
    --user)
      APP_USER="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --api-key)
      OPENAI_API_KEY="${2:-}"
      shift 2
      ;;
    --api-base-url)
      API_BASE_URL="${2:-}"
      shift 2
      ;;
    --cors-origin)
      CORS_ORIGIN="${2:-}"
      shift 2
      ;;
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --install-nginx)
      INSTALL_NGINX="true"
      shift
      ;;
    --https-proxy)
      HTTPS_PROXY_URL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

[[ -n "$APP_DIR" ]] || fail "--dir cannot be empty"
[[ -n "$APP_USER" ]] || fail "--user cannot be empty"
[[ -n "$PORT" ]] || fail "--port cannot be empty"

if [[ "${EUID}" -ne 0 ]]; then
  fail "Please run as root, for example: sudo bash scripts/deploy-ubuntu.sh"
fi

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian) ;;
    *) log "Warning: this script is tested on Ubuntu/Debian, detected ${PRETTY_NAME:-unknown}." ;;
  esac
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

install_node_if_needed() {
  local major=""
  if command -v node >/dev/null 2>&1; then
    major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || true)"
  fi

  if [[ -n "$major" && "$major" -ge 20 ]]; then
    log "Node.js $(node -v) is already installed."
    return
  fi

  log "Installing Node.js 20."
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
}

ensure_system_packages() {
  log "Installing system packages."
  apt-get update
  apt-get install -y git curl build-essential
}

ensure_app_user() {
  if id "$APP_USER" >/dev/null 2>&1; then
    log "User ${APP_USER} already exists."
    return
  fi

  log "Creating service user ${APP_USER}."
  useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
}

checkout_code() {
  if [[ -n "$REPO_URL" ]]; then
    log "Deploying ${REPO_URL} (${BRANCH}) to ${APP_DIR}."
    mkdir -p "$(dirname "$APP_DIR")"

    if [[ -d "${APP_DIR}/.git" ]]; then
      git -C "$APP_DIR" fetch --prune origin
      git -C "$APP_DIR" checkout "$BRANCH"
      git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
    elif [[ -e "$APP_DIR" && -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]]; then
      fail "${APP_DIR} exists but is not a git checkout. Move it aside or choose --dir."
    else
      git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    fi
  else
    if [[ -f "${LOCAL_REPO_DIR}/package.json" && -d "${LOCAL_REPO_DIR}/server" && -d "${LOCAL_REPO_DIR}/client" ]]; then
      APP_DIR="$LOCAL_REPO_DIR"
      log "No --repo supplied; deploying current checkout at ${APP_DIR}."
    else
      fail "No --repo supplied and current directory is not a project checkout."
    fi
  fi

  chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  local escaped

  escaped="$(printf '%s' "$value" | sed -e 's/[\/&]/\\&/g')"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s/^${key}=.*/${key}=${escaped}/" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

write_env_file() {
  local env_file="${APP_DIR}/.env"

  log "Writing ${env_file}."
  if [[ ! -f "$env_file" ]]; then
    touch "$env_file"
  fi

  set_env_value "PORT" "$PORT" "$env_file"
  set_env_value "NODE_ENV" "production" "$env_file"
  set_env_value "API_BASE_URL" "$API_BASE_URL" "$env_file"
  set_env_value "CORS_ORIGIN" "$CORS_ORIGIN" "$env_file"
  set_env_value "RATE_LIMIT_WINDOW_MS" "60000" "$env_file"
  set_env_value "RATE_LIMIT_MAX" "60" "$env_file"
  set_env_value "TASK_POLL_INITIAL_DELAY" "10000" "$env_file"
  set_env_value "TASK_POLL_INTERVAL" "3000" "$env_file"
  set_env_value "TASK_POLL_TIMEOUT" "180000" "$env_file"
  set_env_value "HTTP_REQUEST_TIMEOUT" "240000" "$env_file"

  if [[ -n "$OPENAI_API_KEY" ]]; then
    set_env_value "OPENAI_API_KEY" "$OPENAI_API_KEY" "$env_file"
  elif ! grep -qE "^OPENAI_API_KEY=" "$env_file"; then
    set_env_value "OPENAI_API_KEY" "" "$env_file"
  fi

  if [[ -n "$HTTPS_PROXY_URL" ]]; then
    set_env_value "HTTPS_PROXY" "$HTTPS_PROXY_URL" "$env_file"
  fi

  chmod 600 "$env_file"
  chown "${APP_USER}:${APP_USER}" "$env_file"
}

run_as_app_user() {
  sudo -H -u "$APP_USER" bash -lc "$*"
}

install_and_build() {
  log "Installing npm dependencies and building."
  run_as_app_user "cd '$APP_DIR' && npm ci"
  run_as_app_user "cd '$APP_DIR/client' && npm ci"
  run_as_app_user "cd '$APP_DIR/server' && npm ci"
  run_as_app_user "cd '$APP_DIR' && npm run build"
  run_as_app_user "cd '$APP_DIR/server' && npm ci --omit=dev"

  mkdir -p "${APP_DIR}/server/data" "${APP_DIR}/server/public/generated"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/server/data" "${APP_DIR}/server/public"
}

install_systemd_service() {
  local node_bin
  node_bin="$(command -v node)"
  [[ -x "$node_bin" ]] || fail "node binary not found"

  local after_targets="network-online.target"
  if systemctl is-enabled clash.service >/dev/null 2>&1; then
    after_targets="${after_targets} clash.service"
  fi

  log "Installing systemd service ${APP_NAME}.service."
  cat > "/etc/systemd/system/${APP_NAME}.service" <<SERVICE
[Unit]
Description=OpenAI Image2API Web
After=${after_targets}
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/server
EnvironmentFile=${APP_DIR}/.env
ExecStart=${node_bin} ${APP_DIR}/server/dist/index.js
Restart=always
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${APP_DIR}/server/data ${APP_DIR}/server/public/generated

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable "${APP_NAME}.service"
  systemctl restart "${APP_NAME}.service"
}

install_nginx_config() {
  [[ "$INSTALL_NGINX" == "true" ]] || return 0

  local server_name="${DOMAIN:-_}"

  log "Installing nginx reverse proxy for ${server_name}."
  apt-get install -y nginx

  cat > "/etc/nginx/sites-available/${APP_NAME}" <<NGINX
server {
    listen 80;
    server_name ${server_name};

    client_max_body_size 20M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 256;
    gzip_vary on;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 240s;
        proxy_read_timeout 240s;
    }

    location ~ /\\. {
        deny all;
    }
}
NGINX

  ln -sfn "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable nginx
  systemctl reload nginx
}

verify_service() {
  log "Checking service health."
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
      log "Deployment complete."
      echo "Local health: http://127.0.0.1:${PORT}/api/health"
      if [[ "$INSTALL_NGINX" == "true" ]]; then
        echo "Public URL: http://${DOMAIN:-your-server-ip}/"
        echo "HTTPS tip: sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d ${DOMAIN:-your-domain.com}"
      else
        echo "App URL: http://YOUR_SERVER_IP:${PORT}/"
      fi
      echo "Logs: sudo journalctl -u ${APP_NAME} -f"

      if [[ -n "$HTTPS_PROXY_URL" ]]; then
        echo "Proxy: ${HTTPS_PROXY_URL} (verify: sudo journalctl -u ${APP_NAME} | grep proxy)"
      fi
      return 0
    fi
    sleep 2
  done

  systemctl --no-pager --full status "${APP_NAME}.service" || true
  fail "Service did not pass health check."
}

ensure_system_packages
install_node_if_needed
ensure_app_user
checkout_code
write_env_file
install_and_build
install_systemd_service
install_nginx_config
verify_service
