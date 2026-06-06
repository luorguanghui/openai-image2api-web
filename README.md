# OpenAI Image2API Web Tool

一个方便调用 OpenAI 图像生成接口的网页应用。

## 功能特性

- 支持输入 OpenAI API Key
- 自定义 Prompt 生成图片
- 选择图像生成模型
- 选择图片尺寸、质量、输出格式
- 设置透明背景
- 批量生成多张图片
- 图片预览、下载、复制 Base64
- 历史记录查看和清空
- 友好的中文错误提示
- 支持 Ubuntu / Docker / PM2 部署

## 技术栈

- **前端**: React + Vite + TypeScript + Tailwind CSS
- **后端**: Node.js + Express + TypeScript
- **API**: OpenAI Node SDK
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

# 编辑 .env，填入你的 OpenAI API Key
# OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. 启动开发服务器

```bash
# 终端1: 启动后端 (端口 3001)
cd server
npm run dev

# 终端2: 启动前端 (端口 5173)
cd client
npm run dev
```

访问 http://localhost:5173 即可使用。

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
| `OPENAI_API_KEY` | OpenAI API Key | (必填) |
| `PORT` | 后端服务端口 | 3001 |
| `CLIENT_ORIGIN` | 前端跨域来源 | http://localhost:5173 |
| `SAVE_HISTORY` | 是否保存历史 | true |
| `NODE_ENV` | 运行环境 | production |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
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

- API Key 不会写入代码或 localStorage
- 用户临时 API Key 仅用于当前请求
- 日志中不打印 API Key
- 错误信息不暴露服务器敏感信息

## 许可证

MIT
