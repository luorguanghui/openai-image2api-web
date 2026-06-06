# OpenAI Image2API Web - 部署文档

## 服务器信息

- **服务器系统**: Ubuntu 22.04 (阿里云)
- **服务器 IP**: 121.43.100.214
- **项目目录**: `/opt/openai-image2api-web`
- **服务用户**: `image2api`
- **服务端口**: 3001
- **访问地址**: `http://121.43.100.214:3001`
- **systemd 服务名**: `openai-image2api-web.service`
- **Node.js 版本**: 20.x
- **Clash 代理**: 已配置（端口 7890），用于访问 API 中转站
- **Git 仓库**: `https://github.com/luorguanghui/openai-image2api-web.git`

---

## 一、首次部署流程

### 1. 打包本地代码

在本地 Windows PowerShell 执行：

```powershell
cd C:\Users\123\Desktop\agents
tar -czf openai-image2api-web.tar.gz --exclude="node_modules" --exclude=".git" openai-image2api-web
```

### 2. 上传到服务器

```powershell
scp C:\Users\123\Desktop\agents\openai-image2api-web.tar.gz root@121.43.100.214:/tmp/
```

### 3. 在服务器上解压并部署

```bash
# 解压
cd /tmp
tar -xzf openai-image2api-web.tar.gz

# 停止旧服务（如果有）
sudo systemctl stop openai-image2api-web 2>/dev/null || true

# 复制到安装目录
sudo rm -rf /opt/openai-image2api-web
sudo cp -r /tmp/openai-image2api-web /opt/openai-image2api-web

# 创建数据目录
sudo mkdir -p /opt/openai-image2api-web/server/data
sudo mkdir -p /opt/openai-image2api-web/server/public/generated

# 创建服务用户
sudo useradd --system --home-dir /opt/openai-image2api-web --shell /usr/sbin/nologin image2api 2>/dev/null || true

# 设置目录权限
sudo chown -R image2api:image2api /opt/openai-image2api-web
```

### 4. 配置 .env 文件

```bash
cat <<'EOF' | sudo tee /opt/openai-image2api-web/.env
PORT=3001
NODE_ENV=production
API_BASE_URL=https://api.apimart.ai
OPENAI_API_KEY=你的API密钥
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
TASK_POLL_INITIAL_DELAY=10000
TASK_POLL_INTERVAL=3000
TASK_POLL_TIMEOUT=180000
HTTP_REQUEST_TIMEOUT=240000
HTTPS_PROXY=http://127.0.0.1:7890
EOF

sudo chmod 600 /opt/openai-image2api-web/.env
sudo chown image2api:image2api /opt/openai-image2api-web/.env
```

### 5. 安装依赖并构建

```bash
# 根目录依赖
cd /opt/openai-image2api-web
sudo -u image2api npm ci

# 前端依赖
cd /opt/openai-image2api-web/client
sudo -u image2api npm ci

# 后端依赖（含 dev，用于编译）
cd /opt/openai-image2api-web/server
sudo -u image2api npm ci

# 构建前端 + 后端
cd /opt/openai-image2api-web
sudo -u image2api npm run build

# 后端切换为生产依赖（去掉 TypeScript 等 dev 依赖）
cd /opt/openai-image2api-web/server
sudo -u image2api npm ci --omit=dev
```

### 6. 创建 systemd 服务

```bash
sudo tee /etc/systemd/system/openai-image2api-web.service <<'SERVICE'
[Unit]
Description=OpenAI Image2API Web
After=network-online.target clash.service
Wants=network-online.target

[Service]
Type=simple
User=image2api
Group=image2api
WorkingDirectory=/opt/openai-image2api-web/server
EnvironmentFile=/opt/openai-image2api-web/.env
ExecStart=/usr/bin/node /opt/openai-image2api-web/server/dist/index.js
Restart=always
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/opt/openai-image2api-web/server/data /opt/openai-image2api-web/server/public/generated

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable openai-image2api-web.service
sudo systemctl start openai-image2api-web.service
```

### 7. 验证部署

```bash
# 检查服务状态
sudo systemctl status openai-image2api-web

# 健康检查
curl http://127.0.0.1:3001/api/health

# 检查 CSP 头（确保没有 upgrade-insecure-requests）
curl -sI http://127.0.0.1:3001/ | grep -i content-security

# 查看日志确认代理生效（应显示 "[proxy] 已启用代理: http://127.0.0.1:7890"）
sudo journalctl -u openai-image2api-web -n 20 --no-pager
```

---

## 二、日常更新流程（代码更新后重新部署）

### ⚡ 快速更新（推荐）

在本地 Windows PowerShell 一键打包上传：

```powershell
# 1. 打包
cd C:\Users\123\Desktop\agents
tar -czf openai-image2api-web.tar.gz --exclude="node_modules" --exclude=".git" openai-image2api-web

# 2. 上传
scp openai-image2api-web.tar.gz root@121.43.100.214:/tmp/
```

然后在服务器上执行（复制整段粘贴）：

```bash
# 停止服务
sudo systemctl stop openai-image2api-web

# 解压并覆盖
cd /tmp && tar -xzf openai-image2api-web.tar.gz
sudo cp -r /tmp/openai-image2api-web/* /opt/openai-image2api-web/
sudo chown -R image2api:image2api /opt/openai-image2api-web

# 重新构建
cd /opt/openai-image2api-web && sudo -u image2api npm ci
cd /opt/openai-image2api-web/client && sudo -u image2api npm ci
cd /opt/openai-image2api-web/server && sudo -u image2api npm ci
cd /opt/openai-image2api-web && sudo -u image2api npm run build
cd /opt/openai-image2api-web/server && sudo -u image2api npm ci --omit=dev

# 重启
sudo systemctl restart openai-image2api-web
```

### 方式 A：只更新前端代码

```bash
sudo systemctl stop openai-image2api-web
cd /opt/openai-image2api-web
sudo -u image2api npm run build:client
sudo systemctl restart openai-image2api-web
```

### 方式 B：只更新后端代码

```bash
sudo systemctl stop openai-image2api-web
cd /opt/openai-image2api-web/server
sudo -u image2api npm ci
cd /opt/openai-image2api-web
sudo -u image2api npm run build:server
cd /opt/openai-image2api-web/server
sudo -u image2api npm ci --omit=dev
sudo systemctl restart openai-image2api-web
```

---

## 三、服务管理命令

```bash
# 查看服务状态
sudo systemctl status openai-image2api-web

# 启动服务
sudo systemctl start openai-image2api-web

# 停止服务
sudo systemctl stop openai-image2api-web

# 重启服务
sudo systemctl restart openai-image2api-web

# 查看实时日志
sudo journalctl -u openai-image2api-web -f

# 查看最近 50 行日志
sudo journalctl -u openai-image2api-web -n 50 --no-pager
```

---

## 四、Clash 代理配置

服务器无法直接访问 API 中转站（`api.apimart.ai`），需要通过 Clash 代理转发。

### Clash 信息

- **安装路径**: `/usr/local/bin/clash`
- **配置文件**: `/etc/clash/config.yaml`
- **代理端口**: 7890（HTTP）
- **systemd 服务名**: `clash.service`
- **配置文件来源**: 本地 `C:\Users\123\Desktop\agents\deploy-fix\clash-config.yaml`

### Clash 管理命令

```bash
# 查看状态
sudo systemctl status clash

# 重启
sudo systemctl restart clash

# 查看日志
sudo journalctl -u clash -n 20 --no-pager

# 测试代理是否可用
curl -x http://127.0.0.1:7890 -sI --connect-timeout 10 https://api.apimart.ai | head -5
```

### 更新 Clash 配置

如果代理节点失效，更新配置文件：

```powershell
# 本地上传新配置
scp C:\Users\123\Desktop\agents\deploy-fix\clash-config.yaml root@121.43.100.214:/etc/clash/config.yaml
```

```bash
# 服务器上重启
sudo systemctl restart clash
```

### Clash 配置说明

精简版配置，只代理 API 流量，其他直连：

```yaml
rules:
    - 'DOMAIN-SUFFIX,apimart.ai,API代理'
    - 'DOMAIN-SUFFIX,openai.com,API代理'
    - 'MATCH,DIRECT'
```

### 升级 Clash 内核

```powershell
# 本地下载最新版（从 https://github.com/MetaCubeX/mihomo/releases 获取）
Invoke-WebRequest -Uri "https://ghfast.top/https://github.com/MetaCubeX/mihomo/releases/download/版本号/mihomo-linux-amd64-版本号.gz" -OutFile "C:\Users\123\Desktop\agents\mihomo.gz"
scp C:\Users\123\Desktop\agents\mihomo.gz root@121.43.100.214:/tmp/mihomo.gz
```

```bash
# 服务器上替换
sudo systemctl stop clash
cd /tmp && chmod -t mihomo.gz && gunzip mihomo.gz && chmod +x mihomo
sudo mv mihomo /usr/local/bin/clash
sudo systemctl start clash
```

---

## 五、配置说明

### .env 环境变量

| 变量名 | 说明 | 当前值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3001` |
| `NODE_ENV` | 运行环境 | `production` |
| `API_BASE_URL` | API 基础地址 | `https://api.apimart.ai` |
| `OPENAI_API_KEY` | API 密钥 | （已配置） |
| `CORS_ORIGIN` | CORS 允许来源 | `*` |
| `RATE_LIMIT_WINDOW_MS` | 速率限制窗口（毫秒） | `60000` |
| `RATE_LIMIT_MAX` | 窗口内最大请求数 | `60` |
| `TASK_POLL_INITIAL_DELAY` | 任务轮询首次延迟（毫秒） | `10000` |
| `TASK_POLL_INTERVAL` | 任务轮询间隔（毫秒） | `3000` |
| `TASK_POLL_TIMEOUT` | 任务轮询超时（毫秒） | `180000` |
| `HTTP_REQUEST_TIMEOUT` | HTTP 请求超时（毫秒） | `240000` |
| `HTTPS_PROXY` | HTTP 代理地址 | `http://127.0.0.1:7890` |

修改 .env 后需重启服务生效：

```bash
sudo systemctl restart openai-image2api-web
```

---

## 六、已知问题与修复记录

### 1. CSP `upgrade-insecure-requests` 导致白页

**问题**: helmet 默认在 CSP 头中添加 `upgrade-insecure-requests`，导致浏览器将 HTTP 请求升级为 HTTPS，但服务器只监听 HTTP，造成 JS/CSS 加载失败（`ERR_SSL_PROTOCOL_ERROR`）。

**修复**: 在 `server/src/index.ts` 中禁用 helmet 默认 CSP，改为手动设置（不包含 `upgrade-insecure-requests`）。

### 2. GitHub 访问问题

服务器无法直接访问 GitHub（GnuTLS 错误），需要通过本地打包上传的方式部署。

### 3. API 中转站访问问题

阿里云国内服务器无法直接访问 `api.apimart.ai`（海外 IP），通过 Clash 代理解决。Node.js 使用 `undici` 的 `ProxyAgent` 通过 `HTTPS_PROXY` 环境变量走代理。

---

## 七、目录结构

```
/opt/openai-image2api-web/
├── .env                          # 环境变量配置
├── package.json                  # 根 package.json
├── client/                       # 前端代码
│   ├── src/                      # 前端源码
│   └── dist/                     # 前端构建产物
├── server/                       # 后端代码
│   ├── src/                      # 后端源码（TypeScript）
│   │   ├── index.ts              # 入口文件（含代理初始化）
│   │   ├── config/env.ts         # 配置
│   │   ├── routes/               # API 路由
│   │   ├── middlewares/          # 中间件
│   │   └── utils/
│   │       ├── proxy.ts          # HTTP 代理支持
│   │       ├── file.ts           # 文件工具
│   │       └── sanitize.ts       # 日志工具
│   ├── dist/                     # 后端编译产物（JavaScript）
│   ├── data/                     # 数据存储目录
│   ├── public/generated/         # 生成的图片存储
│   └── package.json
└── scripts/                      # 部署脚本
    └── deploy-ubuntu.sh
```

---

## 八、本地部署工具文件

本地维护的部署辅助文件位于 `C:\Users\123\Desktop\agents\deploy-fix\`：

```
deploy-fix/
├── clash-config.yaml             # Clash 精简配置（服务器专用）
└── server/src/
    ├── index.ts                  # 修复了 CSP + 代理初始化的入口文件
    └── utils/
        └── proxy.ts              # undici ProxyAgent 代理模块
```

---

## 九、可选：配置 Nginx 反向代理 + HTTPS

如果需要域名访问和 HTTPS：

```bash
sudo apt-get install -y nginx

sudo tee /etc/nginx/sites-available/openai-image2api-web <<'NGINX'
server {
    listen 80;
    server_name 你的域名.com;
    client_max_body_size 20M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 256;
    gzip_vary on;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 240s;
        proxy_read_timeout 240s;
    }
    location ~ /\. { deny all; }
}
NGINX

sudo ln -sfn /etc/nginx/sites-available/openai-image2api-web /etc/nginx/sites-enabled/openai-image2api-web
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# SSL 证书
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com
```
