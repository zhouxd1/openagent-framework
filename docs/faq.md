# 常见问题 FAQ

本文档收集了 OpenAgent Framework 使用过程中的常见问题和解决方案。

---

## 📋 目录

1. [安装问题](#安装问题)
2. [配置问题](#配置问题)
3. [使用问题](#使用问题)
4. [性能问题](#性能问题)
5. [部署问题](#部署问题)
6. [其他问题](#其他问题)

---

## 💻 安装问题

### Q1: 安装失败怎么办？

**问题**: 执行 `npm install` 时出现错误。

**可能的原因和解决方案**:

1. **网络问题**
```bash
# 切换到国内镜像源
npm config set registry https://registry.npmmirror.com

# 或使用 cnpm
npm install -g cnpm
cnpm install
```

2. **权限问题**
```bash
# Linux/macOS
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER ./node_modules

# Windows (以管理员身份运行)
# 修复 npm 缓存
npm cache clean --force
```

3. **Node 版本问题**
```bash
# 检查 Node.js 版本（需要 20.x+）
node --version

# 使用 nvm 切换版本
nvm install 20
nvm use 20
```

4. **依赖冲突**
```bash
# 清空依赖并重新安装
rm -rf node_modules package-lock.json
npm install
```

---

### Q2: Node.js 版本不兼容？

**问题**: 提示 Node.js 版本过低。

**解决方案**:

```bash
# 方法 1: 使用 nvm（推荐）
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装 Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# 方法 2: 使用 n
npm install -g n
n 20

# 方法 3: 直接下载安装
# 访问 https://nodejs.org/
# 下载 Node.js 20.x LTS 版本
```

**验证安装**:
```bash
node --version   # 应显示 v20.x.x
npm --version    # 应显示 10.x.x
```

---

### Q3: 依赖安装失败？

**问题**: 某些依赖包安装失败。

**解决方案**:

1. **Python 依赖问题**
```bash
# 某些包需要 Python 2.7
npm config set python python2.7

# 或使用 Python 3
npm config set python python3
```

2. **编译工具缺失（Linux）**
```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
```

3. **Windows 构建工具**
```bash
# 以管理员身份运行
npm install -g windows-build-tools
```

4. **特定包的问题**
```bash
# 查看详细错误
npm install --verbose

# 尝试单独安装问题包
npm install <package-name> --verbose
```

---

### Q4: Docker 镜像拉取失败？

**问题**: Docker 镜像拉取超时或失败。

**解决方案**:

1. **配置 Docker 镜像加速**
```bash
# 编辑 Docker 配置
sudo vim /etc/docker/daemon.json

# 添加国内镜像源
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}

# 重启 Docker
sudo systemctl restart docker
```

2. **使用代理**
```bash
# 配置 Docker 代理
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo vim /etc/systemd/system/docker.service.d/http-proxy.conf

[Service]
Environment="HTTP_PROXY=http://proxy.example.com:8080"
Environment="HTTPS_PROXY=http://proxy.example.com:8080"
Environment="NO_PROXY=localhost,127.0.0.1"

# 重启
sudo systemctl daemon-reload
sudo systemctl restart docker
```

3. **手动拉取镜像**
```bash
# 尝试多次拉取
docker pull openagent/core:latest

# 使用其他镜像仓库
docker pull registry.example.com/openagent/core:latest
docker tag registry.example.com/openagent/core:latest openagent/core:latest
```

---

## ⚙️ 配置问题

### Q5: 如何配置多个 LLM？

**问题**: 想同时使用多个 LLM 提供商。

**解决方案**:

```typescript
// config/llm.ts
import { OpenAIAdapter } from '@openagent/llm-openai';
import { ClaudeAdapter } from '@openagent/llm-claude';
import { DeepSeekAdapter } from '@openagent/llm-deepseek';

export const llmAdapters = {
  openai: new OpenAIAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
    defaultModel: 'gpt-4-turbo-preview',
  }),
  
  claude: new ClaudeAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    defaultModel: 'claude-3-opus-20240229',
  }),
  
  deepseek: new DeepSeekAdapter({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    defaultModel: 'deepseek-chat',
  }),
};

// 使用时根据需求选择
const agent = new ReActAgent({
  provider: 'openai',  // 或 'claude' 或 'deepseek'
  llm: llmAdapters.openai,
});
```

**动态切换**:
```typescript
// 根据任务类型选择 LLM
function selectLLM(taskType: string): LLMAdapter {
  switch (taskType) {
    case 'code_generation':
      return llmAdapters.claude;  // Claude 擅长代码
    case 'creative_writing':
      return llmAdapters.openai;
    case 'simple_qa':
      return llmAdapters.deepseek;  // 更便宜
    default:
      return llmAdapters.openai;
  }
}
```

---

### Q6: 如何配置数据库？

**问题**: 如何配置 PostgreSQL 数据库。

**解决方案**:

1. **使用环境变量**
```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/openagent
DATABASE_POOL_SIZE=10
DATABASE_SSL=true
```

2. **代码配置**
```typescript
// config/database.ts
import { Pool } from 'pg';

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DATABASE_SSL === 'true' ? {
    rejectUnauthorized: false,
  } : undefined,
});

// 测试连接
db.query('SELECT NOW()')
  .then(() => console.log('Database connected'))
  .catch(err => console.error('Database connection failed:', err));
```

3. **Docker Compose 配置**
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: openagent
      POSTGRES_PASSWORD: openagent
      POSTGRES_DB: openagent
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openagent"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
```

---

### Q7: 如何配置 Redis？

**问题**: 如何配置 Redis 缓存和会话存储。

**解决方案**:

1. **基本配置**
```typescript
// config/redis.ts
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});
```

2. **使用 Redis 存储会话**
```typescript
import { RedisStore } from '@openagent/session-redis';

const sessionManager = new SessionManager({
  store: new RedisStore({
    client: redis,
    prefix: 'session:',
    ttl: 3600, // 1 小时
  }),
});
```

3. **使用 Redis 作为缓存**
```typescript
import { RedisCache } from '@openagent/cache-redis';

const cache = new RedisCache({
  client: redis,
  prefix: 'cache:',
  defaultTTL: 300, // 5 分钟
});
```

---

### Q8: 环境变量如何设置？

**问题**: 如何正确设置环境变量。

**解决方案**:

1. **创建 .env 文件**
```bash
# .env.example - 复制为 .env

# 基础配置
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# 数据库
DATABASE_URL=postgresql://openagent:password@localhost:5432/openagent

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
GLM_API_KEY=...

# JWT
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# 监控（可选）
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9091
```

2. **加载环境变量**
```typescript
// 使用 dotenv
import dotenv from 'dotenv';

// 加载 .env 文件
dotenv.config();

// 或指定路径
dotenv.config({ path: '.env.local' });

// 验证必需的环境变量
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'OPENAI_API_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

3. **生产环境最佳实践**
```bash
# 不要在生产环境使用 .env 文件
# 直接设置环境变量

# Linux/Mac
export DATABASE_URL="postgresql://..."
export OPENAI_API_KEY="sk-..."

# 或使用 systemd
# /etc/systemd/system/openagent.service
[Service]
Environment="DATABASE_URL=postgresql://..."
Environment="OPENAI_API_KEY=sk-..."

# Kubernetes
apiVersion: v1
kind: Secret
metadata:
  name: openagent-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://..."
  OPENAI_API_KEY: "sk-..."
```

---

## 🚀 使用问题

### Q9: 如何创建自定义工具？

**问题**: 如何开发自己的工具。

**解决方案**:

**步骤 1: 定义工具**
```typescript
// tools/my-tool.ts
import { Tool, ToolResult } from '@openagent/core';

export const myCustomTool: Tool = {
  name: 'my_custom_tool',
  description: 'Description of what this tool does',
  
  parameters: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Description of parameter',
      },
      param2: {
        type: 'number',
        description: 'Another parameter',
      },
    },
    required: ['param1'],
  },
  
  execute: async (params: any): Promise<ToolResult> => {
    try {
      // 实现工具逻辑
      const result = await doSomething(params.param1, params.param2);
      
      return {
        success: true,
        data: result,
        metadata: {
          processedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};
```

**步骤 2: 注册工具**
```typescript
import { createAgent } from '@openagent/core';
import { myCustomTool } from './tools/my-tool';

const agent = createAgent({
  id: 'my-agent',
  name: 'My Agent',
  tools: [myCustomTool],
});
```

**步骤 3: 测试工具**
```typescript
// 测试工具
const result = await myCustomTool.execute({
  param1: 'test',
  param2: 123,
});

console.log('Tool result:', result);
```

**参考**: [创建自定义工具](./getting-started/custom-tools.md)

---

### Q10: 如何处理会话持久化？

**问题**: 如何在重启后保持会话数据。

**解决方案**:

1. **使用数据库存储**
```typescript
import { SessionManager } from '@openagent/core';
import { PostgresStore } from '@openagent/session-postgres';

const sessionManager = new SessionManager({
  store: new PostgresStore({
    connectionString: process.env.DATABASE_URL,
    tableName: 'sessions',
  }),
});
```

2. **使用 Redis 存储**
```typescript
import { RedisStore } from '@openagent/session-redis';

const sessionManager = new SessionManager({
  store: new RedisStore({
    host: 'localhost',
    port: 6379,
    prefix: 'session:',
  }),
});
```

3. **混合存储策略**
```typescript
// 热数据在 Redis，冷数据在数据库
class HybridStore implements SessionStore {
  private redis: RedisStore;
  private postgres: PostgresStore;
  
  async get(sessionId: string): Promise<Session | null> {
    // 先查 Redis
    let session = await this.redis.get(sessionId);
    
    if (!session) {
      // 查数据库
      session = await this.postgres.get(sessionId);
      
      if (session) {
        // 回填 Redis
        await this.redis.set(sessionId, session);
      }
    }
    
    return session;
  }
  
  async set(sessionId: string, session: Session): Promise<void> {
    // 同时写入
    await Promise.all([
      this.redis.set(sessionId, session),
      this.postgres.set(sessionId, session),
    ]);
  }
}
```

---

### Q11: 如何调试 Agent？

**问题**: Agent 行为不符合预期，如何调试。

**解决方案**:

1. **启用详细日志**
```typescript
// 设置日志级别
import { setLogLevel } from '@openagent/core';

setLogLevel('debug');  // 或 'trace' 获取更详细的日志

// 或通过环境变量
// LOG_LEVEL=debug
```

2. **使用事件监听**
```typescript
// 监听 Agent 事件
agent.on('agent:start', (event) => {
  console.log('Agent started:', event);
});

agent.on('llm:request', (event) => {
  console.log('LLM request:', event);
});

agent.on('llm:response', (event) => {
  console.log('LLM response:', event);
});

agent.on('tool:start', (event) => {
  console.log('Tool execution started:', event);
});

agent.on('tool:end', (event) => {
  console.log('Tool execution completed:', event);
});

agent.on('agent:error', (event) => {
  console.error('Agent error:', event);
});
```

3. **使用调试工具**
```bash
# Node.js 调试模式
node --inspect-brk dist/index.js

# 使用 Chrome DevTools
# 打开 chrome://inspect

# 或使用 VS Code 调试
# .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Agent",
      "program": "${workspaceFolder}/dist/index.js",
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  ]
}
```

4. **添加断点**
```typescript
// 在关键位置添加断点
import { debugger } from '@openagent/core';

async function execute(input: string) {
  debugger.breakpoint('Before LLM call');
  
  const response = await this.llm.chat(messages);
  
  debugger.breakpoint('After LLM call', {
    response: response.content,
    toolCalls: response.toolCalls,
  });
  
  // ...
}
```

---

### Q12: 如何处理长对话？

**问题**: 对话历史过长导致 Token 超限。

**解决方案**:

1. **自动截断**
```typescript
// 配置上下文管理
const agent = new ReActAgent({
  // ...其他配置
  contextManager: {
    maxTokens: 4000,
    strategy: 'truncate',  // 或 'summarize'
  },
});
```

2. **总结策略**
```typescript
// 自动总结旧消息
class SummarizingContextManager {
  async manageContext(messages: Message[]): Promise<Message[]> {
    if (this.getTotalTokens(messages) > this.maxTokens) {
      // 总结前半部分
      const toSummarize = messages.slice(0, Math.floor(messages.length / 2));
      const summary = await this.summarize(toSummarize);
      
      // 替换为总结
      return [
        { role: 'system', content: `[Previous conversation summary: ${summary}]` },
        ...messages.slice(Math.floor(messages.length / 2)),
      ];
    }
    
    return messages;
  }
}
```

3. **滑动窗口**
```typescript
// 只保留最近的 N 条消息
const maxMessages = 20;

const recentMessages = messages.slice(-maxMessages);
```

4. **重要性过滤**
```typescript
// 根据重要性保留消息
function filterByImportance(messages: Message[]): Message[] {
  return messages.filter(message => {
    // 保留系统消息
    if (message.role === 'system') return true;
    
    // 保留包含工具调用的消息
    if (message.toolCalls?.length > 0) return true;
    
    // 保留重要关键词
    if (containsImportantKeywords(message.content)) return true;
    
    // 其他消息根据评分决定
    return calculateImportance(message) > threshold;
  });
}
```

---

## ⚡ 性能问题

### Q13: 响应速度慢怎么办？

**问题**: Agent 响应时间过长。

**诊断步骤**:

1. **检查网络延迟**
```bash
# 测试 LLM API 连接
curl -w "Time: %{time_total}s\n" https://api.openai.com/v1/engines
```

2. **监控性能指标**
```typescript
// 添加性能监控
import { performance } from 'perf_hooks';

const startMark = performance.mark('agent-start');

const response = await agent.run(input);

performance.mark('agent-end');
performance.measure('agent-execution', 'agent-start', 'agent-end');

const measure = performance.getEntriesByName('agent-execution')[0];
console.log(`Agent execution time: ${measure.duration}ms`);
```

**优化方案**:

1. **启用缓存**
```typescript
// 缓存 LLM 响应
const agent = new ReActAgent({
  // ...
  cache: {
    enabled: true,
    ttl: 300000, // 5 分钟
  },
});
```

2. **并发执行工具**
```typescript
// 如果有多个独立的工具调用，并发执行
const results = await Promise.all([
  tool1.execute(params1),
  tool2.execute(params2),
  tool3.execute(params3),
]);
```

3. **使用流式响应**
```typescript
// 使用流式响应提升用户体验
const stream = await agent.chatStream(input);

for await (const chunk of stream) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
}
```

---

### Q14: 内存占用过高？

**问题**: 应用内存使用量持续增长。

**诊断步骤**:

1. **监控内存使用**
```bash
# 查看进程内存
ps aux | grep node

# 或使用 Node.js 内置
node -e "console.log(process.memoryUsage())"
```

2. **生成堆快照**
```bash
# 使用 heapdump
npm install heapdump

# 在代码中
import heapdump from 'heapdump';

heapdump.writeSnapshot('/tmp/heap-' + Date.now() + '.heapsnapshot');
```

3. **分析内存泄漏**
```bash
# 使用 Chrome DevTools 分析 .heapsnapshot 文件
```

**解决方案**:

1. **限制缓存大小**
```typescript
// 使用 LRU 缓存
import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
  max: 1000,  // 最多 1000 个条目
  maxSize: 100 * 1024 * 1024,  // 或最大 100MB
  sizeCalculation: (value) => JSON.stringify(value).length,
});
```

2. **清理会话**
```typescript
// 定期清理过期会话
setInterval(async () => {
  const cleaned = await sessionManager.cleanup();
  console.log(`Cleaned ${cleaned} expired sessions`);
}, 3600000);  // 每小时
```

3. **避免内存泄漏**
```typescript
// 及时清理事件监听器
eventEmitter.removeAllListeners();

// 清理定时器
clearInterval(intervalId);
clearTimeout(timeoutId);

// 释放大对象
largeObject = null;
```

---

### Q15: CPU 使用率过高？

**问题**: CPU 使用率接近 100%。

**诊断步骤**:

```bash
# 查看 CPU 使用
top -p $(pgrep -f "node.*your-app")

# 使用 Node.js profiler
node --prof your-app.js

# 分析日志
node --prof-process isolate-*.log > profile.txt
```

**解决方案**:

1. **减少同步操作**
```typescript
// ❌ 避免
for (const item of items) {
  processItemSync(item);
}

// ✅ 使用异步
await Promise.all(items.map(item => processItemAsync(item)));
```

2. **使用 Worker Pool**
```typescript
// CPU 密集型任务使用 Worker
import { Worker } from 'worker_threads';

function runInWorker(task: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', {
      workerData: task,
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
```

3. **限流**
```typescript
// 限制并发请求数
import pLimit from 'p-limit';

const limit = pLimit(4);  // 最多 4 个并发

const results = await Promise.all(
  tasks.map(task => limit(() => processTask(task)))
);
```

---

### Q16: 如何优化性能？

**综合优化策略**:

1. **缓存策略**
   - 启用 LLM 响应缓存
   - 缓存工具执行结果
   - 使用 Redis 分布式缓存

2. **并发控制**
   - 使用 Worker Pool
   - 限制并发请求数
   - 异步处理长任务

3. **数据库优化**
   - 添加索引
   - 使用连接池
   - 查询优化

4. **内存管理**
   - 限制缓存大小
   - 定期清理
   - 避免内存泄漏

5. **监控和告警**
   - 设置性能监控
   - 配置告警规则
   - 定期审查

**参考**: [性能优化指南](./best-practices/performance-optimization.md)

---

## 🐳 部署问题

### Q17: Docker 部署失败？

**常见问题**:

1. **端口冲突**
```bash
# 检查端口占用
netstat -tuln | grep 3000

# 修改端口
# docker-compose.yml
services:
  openagent:
    ports:
      - "3001:3000"  # 改用 3001
```

2. **卷挂载问题**
```bash
# 检查权限
ls -la ./data

# 修复权限
sudo chown -R $USER:$USER ./data
```

3. **内存不足**
```yaml
# 增加容器内存限制
services:
  openagent:
    deploy:
      resources:
        limits:
          memory: 2G
```

4. **网络问题**
```bash
# 创建自定义网络
docker network create openagent-network

# 在 docker-compose.yml 中使用
networks:
  default:
    external:
      name: openagent-network
```

---

### Q18: Kubernetes 配置？

**基础配置**:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openagent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openagent
  template:
    metadata:
      labels:
        app: openagent
    spec:
      containers:
      - name: openagent
        image: openagent/core:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: openagent-secrets
              key: DATABASE_URL
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: openagent-service
spec:
  type: LoadBalancer
  selector:
    app: openagent
  ports:
  - port: 80
    targetPort: 3000
```

---

### Q19: 云平台部署？

**AWS ECS 部署**:

```json
// task-definition.json
{
  "family": "openagent",
  "containerDefinitions": [
    {
      "name": "openagent",
      "image": "openagent/core:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:openagent:DATABASE_URL"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/openagent",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "512",
  "memory": "1024"
}
```

**阿里云容器服务**:

```yaml
# .alicloud/container-service.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openagent
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: openagent
  template:
    metadata:
      labels:
        app: openagent
    spec:
      containers:
      - name: openagent
        image: registry.cn-hangzhou.aliyuncs.com/openagent/core:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
```

---

### Q20: 如何监控和告警？

**Prometheus + Grafana**:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'openagent'
    static_configs:
      - targets: ['openagent:9091']
```

**告警规则**:

```yaml
# alerts.yml
groups:
  - name: openagent
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} per second"
      
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]) > 1
        for: 5m
        annotations:
          summary: "High response time"
          description: "P95 response time is {{ $value }} seconds"
```

---

## 💬 其他问题

### Q21: 如何升级版本？

**升级步骤**:

```bash
# 1. 备份数据
pg_dump openagent > backup-$(date +%Y%m%d).sql
redis-cli BGSAVE

# 2. 拉取最新代码
git pull origin main

# 3. 更新依赖
npm install

# 4. 运行迁移
npm run migrate

# 5. 构建项目
npm run build

# 6. 重启服务
# Docker
docker-compose restart

# 或 PM2
pm2 restart openagent

# 或 systemd
sudo systemctl restart openagent
```

**注意事项**:
- 阅读更新日志（CHANGELOG.md）
- 检查破坏性变更（BREAKING CHANGES）
- 在测试环境先验证
- 准备回滚方案

---

### Q22: 如何贡献代码？

**贡献流程**:

1. **Fork 仓库**
```bash
# 在 GitHub 上 Fork 项目
git clone https://github.com/your-username/openagent-framework.git
cd openagent-framework
```

2. **创建分支**
```bash
git checkout -b feature/your-feature-name
```

3. **编写代码**
- 遵循代码规范
- 添加测试
- 更新文档

4. **运行测试**
```bash
npm test
npm run lint
npm run build
```

5. **提交 PR**
```bash
git push origin feature/your-feature-name
# 在 GitHub 上创建 Pull Request
```

**代码规范**:
- 使用 TypeScript
- 遵循 ESLint 规则
- 编写清晰的注释
- 添加单元测试

---

### Q23: 如何报告 Bug？

**报告步骤**:

1. **检查是否已存在**
   - 搜索 [GitHub Issues](https://github.com/your-org/openagent-framework/issues)

2. **收集信息**
```bash
# 系统信息
node --version
npm --version
cat /etc/os-release  # Linux

# 日志
cat logs/error.log

# 环境变量（脱敏）
env | grep -v "API_KEY\|PASSWORD"
```

3. **创建 Issue**
   - 标题：简洁描述问题
   - 描述：详细说明
   - 步骤：重现步骤
   - 预期：期望行为
   - 实际：实际行为
   - 环境：系统信息
   - 日志：相关日志

**Issue 模板**:

```markdown
## Bug 描述
[简洁描述问题]

## 重现步骤
1. ...
2. ...
3. ...

## 预期行为
[应该发生什么]

## 实际行为
[实际发生了什么]

## 环境信息
- OS: [e.g., Ubuntu 20.04]
- Node.js: [e.g., v20.10.0]
- OpenAgent: [e.g., v1.0.0]

## 日志
```
[相关日志]
```

## 截图
[如果适用]
```

---

### Q24: 技术支持联系方式？

**获取帮助**:

1. **文档**
   - 官方文档：https://docs.openagent.dev
   - API 参考：https://api.openagent.dev

2. **社区**
   - Discord: https://discord.gg/openagent
   - GitHub Discussions: https://github.com/your-org/openagent-framework/discussions
   - Stack Overflow: 标签 `openagent`

3. **问题反馈**
   - GitHub Issues: https://github.com/your-org/openagent-framework/issues

4. **商业支持**
   - 邮件：support@openagent.dev
   - 网站：https://openagent.dev/support

5. **社交媒体**
   - Twitter: @OpenAgentDev
   - 微信公众号：OpenAgent

---

## 📚 相关文档

- **[安装指南](./getting-started/installation.md)** - 详细安装步骤
- **[配置指南](./getting-started/configuration.md)** - 配置说明
- **[性能优化](./best-practices/performance-optimization.md)** - 性能优化
- **[安全最佳实践](./best-practices/security.md)** - 安全指南

---

**没有找到你的问题？**
- 查看 [GitHub Issues](https://github.com/your-org/openagent-framework/issues)
- 在 [Discord](https://discord.gg/openagent) 提问
- 联系 [技术支持](mailto:support@openagent.dev)

---

**FAQ 文档完成！解决你的疑问！** 💡
