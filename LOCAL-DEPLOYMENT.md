# OpenAgent Framework - 本地部署指南

## 🚀 快速开始（5分钟）

### 方式 1: Docker Compose（推荐）

**前提条件**:
- Docker Desktop 已安装
- Docker Compose 已安装

**步骤**:

```bash
# 1. 进入项目目录
cd projects/openagent-framework

# 2. 启动所有服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f openagent

# 4. 访问服务
# 打开浏览器: http://localhost:3000
```

**停止服务**:
```bash
docker-compose down
```

---

### 方式 2: Docker Compose（开发模式）

**特点**: 支持热重载、实时调试

```bash
# 1. 启动开发环境
docker-compose -f docker-compose.dev.yml up -d

# 2. 查看日志
docker-compose -f docker-compose.dev.yml logs -f

# 3. 访问服务
# 主服务: http://localhost:3000
# Adminer (数据库管理): http://localhost:8080
# Redis Commander: http://localhost:8081
```

**使用开发工具**:
```bash
# 启动时包含管理工具
docker-compose -f docker-compose.dev.yml --profile tools up -d
```

---

### 方式 3: Docker Compose（完整监控）

**包含 Prometheus + Grafana 监控**

```bash
# 1. 启动完整堆栈
docker-compose --profile monitoring up -d

# 2. 访问服务
# OpenAgent: http://localhost:3000
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
```

---

## 📦 本地开发环境

### 1. 不使用 Docker（直接运行）

**前提条件**:
- Node.js 20+
- PostgreSQL 16+
- Redis 7+

**步骤**:

```bash
# 1. 安装依赖
cd code
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库和 Redis

# 3. 初始化数据库
npm run db:migrate

# 4. 启动服务
npm run dev

# 5. 访问服务
# 打开浏览器: http://localhost:3000
```

---

## 🔧 配置说明

### 环境变量

创建 `.env` 文件：

```env
# 服务配置
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# 数据库配置
DATABASE_URL=postgresql://openagent:openagent@localhost:5432/openagent

# Redis 配置
REDIS_URL=redis://localhost:6379

# LLM API Keys（至少配置一个）
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
DEEPSEEK_API_KEY=sk-xxx

# 权限配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# 监控配置（可选）
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9091
```

---

## 🐛 常见问题

### 1. 端口被占用

**问题**: `Error: port 3000 already in use`

**解决**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# 或修改 docker-compose.yml 中的端口映射
ports:
  - "3001:3000"  # 改为其他端口
```

### 2. 数据库连接失败

**问题**: `Connection refused to database`

**解决**:
```bash
# 检查 PostgreSQL 是否运行
docker-compose ps postgres

# 查看日志
docker-compose logs postgres

# 重启服务
docker-compose restart postgres
```

### 3. Redis 连接失败

**问题**: `Redis connection failed`

**解决**:
```bash
# 检查 Redis 是否运行
docker-compose ps redis

# 测试连接
docker-compose exec redis redis-cli ping
```

### 4. Docker 卷权限问题

**问题**: `Permission denied` on volumes

**解决** (Windows):
```bash
# 重置 Docker 卷
docker-compose down -v
docker-compose up -d
```

---

## 📊 服务访问地址

### 核心服务
- **OpenAgent API**: http://localhost:3000
- **API 文档**: http://localhost:3000/docs
- **健康检查**: http://localhost:3000/health

### 数据库
- **PostgreSQL**: localhost:5432
  - 用户名: openagent
  - 密码: openagent
  - 数据库: openagent

### 缓存
- **Redis**: localhost:6379

### 管理工具（开发模式）
- **Adminer**: http://localhost:8080
  - 系统: PostgreSQL
  - 服务器: postgres
  - 用户名: openagent
  - 密码: openagent
  - 数据库: openagent_dev

- **Redis Commander**: http://localhost:8081

### 监控（完整模式）
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
  - 用户名: admin
  - 密码: admin

---

## 🚀 开发工作流

### 1. 日常开发

```bash
# 1. 启动开发环境
docker-compose -f docker-compose.dev.yml up -d

# 2. 修改代码（支持热重载）
# 编辑 code/ 目录下的文件

# 3. 查看日志
docker-compose -f docker-compose.dev.yml logs -f openagent

# 4. 运行测试
docker-compose -f docker-compose.dev.yml exec openagent npm test

# 5. 停止服务
docker-compose -f docker-compose.dev.yml down
```

### 2. 数据库迁移

```bash
# 创建迁移
docker-compose exec openagent npm run db:migrate:create

# 运行迁移
docker-compose exec openagent npm run db:migrate

# 回滚迁移
docker-compose exec openagent npm run db:migrate:undo
```

### 3. 调试

```bash
# 进入容器
docker-compose exec openagent sh

# 查看日志
docker-compose logs -f openagent

# 检查服务状态
docker-compose ps
```

---

## 🔐 安全注意事项

### 本地开发环境

1. **修改默认密码**:
   ```yaml
   # docker-compose.yml
   environment:
     - POSTGRES_PASSWORD=your-strong-password
     - REDIS_PASSWORD=your-strong-password
   ```

2. **不要提交 .env 文件**:
   ```bash
   # 添加到 .gitignore
   .env
   .env.local
   ```

3. **使用环境变量**:
   ```bash
   # 创建 .env.local 用于本地配置
   cp .env.example .env.local
   ```

---

## 📈 性能优化

### 1. Docker 性能

**Windows/Mac**:
```yaml
# docker-compose.yml
services:
  openagent:
    volumes:
      - ./code:/app:cached  # 使用缓存
```

### 2. 数据库优化

```sql
-- 连接池配置
ALTER SYSTEM SET max_connections = 200;

-- 共享缓冲区
ALTER SYSTEM SET shared_buffers = '256MB';
```

### 3. Redis 优化

```bash
# 在 redis.conf 中配置
maxmemory 256mb
maxmemory-policy allkeys-lru
```

---

## 🎯 完整示例

### 启动所有服务（一键脚本）

**Windows** (`start-local.bat`):
```batch
@echo off
echo Starting OpenAgent Framework...

REM 停止旧服务
docker-compose down

REM 启动服务
docker-compose up -d

REM 等待服务启动
timeout /t 10

REM 检查状态
docker-compose ps

echo OpenAgent is running at http://localhost:3000
pause
```

**Linux/Mac** (`start-local.sh`):
```bash
#!/bin/bash
echo "Starting OpenAgent Framework..."

# 停止旧服务
docker-compose down

# 启动服务
docker-compose up -d

# 等待服务启动
sleep 10

# 检查状态
docker-compose ps

echo "OpenAgent is running at http://localhost:3000"
```

---

## 🎊 总结

**推荐使用**:
- **快速体验**: `docker-compose up -d`
- **日常开发**: `docker-compose -f docker-compose.dev.yml up -d`
- **完整监控**: `docker-compose --profile monitoring up -d`

**访问地址**:
- 主服务: http://localhost:3000
- 数据库管理: http://localhost:8080
- Redis 管理: http://localhost:8081
- 监控: http://localhost:3001

---

**本地部署完成！开始使用 OpenAgent Framework 吧！** 🚀
