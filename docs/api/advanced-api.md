# 高级 API 参考

OpenAgent Framework 高级功能的完整 API 参考文档。

---

## 📋 目录

1. [Permission System](#permission-system)
2. [Agent Orchestrator](#agent-orchestrator)
3. [Observability](#observability)
4. [Workflow Engine](#workflow-engine)
5. [Message Bus](#message-bus)

---

## 🔐 Permission System

企业级权限管理系统。

### PermissionManager

权限管理器主类。

```typescript
import { PermissionManager, PermissionConfig } from '@openagent/permission';

const config: PermissionConfig = {
  database: {
    type: 'postgresql',
    url: process.env.DATABASE_URL,
  },
  cache: {
    enabled: true,
    ttl: 60000,  // 1 分钟
  },
  audit: {
    enabled: true,
    flushInterval: 5000,
  },
};

const manager = new PermissionManager(config);
await manager.initialize();
```

### Role Management

#### createRole

创建角色。

```typescript
const role = await manager.createRole({
  name: 'editor',
  description: 'Content editor role',
  
  permissions: [
    {
      id: 'perm_read_content',
      resource: 'content:*',
      action: 'read',
      effect: 'allow',
    },
    {
      id: 'perm_write_drafts',
      resource: 'content:drafts',
      action: 'write',
      effect: 'allow',
    },
  ],
  
  // 继承其他角色
  inherits: ['base-user'],
  
  // 条件（可选）
  conditions: [
    {
      type: 'time',
      operator: 'between',
      value: [540, 1080],  // 9:00 AM - 6:00 PM
    },
  ],
});

console.log('Role created:', role.id);
```

#### grantRole

授予权限给用户。

```typescript
await manager.grantRole(
  'user-123',    // 用户 ID
  'editor',      // 角色名称或 ID
  'admin-456'    // 授权人 ID（用于审计）
);
```

#### revokeRole

撤销用户权限。

```typescript
await manager.revokeRole(
  'user-123',
  'editor',
  'admin-456'
);
```

### User Management

#### createUser

创建用户。

```typescript
const user = await manager.createUser({
  email: 'user@example.com',
  name: 'John Doe',
  roles: ['editor', 'reviewer'],
  attributes: {
    department: 'engineering',
    level: 'senior',
  },
});

console.log('User created:', user.id);
```

#### getUser

获取用户信息。

```typescript
const user = await manager.getUser('user-123');
console.log('User:', user.name);
console.log('Roles:', user.roles);
```

### Permission Check

#### checkPermission

检查用户权限。

```typescript
const result = await manager.checkPermission(
  'user-123',          // 用户 ID
  'content:drafts',    // 资源
  'write',             // 动作
  {
    ip: '192.168.1.100',
    currentTime: new Date(),
  }
);

if (result.allowed) {
  console.log('Access granted');
} else {
  console.log('Access denied:', result.reason);
}
```

### Resource Patterns

资源模式支持通配符：

```typescript
// 精确匹配
resource: 'tool:shell'

// 通配符匹配
resource: 'tool:*'              // 所有工具
resource: 'file:/data/*'        // /data 下所有文件
resource: '*'                   // 所有资源

// 多动作
action: 'read'                  // 只读
action: 'read,write,delete'     // 多个动作
action: '*'                     // 所有动作
```

### Conditional Permissions

#### Time-Based

```typescript
{
  conditions: [
    {
      type: 'time',
      operator: 'between',
      value: [540, 1080],  // 9:00 - 18:00（分钟）
    },
  ],
}
```

#### IP-Based

```typescript
{
  conditions: [
    {
      type: 'ip',
      operator: 'in',
      value: ['192.168.1.100', '192.168.1.101'],
    },
  ],
}
```

#### Attribute-Based

```typescript
{
  conditions: [
    {
      type: 'attribute',
      operator: 'eq',
      value: {
        attribute: 'department',
        value: 'engineering',
      },
    },
  ],
}
```

### Audit Logging

#### queryAuditLogs

查询审计日志。

```typescript
const logs = await manager.queryAuditLogs({
  userId: 'user-123',
  action: 'execute',
  result: 'deny',
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-12-31'),
  limit: 100,
});

logs.forEach(log => {
  console.log(`${log.timestamp}: ${log.action} - ${log.result}`);
});
```

#### exportAuditLogs

导出审计日志。

```typescript
// JSON 格式
const jsonExport = await manager.exportAuditLogs('json', {
  startTime: new Date('2024-01-01'),
  endTime: new Date(),
});

// CSV 格式
const csvExport = await manager.exportAuditLogs('csv');
```

### SSO Integration

#### SAML

```typescript
import { SAMLAuth } from '@openagent/permission';

const samlAuth = new SAMLAuth({
  entryPoint: 'https://idp.example.com/saml/sso',
  callbackUrl: 'https://myapp.com/auth/saml/callback',
  issuer: 'myapp',
  cert: fs.readFileSync('/path/to/idp-cert.pem', 'utf-8'),
});

// 获取登录 URL
const { url } = await samlAuth.getLoginURL(redirectUrl);

// 验证响应
const user = await samlAuth.validateResponse(samlResponse);
console.log('User:', user.email, user.name);
```

#### OIDC

```typescript
import { OIDCAuth } from '@openagent/permission';

const oidcAuth = new OIDCAuth({
  issuer: 'https://auth.example.com',
  client_id: 'your_client_id',
  client_secret: 'your_client_secret',
  redirect_uris: ['https://myapp.com/auth/callback'],
});

// 获取授权 URL
const authUrl = await oidcAuth.getAuthorizationURL(redirectUrl);

// 交换 code
const tokens = await oidcAuth.exchangeToken(code, redirectUrl);
console.log('Access token:', tokens.access_token);
console.log('User info:', tokens.id_token);
```

### API Key Management

#### createKey

创建 API Key。

```typescript
import { APIKeyManager } from '@openagent/permission';

const apiKeyManager = new APIKeyManager({
  database: { type: 'postgresql', url: process.env.DATABASE_URL },
  encryptionKey: process.env.ENCRYPTION_KEY,  // 32 字节
});

const { id, key } = await apiKeyManager.createKey(
  'user-123',
  'CI/CD Key',
  ['read:repos', 'write:repos'],
  365 * 24 * 60 * 60 * 1000  // 1 年过期
);

console.log('API Key:', key);  // 只显示一次！
```

#### validateKey

验证 API Key。

```typescript
const validatedUser = await apiKeyManager.validateKey(apiKey);

if (validatedUser) {
  console.log('User ID:', validatedUser.userId);
  console.log('Scopes:', validatedUser.scopes);
}
```

---

## 🎼 Agent Orchestrator

多 Agent 编排框架。

### AgentOrchestrator

```typescript
import { AgentOrchestrator, OrchestratorConfig } from '@openagent/orchestrator';

const config: OrchestratorConfig = {
  maxConcurrentAgents: 10,
  timeout: 30000,
  retryPolicy: {
    maxAttempts: 3,
    backoff: 'exponential',
    delay: 1000,
  },
};

const orchestrator = new AgentOrchestrator(config);
```

### Register Agents

```typescript
// 注册 Agent
orchestrator.registerAgent(analyzerAgent);
orchestrator.registerAgent(summarizerAgent);
orchestrator.registerAgent(reviewerAgent);

// 获取 Agent
const agent = orchestrator.getAgent('analyzer');

// 取消注册
orchestrator.unregisterAgent('analyzer');
```

### Orchestration Patterns

#### Chain Pattern

顺序执行多个 Agent。

```typescript
import { ChainPattern } from '@openagent/orchestrator';

// 数据处理管道
const result = await ChainPattern.execute(
  [extractor, transformer, validator, loader],
  rawData,
  context,
  {
    stopOnFailure: true,     // 失败时停止
    passOutputToNext: true,  // 输出传递给下一个
  }
);

console.log('Final result:', result);
```

#### Parallel Pattern

并行执行多个 Agent。

```typescript
import { ParallelPattern } from '@openagent/orchestrator';

// 并行分析
const results = await ParallelPattern.execute(
  [sentimentAgent, keywordAgent, entityAgent],
  text,
  context,
  {
    maxConcurrency: 3,     // 最大并发数
    failFast: false,       // 不快速失败
  }
);

console.log('Sentiment:', results[0]);
console.log('Keywords:', results[1]);
console.log('Entities:', results[2]);

// Race 模式（最快的返回）
const fastest = await ParallelPattern.race(
  [agent1, agent2, agent3],
  'Quick question',
  context
);
```

#### Router Pattern

条件路由到不同 Agent。

```typescript
import { RouterPattern, ContentRouter } from '@openagent/orchestrator';

const router = new ContentRouter()
  .addKeywordRouter(['urgent', 'critical'], priorityAgent)
  .addKeywordRouter(['billing', 'payment'], billingAgent)
  .addRegexRouter(/^API:/i, apiAgent)
  .setDefaultAgent(generalAgent);

const result = await router.route('URGENT: System down!');
```

#### Supervisor Pattern

监督者协调多个 Worker Agent。

```typescript
import { SupervisorPattern } from '@openagent/orchestrator';

const result = await SupervisorPattern.execute(
  supervisorAgent,              // 监督者
  [worker1, worker2, worker3],  // 工作者
  'Analyze market trends',
  context,
  {
    parallelExecution: true,  // 并行执行子任务
    maxSubtasks: 10,          // 最大子任务数
    timeout: 60000,           // 超时时间
  }
);
```

### Workflow Management

#### createWorkflow

创建工作流。

```typescript
const workflow = orchestrator.createWorkflow({
  name: 'Code Review',
  description: 'Analyze and review code',
  
  steps: [
    {
      id: 'analyze',
      agentId: 'analyzer',
      task: 'Analyze code quality',
      timeout: 30000,
    },
    {
      id: 'security',
      agentId: 'security-checker',
      task: 'Check security issues',
      timeout: 20000,
      dependencies: ['analyze'],  // 依赖 analyze 步骤
    },
    {
      id: 'review',
      agentId: 'reviewer',
      task: 'Review code',
      dependencies: ['analyze', 'security'],
      condition: (ctx) => {
        // 条件执行
        const analyzeResult = ctx.results.get('analyze');
        return analyzeResult?.status === 'completed';
      },
    },
  ],
  
  // 失败回退
  fallback: {
    id: 'fallback',
    agentId: 'notifier',
    task: 'Notify failure',
  },
});

console.log('Workflow ID:', workflow.id);
```

#### executeWorkflow

执行工作流。

```typescript
const result = await orchestrator.executeWorkflow(
  workflow.id,
  codeInput,
  {
    userId: 'user-123',
    metadata: { source: 'ci' },
  }
);

console.log('Result:', result);
console.log('Steps completed:', result.steps.length);
console.log('Total duration:', result.duration);
```

---

## 📊 Observability

可观测性系统。

### Tracing

分布式追踪。

```typescript
import { Tracing, TracingConfig } from '@openagent/observability';

const config: TracingConfig = {
  enabled: true,
  serviceName: 'openagent-api',
  
  jaeger: {
    endpoint: 'http://localhost:14268/api/traces',
    sampler: {
      type: 'probabilistic',
      param: 0.1,  // 10% 采样
    },
  },
  
  // 或使用 Zipkin
  zipkin: {
    endpoint: 'http://localhost:9411/api/v2/spans',
  },
};

const tracing = new Tracing(config);
```

#### 创建 Span

```typescript
// 创建根 Span
const span = tracing.startSpan('agent_execution', {
  tags: {
    agentId: 'my-agent',
    userId: 'user-123',
  },
});

try {
  // 执行操作
  const response = await agent.run('question');
  
  span.log({
    event: 'agent_response',
    iterations: response.metadata?.iterations,
  });
  
  span.setStatus('ok');
  span.finish();
} catch (error) {
  span.setStatus('error', error.message);
  span.finish();
  throw error;
}
```

#### 子 Span

```typescript
const parentSpan = tracing.startSpan('workflow');

// 创建子 Span
const childSpan = tracing.startSpan('step1', {
  childOf: parentSpan,
});

// ... 执行操作 ...

childSpan.finish();
parentSpan.finish();
```

### Metrics

指标收集。

```typescript
import { Metrics } from '@openagent/observability';

const metrics = new Metrics({
  prefix: 'openagent_',
  
  // Prometheus 配置
  prometheus: {
    enabled: true,
    port: 9091,
  },
});

// 计数器
const counter = metrics.counter('agent_executions_total', {
  help: 'Total agent executions',
  labelNames: ['agent_id', 'provider'],
});

counter.inc({ agent_id: 'my-agent', provider: 'openai' });

// 直方图
const histogram = metrics.histogram('agent_duration_seconds', {
  help: 'Agent execution duration',
  labelNames: ['agent_id'],
  buckets: [0.1, 0.5, 1, 5, 10],
});

const end = histogram.startTimer({ agent_id: 'my-agent' });
// ... 执行操作 ...
end();  // 记录时长

// 仪表盘
const gauge = metrics.gauge('active_sessions', {
  help: 'Number of active sessions',
});

gauge.set(42);
gauge.inc();
gauge.dec();
```

### Logging

结构化日志。

```typescript
import { createLogger } from '@openagent/observability';

const logger = createLogger('my-service', {
  level: 'info',
  format: 'json',
  
  transports: [
    { type: 'console' },
    {
      type: 'file',
      path: './logs/app.log',
      maxSize: '10m',
      maxFiles: 5,
    },
  ],
});

// 日志
logger.info('Agent started', {
  agentId: 'my-agent',
  provider: 'openai',
});

// 错误日志
logger.error('Agent failed', {
  agentId: 'my-agent',
  error: error.message,
  stack: error.stack,
});
```

---

## 🔄 Workflow Engine

工作流引擎。

### Workflow Definition

```typescript
interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  fallback?: WorkflowStep;
  metadata?: Record<string, any>;
}

interface WorkflowStep {
  id: string;
  agentId: string;
  task: string;
  dependencies?: string[];
  condition?: (ctx: WorkflowContext) => boolean;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  on?: {
    success?: string;   // 成功时跳转
    failure?: string;   // 失败时跳转
  };
}
```

### WorkflowEngine

```typescript
import { WorkflowEngine } from '@openagent/orchestrator';

const engine = new WorkflowEngine();

// 创建工作流
const workflow = engine.createWorkflow(definition);

// 验证工作流
const validation = engine.validateWorkflow(workflow);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// 获取并行步骤
const parallelSteps = engine.getParallelSteps(workflow);

// 注册工作流
orchestrator.registerWorkflow(workflow);
```

### Workflow Context

```typescript
interface WorkflowContext {
  workflowId: string;
  input: any;
  results: Map<string, StepResult>;
  variables: Record<string, any>;
  metadata: Record<string, any>;
}

interface StepResult {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  duration?: number;
}
```

---

## 📨 Message Bus

消息总线系统。

### MessageBus

```typescript
import { MessageBus } from '@openagent/orchestrator';

const messageBus = new MessageBus({
  maxChannels: 100,
  messageTTL: 3600000,  // 1 小时
});
```

### Channel Management

```typescript
// 创建频道
messageBus.createChannel('task-channel');
messageBus.createChannel('result-channel');

// 删除频道
messageBus.deleteChannel('task-channel');

// 列出频道
const channels = messageBus.listChannels();
```

### Subscribe

订阅消息。

```typescript
// 订阅频道
const unsubscribe = messageBus.subscribe('task-channel', async (message) => {
  console.log('Received:', message);
  
  // 处理消息
  const result = await processTask(message.data);
  
  // 发送响应
  const response = MessageFactory.createResponseMessage(
    'agent-1',
    message.from,
    { result },
    message.id
  );
  
  await messageBus.send('result-channel', response);
});

// 取消订阅
unsubscribe();
```

### Send

发送消息。

```typescript
import { MessageFactory } from '@openagent/orchestrator';

// 创建任务消息
const task = MessageFactory.createTaskMessage(
  'coordinator',
  'agent-1',
  { task: 'Process data' }
);

// 发送
await messageBus.send('task-channel', task);

// 广播
await messageBus.broadcast(task);
```

### Message Types

```typescript
interface Message {
  id: string;
  type: 'task' | 'response' | 'event' | 'command';
  from: string;
  to?: string;
  data: any;
  timestamp: Date;
  correlationId?: string;  // 关联 ID
  replyTo?: string;        // 回复频道
  ttl?: number;           // 过期时间
}
```

---

## 📚 相关文档

- **[Architecture Overview](../architecture/overview.md)** - 架构概览
- **[Best Practices](../best-practices/)** - 最佳实践
- **[Examples](../../examples/)** - 示例代码

---

**探索高级功能，构建强大的 AI 应用！** 🚀
