#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="openai-image2api-web"
APP_USER="image2api"
APP_DIR="/opt/${APP_NAME}"
APP_DIR_SET="false"
DEFAULT_REPO_URL="https://github.com/luorguanghui/openai-image2api-web.git"
REPO_URL=""
REPO_URL_SET="false"
BRANCH="main"
PORT="3001"
PORT_SET="false"
API_BASE_URL="https://api.apimart.ai"
API_BASE_URL_SET="false"
OPENAI_API_KEY=""
OPENAI_API_KEY_SET="false"
CORS_ORIGIN=""
CORS_ORIGIN_SET="false"
DOMAIN=""
INSTALL_NGINX="false"
HTTPS_PROXY_URL=""
HTTPS_PROXY_URL_SET="false"
MYSQL_HOST="127.0.0.1"
MYSQL_HOST_SET="false"
MYSQL_PORT="3306"
MYSQL_PORT_SET="false"
MYSQL_USER="root"
MYSQL_USER_SET="false"
MYSQL_PASSWORD=""
MYSQL_PASSWORD_SET="false"
MYSQL_DATABASE="openai_image2api"
MYSQL_DATABASE_SET="false"
ADMIN_USERNAME="admin"
ADMIN_USERNAME_SET="false"
ADMIN_PASSWORD="admin123"
ADMIN_PASSWORD_SET="false"

usage() {
  cat <<'USAGE'
Usage:
  sudo bash scripts/deploy-ubuntu.sh [options]

Options:
  --repo URL              Git repository URL to clone/update. Default: current
                          checkout, or https://github.com/luorguanghui/openai-image2api-web.git.
  --branch NAME           Git branch to deploy. Default: main.
  --dir PATH              Install directory. Default: /opt/openai-image2api-web.
  --user NAME             Linux service user. Default: image2api.
  --port PORT             Backend port. Default: preserves .env, or 3001 if missing.
  --api-key KEY           Optional OPENAI_API_KEY. Preserved unless explicitly supplied.
  --api-base-url URL      API base URL. Default: preserves .env, or https://api.apimart.ai.
  --cors-origin URL       Optional CORS origin. Empty means same-origin only.
  --mysql-host HOST       MySQL host. Default: preserves .env, or 127.0.0.1.
  --mysql-port PORT       MySQL port. Default: preserves .env, or 3306.
  --mysql-user USER       MySQL user. Default: preserves .env, or root.
  --mysql-password PASS   MySQL password. Preserved unless explicitly supplied.
  --mysql-database NAME   MySQL database. Default: preserves .env, or openai_image2api.
  --admin-username USER   Initial admin username. Default: preserves .env, or admin.
  --admin-password PASS   Initial admin password. Preserved unless explicitly supplied.
  --domain DOMAIN         Domain used for nginx server_name.
  --install-nginx         Install and configure nginx reverse proxy.
  --https-proxy URL       Set HTTPS proxy for API requests (e.g. http://127.0.0.1:7890).
  -h, --help              Show this help.

Examples:
  sudo bash scripts/deploy-ubuntu.sh
  sudo bash scripts/deploy-ubuntu.sh --repo https://github.com/luorguanghui/openai-image2api-web.git
  sudo bash scripts/deploy-ubuntu.sh --domain img.example.com --install-nginx
  sudo bash scripts/deploy-ubuntu.sh --mysql-password 'change-me' --admin-password 'change-me-too'
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

need_arg() {
  local option="$1"
  local value="${2:-}"
  [[ -n "$value" ]] || fail "${option} requires a value"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      need_arg "$1" "${2:-}"
      REPO_URL="$2"
      REPO_URL_SET="true"
      shift 2
      ;;
    --branch)
      need_arg "$1" "${2:-}"
      BRANCH="$2"
      shift 2
      ;;
    --dir)
      need_arg "$1" "${2:-}"
      APP_DIR="$2"
      APP_DIR_SET="true"
      shift 2
      ;;
    --user)
      need_arg "$1" "${2:-}"
      APP_USER="$2"
      shift 2
      ;;
    --port)
      need_arg "$1" "${2:-}"
      PORT="$2"
      PORT_SET="true"
      shift 2
      ;;
    --api-key)
      need_arg "$1" "${2:-}"
      OPENAI_API_KEY="$2"
      OPENAI_API_KEY_SET="true"
      shift 2
      ;;
    --api-base-url)
      need_arg "$1" "${2:-}"
      API_BASE_URL="$2"
      API_BASE_URL_SET="true"
      shift 2
      ;;
    --cors-origin)
      CORS_ORIGIN="${2:-}"
      CORS_ORIGIN_SET="true"
      shift 2
      ;;
    --mysql-host)
      need_arg "$1" "${2:-}"
      MYSQL_HOST="$2"
      MYSQL_HOST_SET="true"
      shift 2
      ;;
    --mysql-port)
      need_arg "$1" "${2:-}"
      MYSQL_PORT="$2"
      MYSQL_PORT_SET="true"
      shift 2
      ;;
    --mysql-user)
      need_arg "$1" "${2:-}"
      MYSQL_USER="$2"
      MYSQL_USER_SET="true"
      shift 2
      ;;
    --mysql-password)
      MYSQL_PASSWORD="${2:-}"
      MYSQL_PASSWORD_SET="true"
      shift 2
      ;;
    --mysql-database)
      need_arg "$1" "${2:-}"
      MYSQL_DATABASE="$2"
      MYSQL_DATABASE_SET="true"
      shift 2
      ;;
    --admin-username)
      need_arg "$1" "${2:-}"
      ADMIN_USERNAME="$2"
      ADMIN_USERNAME_SET="true"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="${2:-}"
      ADMIN_PASSWORD_SET="true"
      shift 2
      ;;
    --domain)
      need_arg "$1" "${2:-}"
      DOMAIN="$2"
      shift 2
      ;;
    --install-nginx)
      INSTALL_NGINX="true"
      shift
      ;;
    --https-proxy)
      need_arg "$1" "${2:-}"
      HTTPS_PROXY_URL="$2"
      HTTPS_PROXY_URL_SET="true"
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
[[ -n "$BRANCH" ]] || fail "--branch cannot be empty"

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
LOCAL_REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." 2>/dev/null && pwd || true)"
INVOCATION_DIR="$(pwd -P)"

shell_quote() {
  printf '%q' "$1"
}

is_project_checkout() {
  local dir="$1"
  [[ -n "$dir" && -f "${dir}/package.json" && -d "${dir}/server" && -d "${dir}/client" && -d "${dir}/.git" ]]
}

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
  apt-get install -y git curl build-essential sudo
}

ensure_app_user() {
  if ! getent group "$APP_USER" >/dev/null 2>&1; then
    log "Creating service group ${APP_USER}."
    groupadd --system "$APP_USER"
  fi

  if id "$APP_USER" >/dev/null 2>&1; then
    log "User ${APP_USER} already exists."
    return
  fi

  log "Creating service user ${APP_USER}."
  useradd --system --gid "$APP_USER" --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
}

git_as_app_user() {
  local dir="$1"
  shift
  sudo -H -u "$APP_USER" git -C "$dir" "$@"
}

ensure_origin_remote() {
  local dir="$1"

  if [[ -n "$REPO_URL" ]]; then
    if git_as_app_user "$dir" remote get-url origin >/dev/null 2>&1; then
      git_as_app_user "$dir" remote set-url origin "$REPO_URL"
    else
      git_as_app_user "$dir" remote add origin "$REPO_URL"
    fi
  elif ! git_as_app_user "$dir" remote get-url origin >/dev/null 2>&1; then
    fail "${dir} has no origin remote. Re-run with --repo ${DEFAULT_REPO_URL}."
  fi
}

update_existing_checkout() {
  local dir="$1"

  ensure_origin_remote "$dir"
  log "Updating existing checkout ${dir} to origin/${BRANCH}."
  git_as_app_user "$dir" fetch --prune origin
  if git_as_app_user "$dir" show-ref --verify --quiet "refs/heads/${BRANCH}"; then
    git_as_app_user "$dir" checkout "$BRANCH"
  else
    git_as_app_user "$dir" checkout -B "$BRANCH" "origin/${BRANCH}"
  fi
  git_as_app_user "$dir" reset --hard "origin/${BRANCH}"
}

select_checkout_source() {
  if [[ "$REPO_URL_SET" == "false" ]]; then
    if [[ "$APP_DIR_SET" == "false" && is_project_checkout "$LOCAL_REPO_DIR" ]]; then
      APP_DIR="$LOCAL_REPO_DIR"
      log "No --repo supplied; deploying current checkout at ${APP_DIR}."
    elif [[ "$APP_DIR_SET" == "false" && is_project_checkout "$INVOCATION_DIR" ]]; then
      APP_DIR="$INVOCATION_DIR"
      log "No --repo supplied; deploying current checkout at ${APP_DIR}."
    else
      REPO_URL="$DEFAULT_REPO_URL"
      log "No --repo supplied and current directory is not a checkout; using ${REPO_URL}."
    fi
  fi
}

checkout_code() {
  if [[ -d "${APP_DIR}/.git" ]]; then
    chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
    update_existing_checkout "$APP_DIR"
  elif [[ -n "$REPO_URL" ]]; then
    log "Cloning ${REPO_URL} (${BRANCH}) to ${APP_DIR}."
    mkdir -p "$(dirname "$APP_DIR")"
    if [[ -e "$APP_DIR" && -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]]; then
      fail "${APP_DIR} exists but is not a git checkout. Move it aside or choose --dir."
    fi
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  else
    fail "No repository URL or usable git checkout found."
  fi

  chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
}

env_key_exists() {
  local key="$1"
  local file="$2"
  grep -qE "^${key}=" "$file"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  local escaped

  escaped="$(printf '%s' "$value" | sed -e 's/[\\\/&]/\\&/g')"
  if env_key_exists "$key" "$file"; then
    sed -i "s/^${key}=.*/${key}=${escaped}/" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

ensure_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"

  if ! env_key_exists "$key" "$file"; then
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

set_or_ensure_env_value() {
  local key="$1"
  local value="$2"
  local was_supplied="$3"
  local file="$4"

  if [[ "$was_supplied" == "true" ]]; then
    set_env_value "$key" "$value" "$file"
  else
    ensure_env_value "$key" "$value" "$file"
  fi
}

get_env_value() {
  local key="$1"
  local file="$2"

  awk -v key="$key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
    }
    END {
      if (value != "") print value
    }
  ' "$file"
}

write_env_file() {
  local env_file="${APP_DIR}/.env"
  local effective_port

  log "Ensuring ${env_file}."
  if [[ ! -f "$env_file" ]]; then
    touch "$env_file"
  fi

  set_or_ensure_env_value "PORT" "$PORT" "$PORT_SET" "$env_file"
  set_or_ensure_env_value "API_BASE_URL" "$API_BASE_URL" "$API_BASE_URL_SET" "$env_file"
  set_or_ensure_env_value "CORS_ORIGIN" "$CORS_ORIGIN" "$CORS_ORIGIN_SET" "$env_file"
  set_or_ensure_env_value "MYSQL_HOST" "$MYSQL_HOST" "$MYSQL_HOST_SET" "$env_file"
  set_or_ensure_env_value "MYSQL_PORT" "$MYSQL_PORT" "$MYSQL_PORT_SET" "$env_file"
  set_or_ensure_env_value "MYSQL_USER" "$MYSQL_USER" "$MYSQL_USER_SET" "$env_file"
  set_or_ensure_env_value "MYSQL_DATABASE" "$MYSQL_DATABASE" "$MYSQL_DATABASE_SET" "$env_file"
  set_or_ensure_env_value "ADMIN_USERNAME" "$ADMIN_USERNAME" "$ADMIN_USERNAME_SET" "$env_file"

  ensure_env_value "NODE_ENV" "production" "$env_file"
  ensure_env_value "RATE_LIMIT_WINDOW_MS" "60000" "$env_file"
  ensure_env_value "RATE_LIMIT_MAX" "60" "$env_file"
  ensure_env_value "TASK_POLL_INITIAL_DELAY" "10000" "$env_file"
  ensure_env_value "TASK_POLL_INTERVAL" "3000" "$env_file"
  ensure_env_value "TASK_POLL_TIMEOUT" "180000" "$env_file"
  ensure_env_value "HTTP_REQUEST_TIMEOUT" "240000" "$env_file"
  ensure_env_value "MYSQL_CONNECTION_LIMIT" "10" "$env_file"
  ensure_env_value "OPENAI_API_KEY" "" "$env_file"
  ensure_env_value "MYSQL_PASSWORD" "" "$env_file"
  ensure_env_value "ADMIN_PASSWORD" "$ADMIN_PASSWORD" "$env_file"

  if [[ "$OPENAI_API_KEY_SET" == "true" ]]; then
    set_env_value "OPENAI_API_KEY" "$OPENAI_API_KEY" "$env_file"
  fi
  if [[ "$MYSQL_PASSWORD_SET" == "true" ]]; then
    set_env_value "MYSQL_PASSWORD" "$MYSQL_PASSWORD" "$env_file"
  fi
  if [[ "$ADMIN_PASSWORD_SET" == "true" ]]; then
    set_env_value "ADMIN_PASSWORD" "$ADMIN_PASSWORD" "$env_file"
  fi
  if [[ "$HTTPS_PROXY_URL_SET" == "true" ]]; then
    set_env_value "HTTPS_PROXY" "$HTTPS_PROXY_URL" "$env_file"
  fi

  effective_port="$(get_env_value "PORT" "$env_file" || true)"
  if [[ -n "$effective_port" ]]; then
    PORT="$effective_port"
  fi

  chmod 600 "$env_file"
  chown "${APP_USER}:${APP_USER}" "$env_file"
}

run_as_app_user() {
  sudo -H -u "$APP_USER" bash -lc "$*"
}

install_and_build() {
  local app_dir_q
  local client_dir_q
  local server_dir_q

  app_dir_q="$(shell_quote "$APP_DIR")"
  client_dir_q="$(shell_quote "${APP_DIR}/client")"
  server_dir_q="$(shell_quote "${APP_DIR}/server")"

  log "Installing npm dependencies and building."
  run_as_app_user "cd ${app_dir_q} && npm ci"
  run_as_app_user "cd ${client_dir_q} && npm ci"
  run_as_app_user "cd ${server_dir_q} && npm ci"
  run_as_app_user "cd ${app_dir_q} && npm run build"
  run_as_app_user "cd ${server_dir_q} && npm ci --omit=dev"

  mkdir -p "${APP_DIR}/server/data" "${APP_DIR}/server/public/generated"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/server/data" "${APP_DIR}/server/public"
}

install_systemd_service() {
  local node_bin
  local after_targets="network-online.target"

  node_bin="$(command -v node)"
  [[ -x "$node_bin" ]] || fail "node binary not found"

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
select_checkout_source
ensure_app_user
checkout_code
write_env_file
install_and_build
install_systemd_service
install_nginx_config
verify_service
