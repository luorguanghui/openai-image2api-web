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
INSTALL_MYSQL="false"
ADMIN_USERNAME="admin"
ADMIN_USERNAME_SET="false"
ADMIN_PASSWORD="admin123"
ADMIN_PASSWORD_SET="false"
BACKUP_EXISTING="false"
EXISTING_APP_BACKUP_DIR=""

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
  --install-mysql         Install local MySQL server and create database/user.
                          If --mysql-user/--mysql-password are omitted, the
                          script uses the service user and generates a password.
  --admin-username USER   Initial admin username. Default: preserves .env, or admin.
  --admin-password PASS   Initial admin password. Preserved unless explicitly supplied.
  --domain DOMAIN         Domain used for nginx server_name.
  --install-nginx         Install and configure nginx reverse proxy.
  --https-proxy URL       Set HTTPS proxy for API requests (e.g. http://127.0.0.1:7890).
  --backup-existing       If --dir exists but is not a git checkout, move it to
                          a timestamped backup before cloning.
  -h, --help              Show this help.

Examples:
  sudo bash scripts/deploy-ubuntu.sh
  sudo bash scripts/deploy-ubuntu.sh --repo https://github.com/luorguanghui/openai-image2api-web.git
  sudo bash scripts/deploy-ubuntu.sh --domain img.example.com --install-nginx
  sudo bash scripts/deploy-ubuntu.sh --install-mysql --admin-password 'change-me'
  sudo bash scripts/deploy-ubuntu.sh --mysql-password 'change-me' --admin-password 'change-me-too'
  sudo bash scripts/deploy-ubuntu.sh --https-proxy http://127.0.0.1:7890
  sudo bash scripts/deploy-ubuntu.sh --backup-existing
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
    --install-mysql)
      INSTALL_MYSQL="true"
      shift
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
    --backup-existing)
      BACKUP_EXISTING="true"
      shift
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

SCRIPT_SOURCE=""
if [[ ${BASH_SOURCE+x} && ${BASH_SOURCE[0]+x} ]]; then
  SCRIPT_SOURCE="${BASH_SOURCE[0]}"
fi

SCRIPT_DIR=""
LOCAL_REPO_DIR=""
if [[ -n "$SCRIPT_SOURCE" && "$SCRIPT_SOURCE" != "bash" && "$SCRIPT_SOURCE" != "-s" && -e "$SCRIPT_SOURCE" ]]; then
  SCRIPT_DIR="$(cd -- "$(dirname -- "$SCRIPT_SOURCE")" && pwd)"
  LOCAL_REPO_DIR="$(cd -- "${SCRIPT_DIR}/.." 2>/dev/null && pwd || true)"
fi
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
  apt-get install -y git curl build-essential sudo iproute2
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

generate_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 30 | tr -d '\r\n' | tr '/+' '_-'
    return
  fi

  local generated
  set +o pipefail
  generated="$(tr -dc 'A-Za-z0-9_-' < /dev/urandom | head -c 40)"
  set -o pipefail
  printf '%s' "$generated"
}

assert_safe_mysql_database() {
  [[ "$MYSQL_DATABASE" =~ ^[A-Za-z0-9_]+$ ]] || fail "MYSQL database name can only contain letters, numbers, and underscores."
}

assert_safe_mysql_account() {
  [[ "$MYSQL_USER" =~ ^[A-Za-z0-9_.-]+$ ]] || fail "MYSQL user can only contain letters, numbers, underscores, dots, and hyphens."
}

sql_string() {
  local value="$1"
  value="${value//\'/\'\'}"
  printf "'%s'" "$value"
}

ensure_local_mysql() {
  [[ "$INSTALL_MYSQL" == "true" ]] || return 0

  if [[ "$MYSQL_HOST" != "127.0.0.1" && "$MYSQL_HOST" != "localhost" ]]; then
    fail "--install-mysql can only manage a local MySQL host. Use --mysql-host 127.0.0.1 or configure the remote database yourself."
  fi

  if [[ "$MYSQL_USER_SET" == "false" ]]; then
    MYSQL_USER="$APP_USER"
    MYSQL_USER_SET="true"
  fi
  if [[ "$MYSQL_PASSWORD_SET" == "false" ]]; then
    MYSQL_PASSWORD="$(generate_password)"
    MYSQL_PASSWORD_SET="true"
  fi

  assert_safe_mysql_database
  assert_safe_mysql_account

  log "Installing and preparing local MySQL."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
  systemctl enable --now mysql

  if ! command -v mysql >/dev/null 2>&1; then
    fail "mysql client was not installed successfully."
  fi

  local user_sql
  local password_sql
  local localhost_sql
  local loopback_sql
  user_sql="$(sql_string "$MYSQL_USER")"
  password_sql="$(sql_string "$MYSQL_PASSWORD")"
  localhost_sql="$(sql_string "localhost")"
  loopback_sql="$(sql_string "127.0.0.1")"

  mysql --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS ${user_sql}@${localhost_sql} IDENTIFIED BY ${password_sql};
ALTER USER ${user_sql}@${localhost_sql} IDENTIFIED BY ${password_sql};
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO ${user_sql}@${localhost_sql};
CREATE USER IF NOT EXISTS ${user_sql}@${loopback_sql} IDENTIFIED BY ${password_sql};
ALTER USER ${user_sql}@${loopback_sql} IDENTIFIED BY ${password_sql};
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO ${user_sql}@${loopback_sql};
FLUSH PRIVILEGES;
SQL

  log "Local MySQL is ready for user ${MYSQL_USER} and database ${MYSQL_DATABASE}."
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
    if [[ "$APP_DIR_SET" == "false" ]] && is_project_checkout "$LOCAL_REPO_DIR"; then
      APP_DIR="$LOCAL_REPO_DIR"
      log "No --repo supplied; deploying current checkout at ${APP_DIR}."
    elif [[ "$APP_DIR_SET" == "false" ]] && is_project_checkout "$INVOCATION_DIR"; then
      APP_DIR="$INVOCATION_DIR"
      log "No --repo supplied; deploying current checkout at ${APP_DIR}."
    else
      REPO_URL="$DEFAULT_REPO_URL"
      log "No --repo supplied and current directory is not a checkout; using ${REPO_URL}."
    fi
  fi
}

backup_existing_app_dir() {
  if [[ "$BACKUP_EXISTING" != "true" ]]; then
    fail "${APP_DIR} exists but is not a git checkout. Re-run with --backup-existing to move it aside automatically, or choose --dir."
  fi

  local stamp
  local backup_dir

  stamp="$(date +'%Y%m%d%H%M%S')"
  backup_dir="${APP_DIR}.backup.${stamp}"
  while [[ -e "$backup_dir" ]]; do
    sleep 1
    stamp="$(date +'%Y%m%d%H%M%S')"
    backup_dir="${APP_DIR}.backup.${stamp}"
  done

  log "Backing up existing ${APP_DIR} to ${backup_dir}."
  mv "$APP_DIR" "$backup_dir"
  EXISTING_APP_BACKUP_DIR="$backup_dir"
}

restore_backup_artifacts() {
  [[ -n "$EXISTING_APP_BACKUP_DIR" ]] || return 0

  log "Restoring preserved runtime files from ${EXISTING_APP_BACKUP_DIR}."
  if [[ -f "${EXISTING_APP_BACKUP_DIR}/.env" && ! -f "${APP_DIR}/.env" ]]; then
    cp -a "${EXISTING_APP_BACKUP_DIR}/.env" "${APP_DIR}/.env"
  fi

  local path
  for path in "server/data" "server/public/generated"; do
    if [[ -e "${EXISTING_APP_BACKUP_DIR}/${path}" && ! -e "${APP_DIR}/${path}" ]]; then
      mkdir -p "$(dirname -- "${APP_DIR}/${path}")"
      cp -a "${EXISTING_APP_BACKUP_DIR}/${path}" "${APP_DIR}/${path}"
    fi
  done
}

checkout_code() {
  if [[ -d "${APP_DIR}/.git" ]]; then
    chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
    update_existing_checkout "$APP_DIR"
  elif [[ -n "$REPO_URL" ]]; then
    log "Cloning ${REPO_URL} (${BRANCH}) to ${APP_DIR}."
    mkdir -p "$(dirname "$APP_DIR")"
    if [[ -e "$APP_DIR" ]]; then
      if [[ ! -d "$APP_DIR" || -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]]; then
        backup_existing_app_dir
      fi
    fi
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    restore_backup_artifacts
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
  systemctl stop "${APP_NAME}.service" >/dev/null 2>&1 || true
  ensure_port_available
  systemctl restart "${APP_NAME}.service"
}

ensure_port_available() {
  if ! command -v ss >/dev/null 2>&1; then
    log "Warning: ss command not found; skipping port ${PORT} preflight."
    return
  fi

  local listeners
  listeners="$(ss -H -ltnp "sport = :${PORT}" 2>/dev/null || true)"
  if [[ -n "$listeners" ]]; then
    printf '%s\n' "$listeners" >&2
    fail "Port ${PORT} is already in use by another process. Stop it or deploy with --port <free-port>."
  fi
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
ensure_local_mysql
checkout_code
write_env_file
install_and_build
install_systemd_service
install_nginx_config
verify_service
