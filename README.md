# OpenAI Image2API Web Tool

一个方便调用 OpenAI 图像生成接口的网页应用。

## 功能特性

- 用户登录与管理员权限
- 管理员配置全局 API Key，用户可配置个人 API Key（个人 Key 优先）
- 用户启停与用户 API Key 启用开关
- 自定义 Prompt 生成图片
- 对话式展示每轮生成/调整提示词和结果
- 选择图像生成模型
- 选择图片尺寸、质量、输出格式
- 设置透明背景
- 批量生成多张图片
- 图片预览、下载、复制 Base64
- 历史记录按用户隔离，管理员可查看全部
- APIMart Token 余额查询
- 友好的中文错误提示
- 支持 Ubuntu / Docker / PM2 部署

## 技术栈

- **前端**: React + Vite + TypeScript + Tailwind CSS
- **后端**: Node.js + Express + TypeScript + MySQL
- **API**: APIMart / OpenAI 兼容图像接口
- **部署**: Ubuntu + PM2 / Docker / Nginx

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env，填入 MySQL 连接信息和首个管理员账号
# 管理员登录后可在页面中设置全局 API Key
```

### 3. 启动开发服务器

```bash
# Windows 本地开发会先尝试自动启动本机 MySQL，再启动前后端
npm run dev
```

访问 http://localhost:5173 即可使用。

首次本地启动时，项目会使用 `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe`
和用户目录下的 `openai-image2api-mysql` 数据目录启动一个只监听 `127.0.0.1:3306` 的开发 MySQL。
如果你已经有自己的 MySQL，只要它监听 `.env` 中的 `MYSQL_HOST` / `MYSQL_PORT`，自动脚本会跳过启动。

### 4. 构建生产版本

```bash
# 构建前端
cd client
npm run build

# 构建后端
cd ../server
npm run build
```

## 部署方式

### 方式一: PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
cd server
pm2 start dist/index.js --name image2api-server

# 设置开机自启
pm2 save
pm2 startup
```

### 方式二: Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 方式三: Ubuntu + Nginx

详见 `nginx.conf.example` 和部署文档。

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | 兼容旧部署的环境变量 API Key fallback | 空 |
| `API_BASE_URL` | 上游 API 基础 URL | https://api.apimart.ai |
| `PORT` | 后端服务端口 | 3001 |
| `CORS_ORIGIN` | 前端跨域来源 | 空 |
| `NODE_ENV` | 运行环境 | production |
| `MYSQL_HOST` | MySQL 主机 | 127.0.0.1 |
| `MYSQL_PORT` | MySQL 端口 | 3306 |
| `MYSQL_USER` | MySQL 用户 | root |
| `MYSQL_PASSWORD` | MySQL 密码 | 空 |
| `MYSQL_DATABASE` | MySQL 数据库名 | openai_image2api |
| `ADMIN_USERNAME` | 首次启动创建的管理员用户名 | admin |
| `ADMIN_PASSWORD` | 首次启动创建的管理员密码 | admin123 |
| `SESSION_TTL_HOURS` | 登录会话有效期（小时） | 168 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/register` | 用户自助注册 |
| GET | `/api/auth/me` | 获取当前用户 |
| PUT | `/api/account/api-key` | 保存个人 API Key |
| GET | `/api/account/balance` | 查询当前有效 Key 余额 |
| PATCH | `/api/admin/settings` | 管理员设置全局 Key 和用户 Key 开关 |
| GET/POST/PATCH | `/api/admin/users` | 管理用户 |
| POST | `/api/generate-image` | 生成图片 |
| GET | `/api/history` | 获取历史记录 |
| DELETE | `/api/history` | 清空历史记录 |
| GET | `/api/health` | 健康检查 |

## 项目结构

```
openai-image2api-web/
├── client/          # 前端 (React + Vite + TypeScript)
├── server/          # 后端 (Node.js + Express + TypeScript)
├── .env.example     # 环境变量模板
├── Dockerfile       # Docker 构建文件
├── docker-compose.yml
├── nginx.conf.example
└── README.md
```

## 安全说明

- API Key 不会写入代码或浏览器 localStorage
- 用户个人 API Key 和管理员全局 API Key 存在 MySQL 中，生成时服务端读取
- 日志中不打印 API Key
- 错误信息不暴露服务器敏感信息

## 许可证

MIT
