# 安装指南

本文档详细介绍 OpenAgent Framework 的各种安装方式，帮助您快速部署和运行。

## 📋 系统要求

### 必需环境

| 组件 | 版本要求 | 说明 |
|------|---------|------|
| **Node.js** | 20.x 或更高 | 运行时环境 |
| **npm** | 10.x 或更高 | 包管理器 |
| **Docker** | 24.x+（可选） | 容器化部署 |
| **Docker Compose** | 2.x+（可选） | 多容器编排 |

### 可选组件

| 组件 | 版本要求 | 用途 |
|------|---------|------|
| **PostgreSQL** | 16+ | 生产环境数据库 |
| **Redis** | 7+ | 缓存和会话存储 |

### 操作系统支持

- ✅ Windows 10/11
- ✅ macOS 11+
- ✅ Ubuntu 20.04+
- ✅ Debian 11+

### 硬件要求

| 场景 | CPU | 内存 | 存储 |
|------|-----|------|------|
| 开发环境 | 2核 | 4GB | 10GB |
| 生产环境（轻量） | 4核 | 8GB | 50GB |
| 生产环境（标准） | 8核 | 16GB | 100GB |

---

## 🚀 方式 1: Docker Compose（推荐）

**最快速的部署方式，包含所有依赖服务。**

### 1.1 安装 Docker

#### Windows
```powershell
# 下载并安装 Docker Desktop
# https://www.docker.com/products/docker-desktop

# 验证安装
docker --version
docker-compose --version
```

#### macOS
```bash
# 使用 Homebrew
brew install --cask docker

# 或下载 Docker Desktop
# https://www.docker.com/products/docker-desktop
```

#### Linux (Ubuntu)
```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 添加当前用户到 docker 组
sudo usermod -aG docker $USER
```

### 1.2 克隆项目

```bash
# 克隆仓库
git clone https://github.com/your-org/openagent-framework.git
cd openagent-framework
```

### 1.3 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
nano .env  # Linux/Mac
notepad .env  # Windows
```

**必需配置项：**

```env
# 至少配置一个 LLM API Key
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
# 或
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

**完整配置示例：**

```env
# 服务配置
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# 数据库配置（Docker 自动配置）
DATABASE_URL=postgresql://openagent:openagent@postgres:5432/openagent

# Redis 配置（Docker 自动配置）
REDIS_URL=redis://redis:6379

# LLM API Keys
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx

# 权限配置
JWT_SECRET=your-very-secure-secret-key-change-this
JWT_EXPIRES_IN=7d

# 监控配置（可选）
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9091
```

### 1.4 启动服务

#### 基础模式（仅核心服务）

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f openagent

# 查看服务状态
docker-compose ps
```

#### 开发模式（包含管理工具）

```bash
# 启动开发环境（支持热重载）
docker-compose -f docker-compose.dev.yml up -d

# 包含管理工具
docker-compose -f docker-compose.dev.yml --profile tools up -d
```

**开发模式包含的工具：**
- Adminer: http://localhost:8080 (数据库管理)
- Redis Commander: http://localhost:8081 (Redis 管理)

#### 完整模式（包含监控）

```bash
# 启动完整堆栈（Prometheus + Grafana）
docker-compose --profile monitoring up -d

# 访问监控
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
```

### 1.5 验证安装

```bash
# 检查服务健康
curl http://localhost:3000/health

# 预期响应
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "connected",
    "llm": "configured"
  }
}
```

### 1.6 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（清空数据）
docker-compose down -v
```

---

## 📦 方式 2: NPM 安装

**适合集成到现有 Node.js 项目。**

### 2.1 安装核心包

```bash
# 创建项目目录
mkdir my-agent-app
cd my-agent-app
npm init -y

# 安装核心包
npm install @openagent/core

# 安装 LLM 适配器（选择需要的）
npm install @openagent/llm-openai      # OpenAI
npm install @openagent/llm-claude      # Claude
npm install @openagent/llm-deepseek    # DeepSeek

# 安装可选组件
npm install @openagent/tools           # 内置工具集
npm install @openagent/orchestrator    # Agent 编排器
npm install @openagent/permission      # 权限系统
```

### 2.2 配置 TypeScript

```bash
# 安装开发依赖
npm install -D typescript @types/node ts-node

# 初始化 TypeScript
npx tsc --init
```

**tsconfig.json 推荐配置：**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.3 创建第一个 Agent

**src/index.ts:**

```typescript
import { ReActAgent, AgentConfig } from '@openagent/core';
import { OpenAIProvider } from '@openagent/llm-openai';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  // 配置 Agent
  const config: AgentConfig = {
    id: 'my-first-agent',
    name: 'My Assistant',
    provider: 'openai',
    mode: 'react',
    systemPrompt: 'You are a helpful AI assistant.',
    maxIterations: 10,
  };

  // 创建 Agent
  const agent = new ReActAgent(config);
  await agent.initialize();

  // 运行 Agent
  const response = await agent.run('Hello! How are you?');
  console.log(response.message);
}

main().catch(console.error);
```

### 2.4 运行

```bash
# 安装 dotenv
npm install dotenv

# 运行
npx ts-node src/index.ts
```

---

## 🔧 方式 3: 源码编译

**适合需要定制和贡献代码的开发者。**

### 3.1 克隆仓库

```bash
git clone https://github.com/your-org/openagent-framework.git
cd openagent-framework
```

### 3.2 安装依赖

```bash
# 进入代码目录
cd code

# 安装所有依赖
npm install

# 或使用 pnpm（更快）
npm install -g pnpm
pnpm install
```

### 3.3 构建项目

```bash
# 构建所有包
npm run build

# 构建特定包
cd packages/core
npm run build
```

### 3.4 运行测试

```bash
# 运行所有测试
npm test

# 运行特定包的测试
cd packages/core
npm test

# 生成覆盖率报告
npm run test:coverage
```

### 3.5 本地链接

**在本地开发时，可以使用 npm link：**

```bash
# 在 openagent-framework/code 目录
cd packages/core
npm link

# 在你的项目目录
cd ~/my-project
npm link @openagent/core
```

---

## ✅ 验证安装

### 检查命令

```bash
# 1. 检查 Node.js 版本
node --version
# 应显示: v20.x.x 或更高

# 2. 检查服务健康（Docker 方式）
curl http://localhost:3000/health

# 3. 测试 API（需要 API Key）
curl -X POST http://localhost:3000/api/agent/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"message": "Hello", "provider": "openai"}'
```

### 运行示例脚本

创建测试文件 `test-agent.ts`：

```typescript
import { ReActAgent } from '@openagent/core';

const agent = new ReActAgent({
  id: 'test-agent',
  name: 'Test Agent',
  provider: 'openai',
  mode: 'react',
  systemPrompt: 'You are a test assistant.',
});

await agent.initialize();
const result = await agent.run('Say hello');

console.log('✅ Installation successful!');
console.log('Agent response:', result.message);
```

运行测试：

```bash
npx ts-node test-agent.ts
```

---

## 🐛 常见问题

### 问题 1: 端口被占用

**错误**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决方案**:

```bash
# Windows - 查找并结束进程
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>

# 或修改端口
# .env 文件
PORT=3001
```

### 问题 2: Docker 容器无法启动

**错误**: `Cannot connect to the Docker daemon`

**解决方案**:

```bash
# 检查 Docker 服务状态
docker info

# Windows/Mac: 重启 Docker Desktop

# Linux: 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker
```

### 问题 3: 数据库连接失败

**错误**: `Connection refused to database`

**解决方案**:

```bash
# 检查 PostgreSQL 是否运行
docker-compose ps postgres

# 查看日志
docker-compose logs postgres

# 重启服务
docker-compose restart postgres

# 等待数据库就绪（首次启动需要时间）
sleep 10
```

### 问题 4: API Key 无效

**错误**: `Invalid API key provided`

**解决方案**:

```bash
# 检查 .env 文件
cat .env | grep API_KEY

# 确保 API Key 格式正确
# OpenAI: sk-xxxxxxxxxxxxx
# Claude: sk-ant-xxxxxxxxxxxxx

# 验证 API Key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY"
```

### 问题 5: 权限错误

**错误**: `EPERM: operation not permitted`

**解决方案**:

```bash
# Windows: 以管理员身份运行

# Linux/Mac: 修复权限
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER ./node_modules
```

---

## 📚 下一步

安装完成后，建议按以下顺序学习：

1. **[创建第一个 Agent](./first-agent.md)** - 5 分钟快速开始
2. **[配置指南](./configuration.md)** - 详细配置说明
3. **[创建自定义工具](./custom-tools.md)** - 扩展 Agent 能力
4. **[API 文档](../api/core-api.md)** - 完整 API 参考

---

## 🆘 获取帮助

如果遇到问题：

- 📖 查看 [常见问题 FAQ](../faq.md)
- 💬 Discord 社区: https://discord.gg/openagent
- 🐛 提交 Issue: https://github.com/your-org/openagent-framework/issues
- 📧 邮件支持: support@openagent.dev

---

**安装完成！开始构建你的 AI Agent 吧！** 🎉
