# 配置指南

本指南详细介绍 OpenAgent Framework 的各种配置选项，帮助你充分利用框架的能力。

---

## 📋 目录

1. [环境变量](#环境变量)
2. [配置文件](#配置文件)
3. [LLM 提供商配置](#llm-提供商配置)
4. [数据库配置](#数据库配置)
5. [缓存配置](#缓存配置)
6. [日志配置](#日志配置)
7. [监控配置](#监控配置)
8. [安全配置](#安全配置)

---

## 🔧 环境变量

### 基础配置

创建 `.env` 文件：

```env
# ====================
# 基础服务配置
# ====================

# 运行环境: development | test | production
NODE_ENV=development

# 服务端口
PORT=3000

# 服务主机
HOST=0.0.0.0

# 日志级别: debug | info | warn | error
LOG_LEVEL=debug

# ====================
# 数据库配置
# ====================

# PostgreSQL 连接字符串
DATABASE_URL=postgresql://openagent:openagent@localhost:5432/openagent

# 数据库连接池配置
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ====================
# Redis 配置
# ====================

# Redis 连接字符串
REDIS_URL=redis://localhost:6379

# Redis 密码（可选）
REDIS_PASSWORD=

# Redis 数据库索引
REDIS_DB=0

# ====================
# LLM API Keys
# ====================

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
OPENAI_ORG_ID=org-xxxxx  # 可选

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# DeepSeek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com  # 可选

# GLM (智谱)
GLM_API_KEY=xxxxxxxxxxxxx

# Ollama (本地)
OLLAMA_BASE_URL=http://localhost:11434

# ====================
# 权限和安全配置
# ====================

# JWT 密钥（生产环境必须修改）
JWT_SECRET=your-very-secure-jwt-secret-change-this-in-production

# JWT 过期时间
JWT_EXPIRES_IN=7d

# API Key 加密密钥（32字节）
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# ====================
# 监控配置（可选）
# ====================

# Prometheus
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9091

# Grafana
GRAFANA_ADMIN_PASSWORD=admin

# ====================
# 其他配置
# ====================

# 时区
TZ=Asia/Shanghai

# 代理（如果需要）
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080
```

### 环境变量优先级

1. 系统环境变量（最高）
2. `.env.local` 文件
3. `.env` 文件
4. 默认值（最低）

---

## 📄 配置文件

### 使用 TypeScript 配置文件

创建 `openagent.config.ts`：

```typescript
import { OpenAgentConfig } from '@openagent/core';

const config: OpenAgentConfig = {
  // 服务配置
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true,
    },
  },

  // 数据库配置
  database: {
    type: 'postgresql',
    url: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
    },
    ssl: process.env.NODE_ENV === 'production',
  },

  // Redis 配置
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  // Agent 配置
  agent: {
    defaultProvider: 'openai',
    defaultModel: 'gpt-4',
    maxIterations: 10,
    timeout: 60000,
    enableCache: true,
  },

  // 工具配置
  tools: {
    enableBuiltin: true,
    timeout: 30000,
    maxConcurrent: 5,
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    outputs: ['console', 'file'],
    file: {
      path: './logs/openagent.log',
      maxSize: '10m',
      maxFiles: 5,
    },
  },

  // 监控配置
  monitoring: {
    enabled: process.env.PROMETHEUS_ENABLED === 'true',
    prometheus: {
      port: parseInt(process.env.PROMETHEUS_PORT || '9091'),
    },
  },

  // 安全配置
  security: {
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    rateLimit: {
      enabled: true,
      windowMs: 60000, // 1 分钟
      max: 100, // 最多 100 次请求
    },
  },
};

export default config;
```

### 使用配置文件

```typescript
import { OpenAgentFramework } from '@openagent/core';
import config from './openagent.config';

const app = new OpenAgentFramework(config);
await app.start();
```

---

## 🤖 LLM 提供商配置

### OpenAI

```typescript
import { OpenAIProvider, OpenAIConfig } from '@openagent/llm-openai';

const openaiConfig: OpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,  // 可选
  
  // 模型配置
  model: 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  
  // 请求配置
  timeout: 60000,
  maxRetries: 3,
  
  // 代理配置（可选）
  proxy: {
    host: 'proxy.example.com',
    port: 8080,
  },
  
  // 自定义基础 URL（可选）
  baseURL: 'https://api.openai.com/v1',
};

const provider = new OpenAIProvider(openaiConfig);
```

**可用模型：**
- `gpt-4-turbo-preview` - GPT-4 Turbo（推荐）
- `gpt-4` - GPT-4
- `gpt-3.5-turbo` - GPT-3.5 Turbo
- `gpt-3.5-turbo-16k` - GPT-3.5 Turbo 16K 上下文

### Claude (Anthropic)

```typescript
import { ClaudeProvider, ClaudeConfig } from '@openagent/llm-claude';

const claudeConfig: ClaudeConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  
  // 模型配置
  model: 'claude-3-opus-20240229',
  temperature: 0.7,
  maxTokens: 4096,
  
  // 请求配置
  timeout: 60000,
  maxRetries: 3,
  
  // 自定义基础 URL（可选）
  baseURL: 'https://api.anthropic.com/v1',
};

const provider = new ClaudeProvider(claudeConfig);
```

**可用模型：**
- `claude-3-opus-20240229` - Claude 3 Opus（最强）
- `claude-3-sonnet-20240229` - Claude 3 Sonnet（平衡）
- `claude-3-haiku-20240307` - Claude 3 Haiku（快速）
- `claude-2.1` - Claude 2.1

### DeepSeek

```typescript
import { DeepSeekProvider, DeepSeekConfig } from '@openagent/llm-deepseek';

const deepseekConfig: DeepSeekConfig = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  
  // 模型配置
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 4000,
  
  // 自定义基础 URL（可选）
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
};

const provider = new DeepSeekProvider(deepseekConfig);
```

**可用模型：**
- `deepseek-chat` - DeepSeek Chat（通用）
- `deepseek-coder` - DeepSeek Coder（代码）

### GLM (智谱)

```typescript
import { GLMProvider } from '@openagent/llm-glm';

const glmConfig = {
  apiKey: process.env.GLM_API_KEY,
  
  // 模型配置
  model: 'glm-4',
  temperature: 0.7,
  maxTokens: 4000,
  
  // 自定义基础 URL（可选）
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
};

const provider = new GLMProvider(glmConfig);
```

**可用模型：**
- `glm-4` - GLM-4
- `glm-3-turbo` - GLM-3 Turbo

### Ollama (本地)

```typescript
import { OllamaProvider } from '@openagent/llm-ollama';

const ollamaConfig = {
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  
  // 模型配置
  model: 'llama2',
  temperature: 0.7,
  numCtx: 4096,  // 上下文长度
};

const provider = new OllamaProvider(ollamaConfig);
```

**常用模型：**
- `llama2` - Llama 2
- `mistral` - Mistral
- `codellama` - Code Llama
- `deepseek-coder` - DeepSeek Coder

### 多 LLM 配置

```typescript
import { LLMRouter } from '@openagent/core';
import { OpenAIProvider } from '@openagent/llm-openai';
import { ClaudeProvider } from '@openagent/llm-claude';
import { DeepSeekProvider } from '@openagent/llm-deepseek';

// 创建多个提供商
const providers = {
  openai: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo-preview',
  }),
  
  claude: new ClaudeProvider({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-opus-20240229',
  }),
  
  deepseek: new DeepSeekProvider({
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
  }),
};

// 创建路由器
const router = new LLMRouter({
  providers,
  defaultProvider: 'openai',
  
  // 路由规则
  routing: {
    // 代码任务使用 DeepSeek Coder
    code: 'deepseek',
    // 推理任务使用 Claude
    reasoning: 'claude',
    // 其他任务使用 OpenAI
    default: 'openai',
  },
  
  // 故障转移
  fallback: {
    openai: ['claude', 'deepseek'],
    claude: ['openai'],
    deepseek: ['openai'],
  },
});

// 使用
const response = await router.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  taskType: 'reasoning',  // 自动路由到 Claude
});
```

---

## 💾 数据库配置

### PostgreSQL

```typescript
const dbConfig = {
  type: 'postgresql',
  url: 'postgresql://user:pass@host:port/database',
  
  // 连接池配置
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 10000,
  },
  
  // SSL 配置（生产环境推荐）
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem').toString(),
  },
  
  // 性能优化
  performance: {
    // 预编译语句
    prepareStatements: true,
    // 连接健康检查
    healthCheck: {
      enabled: true,
      interval: 30000,
    },
  },
};
```

### 使用 Prisma

OpenAgent Framework 使用 Prisma 作为 ORM。

**schema.prisma:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Agent {
  id        String   @id @default(uuid())
  name      String
  provider  String
  config    Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  sessions  Session[]
}

model Session {
  id        String   @id @default(uuid())
  agentId   String
  userId    String
  messages  Message[]
  metadata  Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  agent     Agent    @relation(fields: [agentId], references: [id])
}

model Message {
  id        String   @id @default(uuid())
  sessionId String
  role      String
  content   String
  timestamp DateTime @default(now())
  
  session   Session  @relation(fields: [sessionId], references: [id])
}
```

**运行迁移：**

```bash
# 创建迁移
npx prisma migrate dev --name init

# 生成客户端
npx prisma generate

# 部署迁移（生产）
npx prisma migrate deploy
```

---

## 🚀 缓存配置

### Redis 缓存

```typescript
const cacheConfig = {
  type: 'redis',
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // 连接池配置
  pool: {
    min: 1,
    max: 10,
  },
  
  // 缓存策略
  strategy: {
    // 默认 TTL
    defaultTTL: 60000,  // 1 分钟
    // 最大键数
    maxKeys: 10000,
  },
  
  // 性能优化
  performance: {
    // 启用压缩
    compression: true,
    // 序列化
    serialization: 'json',
  },
};
```

### 内存缓存

```typescript
import { Cache, createLRUCache, createTTLCache } from '@openagent/core';

// LRU 缓存
const lruCache = createLRUCache<string>({
  maxSize: 1000,  // 最多 1000 个条目
});

// TTL 缓存
const ttlCache = createTTLCache<string>({
  ttl: 60000,  // 1 分钟过期
  cleanupInterval: 300000,  // 每 5 分钟清理
});

// 使用
cache.set('key', 'value');
const value = cache.get('key');
cache.delete('key');
cache.clear();
```

### 多级缓存

```typescript
import { MultiLevelCache } from '@openagent/core';

const cache = new MultiLevelCache({
  levels: [
    // L1: 内存缓存（快速）
    {
      type: 'memory',
      config: {
        maxSize: 100,
        ttl: 60000,
      },
    },
    // L2: Redis 缓存（共享）
    {
      type: 'redis',
      config: {
        url: process.env.REDIS_URL,
        ttl: 300000,
      },
    },
  ],
});

// 自动降级：L1 → L2
const value = await cache.get('key');
await cache.set('key', 'value');
```

---

## 📊 日志配置

### 基础配置

```typescript
import { createLogger, LogLevel } from '@openagent/core';

const logger = createLogger('my-app', {
  level: LogLevel.INFO,
  format: 'json',
  
  // 输出目标
  transports: [
    // 控制台
    { type: 'console' },
    // 文件
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '10m',
      maxFiles: 5,
    },
    // HTTP（远程日志）
    {
      type: 'http',
      url: 'https://logs.example.com/api/logs',
      headers: {
        'Authorization': 'Bearer token',
      },
    },
  ],
  
  // 格式化
  formatter: {
    timestamp: true,
    prettyPrint: process.env.NODE_ENV === 'development',
    colorize: true,
  },
});
```

### 结构化日志

```typescript
// 添加上下文
const contextLogger = logger.child({
  requestId: 'req-123',
  userId: 'user-456',
});

contextLogger.info('User action', {
  action: 'login',
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0',
});

// 输出:
{
  "level": "info",
  "message": "User action",
  "timestamp": "2026-04-03T06:00:00.000Z",
  "requestId": "req-123",
  "userId": "user-456",
  "action": "login",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0"
}
```

### 日志级别

```typescript
logger.trace('Very detailed debug info');
logger.debug('Debug information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred', error);
logger.fatal('Fatal error', error);
```

---

## 📈 监控配置

### Prometheus

```typescript
const prometheusConfig = {
  enabled: true,
  port: 9091,
  path: '/metrics',
  
  // 指标配置
  metrics: {
    // 默认指标
    defaultMetrics: true,
    // 自定义指标
    custom: [
      {
        name: 'agent_executions_total',
        help: 'Total number of agent executions',
        type: 'counter',
        labels: ['agent_id', 'provider'],
      },
      {
        name: 'agent_execution_duration_seconds',
        help: 'Agent execution duration in seconds',
        type: 'histogram',
        labels: ['agent_id'],
        buckets: [0.1, 0.5, 1, 5, 10],
      },
    ],
  },
};
```

### Grafana 仪表板

导入预定义的仪表板：

```bash
# 导入仪表板
kubectl apply -f deploy/monitoring/grafana-dashboard.yaml
```

**仪表板包含：**
- Agent 执行统计
- 工具调用统计
- LLM API 延迟和错误率
- 系统资源使用
- 会话统计

### 分布式追踪

```typescript
import { Tracing } from '@openagent/observability';

const tracing = new Tracing({
  enabled: true,
  serviceName: 'openagent-api',
  
  // Jaeger 配置
  jaeger: {
    endpoint: 'http://localhost:14268/api/traces',
    sampler: {
      type: 'probabilistic',
      param: 0.1,  // 10% 采样率
    },
  },
  
  // 或使用 Zipkin
  zipkin: {
    endpoint: 'http://localhost:9411/api/v2/spans',
  },
});

// 使用追踪
const span = tracing.startSpan('agent_execution');
try {
  await agent.run('question');
  span.setStatus('ok');
} catch (error) {
  span.setStatus('error', error.message);
  throw error;
} finally {
  span.finish();
}
```

---

## 🔐 安全配置

### JWT 配置

```typescript
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: '7d',
  
  // 算法
  algorithm: 'HS256',
  
  // 刷新令牌
  refresh: {
    enabled: true,
    expiresIn: '30d',
  },
  
  // 黑名单（用于登出）
  blacklist: {
    enabled: true,
    type: 'redis',
    url: process.env.REDIS_URL,
  },
};
```

### CORS 配置

```typescript
const corsConfig = {
  origin: [
    'http://localhost:3000',
    'https://myapp.com',
  ],
  
  // 或使用函数动态判断
  origin: (origin, callback) => {
    if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400,  // 24 小时
};
```

### 速率限制

```typescript
const rateLimitConfig = {
  enabled: true,
  
  // 全局限制
  global: {
    windowMs: 60000,  // 1 分钟
    max: 100,  // 最多 100 次请求
    message: 'Too many requests',
  },
  
  // 按用户限制
  perUser: {
    windowMs: 60000,
    max: 50,
    keyGenerator: (req) => req.user.id,
  },
  
  // 按 IP 限制
  perIP: {
    windowMs: 60000,
    max: 200,
    keyGenerator: (req) => req.ip,
  },
  
  // 存储方式
  storage: {
    type: 'redis',
    url: process.env.REDIS_URL,
  },
};
```

### 内容安全策略（CSP）

```typescript
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://api.openai.com'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
};
```

---

## 🎯 环境特定配置

### 开发环境

```typescript
// openagent.config.development.ts
export default {
  server: {
    port: 3000,
  },
  
  database: {
    url: 'postgresql://localhost:5432/openagent_dev',
  },
  
  logging: {
    level: 'debug',
    prettyPrint: true,
  },
  
  security: {
    rateLimit: {
      enabled: false,  // 开发时禁用
    },
  },
};
```

### 测试环境

```typescript
// openagent.config.test.ts
export default {
  database: {
    url: 'postgresql://localhost:5432/openagent_test',
  },
  
  logging: {
    level: 'warn',
  },
  
  cache: {
    enabled: false,  // 测试时禁用缓存
  },
};
```

### 生产环境

```typescript
// openagent.config.production.ts
export default {
  server: {
    port: parseInt(process.env.PORT || '3000'),
  },
  
  database: {
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    pool: { min: 5, max: 20 },
  },
  
  logging: {
    level: 'info',
    format: 'json',
  },
  
  security: {
    rateLimit: {
      enabled: true,
      global: { windowMs: 60000, max: 100 },
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h',
    },
  },
  
  monitoring: {
    enabled: true,
  },
};
```

---

## 📚 下一步

- **[创建第一个 Agent](./first-agent.md)** - 使用配置创建 Agent
- **[API 文档](../api/core-api.md)** - 了解更多 API
- **[部署指南](../../README.md)** - 部署到生产环境

---

**配置完成！享受 OpenAgent Framework 吧！** 🚀
