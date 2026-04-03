# @openagent/core

OpenAgent Framework 的核心引擎，提供 Agent 抽象层、工具执行引擎、会话管理和事件系统。

## 安装

```bash
npm install @openagent/core
```

## 功能特性

- **Agent 抽象层**: 清晰的 Agent 接口和基类，支持 ReAct 和 Function Calling 模式
- **工具执行引擎**: 安全的工具执行框架，支持参数验证、超时控制和缓存
- **会话管理**: 完整的会话生命周期管理，支持 LRU 缓存和 TTL
- **事件系统**: 灵活的事件发布订阅机制，支持异步事件处理
- **错误处理**: 统一的错误处理机制，包含详细的错误代码和信息
- **日志系统**: 结构化日志记录，支持多种输出传输
- **缓存系统**: 高性能 LRU 缓存，支持 TTL 过期

## 快速开始

### 1. 创建 Agent

```typescript
import { ReActAgent, AgentConfig } from '@openagent/core';

const config: AgentConfig = {
  id: 'my-agent',
  name: 'My Assistant',
  provider: 'openai',
  mode: 'react',
  systemPrompt: 'You are a helpful assistant.',
  maxIterations: 10,
};

const agent = new ReActAgent(config);
await agent.initialize();
```

### 2. 添加工具

```typescript
import { Tool } from '@openagent/core';

const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: {
    location: {
      type: 'string',
      description: 'City name',
      required: true,
    },
  },
  execute: async (params) => {
    const weather = await fetchWeather(params.location);
    return {
      success: true,
      data: weather,
    };
  },
};

agent.addTool(weatherTool);
```

### 3. 运行 Agent

```typescript
const response = await agent.run('What is the weather in Beijing?', {
  sessionId: 'session-123',
  userId: 'user-456',
});

console.log(response.message);
console.log(response.metadata?.iterations);
```

### 4. 会话管理

```typescript
import { SessionManager } from '@openagent/core';

const sessionManager = new SessionManager();

// 创建会话
const session = await sessionManager.create({
  userId: 'user-123',
  provider: 'openai',
  model: 'gpt-4',
});

// 添加消息
await sessionManager.addMessage(session.id, {
  role: 'user',
  content: 'Hello!',
});

// 获取消息
const messages = await sessionManager.getMessages(session.id);
```

### 5. 工具执行

```typescript
import { ToolExecutor } from '@openagent/core';

const executor = new ToolExecutor(undefined, undefined, {
  timeout: 30000,
  enableCache: true,
});

// 注册工具
executor.register(weatherTool, async (params) => {
  const weather = await fetchWeather(params.location);
  return { success: true, data: weather };
});

// 执行工具
const result = await executor.execute('get_weather', { location: 'Beijing' });
```

### 6. 事件订阅

```typescript
import { EventEmitter, EventType } from '@openagent/core';

const eventEmitter = new EventEmitter();

// 订阅事件
eventEmitter.on(EventType.AGENT_START, (event) => {
  console.log('Agent started:', event.data);
});

eventEmitter.on(EventType.TOOL_END, (event) => {
  console.log('Tool completed:', event.data);
});

// 发送事件
await eventEmitter.emit({
  type: EventType.AGENT_START,
  timestamp: new Date(),
  data: { agentId: 'my-agent' },
});
```

## API 文档

### Agent

#### `IAgent` 接口

```typescript
interface IAgent {
  readonly id: string;
  readonly name: string;
  readonly provider: AgentProvider;
  readonly state: AgentState;
  
  run(input: string, context?: AgentContext): Promise<AgentResponse>;
  addTool(tool: Tool): void;
  removeTool(toolName: string): void;
  getTools(): Tool[];
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}
```

#### `BaseAgent` 抽象类

提供 Agent 的基础实现，包括：
- 工具管理
- 状态管理
- 事件发射
- 日志记录
- 错误处理

#### `ReActAgent` 类

基于 ReAct 模式的 Agent 实现：
- Thought: 推理下一步行动
- Action: 选择并执行工具
- Observation: 观察结果
- 循环直到任务完成

### Tool Executor

#### `ToolExecutor` 类

```typescript
class ToolExecutor {
  register(tool: ToolDefinition, handler: ToolHandler, schema?: ZodSchema): void;
  unregister(toolName: string): void;
  execute(toolName: string, parameters: Parameters, context?: ToolExecutionContext): Promise<ToolResult>;
  validate(toolName: string, parameters: Parameters): Promise<boolean>;
  isEnabled(toolName: string): Promise<boolean>;
}
```

特性：
- 参数验证（支持 Zod schema）
- 超时控制
- 重试机制
- 结果缓存
- 执行统计

### Session Manager

#### `SessionManager` 类

```typescript
class SessionManager {
  create(config: SessionConfig): Promise<Session>;
  get(sessionId: string): Promise<Session | null>;
  update(sessionId: string, updates: Partial<Session>): Promise<Session>;
  delete(sessionId: string): Promise<void>;
  addMessage(sessionId: string, message: Message): Promise<Message>;
  getMessages(sessionId: string, limit?: number): Promise<Message[]>;
  getMessagesPaginated(sessionId: string, options?: PaginationOptions): Promise<PaginatedResult<Message>>;
}
```

特性：
- 会话生命周期管理
- 消息历史存储
- LRU 缓存
- TTL 过期
- 分页查询

### Event System

#### `EventEmitter` 类

```typescript
class EventEmitter {
  on(eventType: EventType, handler: EventHandler): void;
  off(eventType: EventType, handler: EventHandler): void;
  emit(event: AgentEvent): Promise<void>;
  onAll(handler: EventHandler): void;
  clear(): void;
}
```

事件类型：
- `AGENT_START` / `AGENT_END` / `AGENT_ERROR`
- `TOOL_START` / `TOOL_END` / `TOOL_ERROR`
- `SESSION_CREATED` / `SESSION_UPDATED` / `SESSION_CLOSED`
- `MESSAGE_CREATED`
- `ERROR`
- `LLM_REQUEST` / `LLM_RESPONSE` / `LLM_ERROR`

## 错误处理

```typescript
import { OpenAgentError, ErrorCode, SessionNotFoundError } from '@openagent/core';

try {
  await sessionManager.get('non-existent');
} catch (error) {
  if (error instanceof SessionNotFoundError) {
    console.log('Session not found:', error.sessionId);
  }
}
```

## 日志

```typescript
import { Logger, createLogger, LogLevel } from '@openagent/core';

const logger = createLogger('MyModule');

logger.debug('Debug message', { key: 'value' });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', new Error('Something went wrong'));
```

## 缓存

```typescript
import { Cache, createLRUCache, createTTLCache } from '@openagent/core';

// LRU 缓存
const lruCache = createLRUCache<string>(1000);
lruCache.set('key', 'value');
const value = lruCache.get('key');

// TTL 缓存
const ttlCache = createTTLCache<string>(3600000); // 1小时
ttlCache.set('key', 'value');
```

## 验证

```typescript
import { Validator, CommonSchemas, z } from '@openagent/core';

const schema = z.object({
  name: CommonSchemas.nonEmptyString(),
  age: CommonSchemas.positiveNumber(),
  email: CommonSchemas.email(),
});

const result = Validator.safeValidate(schema, {
  name: 'John',
  age: 30,
  email: 'john@example.com',
});

if (result.success) {
  console.log(result.data);
} else {
  console.log(result.errors);
}
```

## 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

## 开发规范

1. 使用 TypeScript 严格模式
2. 所有公共 API 添加 JSDoc 注释
3. 单元测试覆盖率 ≥ 80%
4. 遵循已有的错误处理机制
5. 集成已有的 Validator、Logger、Cache

## 许可证

MIT
