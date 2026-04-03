# Core API 参考

OpenAgent Framework 核心 API 的完整参考文档。

---

## 📋 目录

1. [Agent API](#agent-api)
2. [Tool API](#tool-api)
3. [Session API](#session-api)
4. [Event API](#event-api)
5. [Cache API](#cache-api)
6. [Logger API](#logger-api)
7. [Error Handling](#error-handling)

---

## 🤖 Agent API

### IAgent 接口

所有 Agent 实现的基础接口。

```typescript
interface IAgent {
  // 属性
  readonly id: string;              // Agent 唯一标识
  readonly name: string;            // Agent 名称
  readonly provider: AgentProvider; // LLM 提供商
  readonly state: AgentState;       // 当前状态
  
  // 方法
  run(input: string, context?: AgentContext): Promise<AgentResponse>;
  addTool(tool: Tool): void;
  removeTool(toolName: string): void;
  getTools(): Tool[];
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}
```

### AgentConfig

Agent 配置选项。

```typescript
interface AgentConfig {
  // 必需字段
  id: string;                    // Agent 唯一标识
  name: string;                  // Agent 名称
  provider: AgentProvider;       // LLM 提供商
  mode: AgentMode;               // Agent 模式
  
  // 系统提示词
  systemPrompt: string;          // Agent 系统提示词
  
  // 行为控制
  maxIterations?: number;        // 最大迭代次数（默认: 10）
  temperature?: number;          // 温度参数（0-1）
  maxTokens?: number;            // 最大生成 Token 数
  
  // 工具配置
  tools?: Tool[];                // 初始工具列表
  enableCache?: boolean;         // 启用缓存（默认: true）
  
  // 超时设置
  timeout?: number;              // 单次运行超时（毫秒）
  
  // 其他配置
  metadata?: Record<string, any>; // 自定义元数据
}

type AgentProvider = 'openai' | 'claude' | 'deepseek' | 'glm' | 'ollama';
type AgentMode = 'react' | 'function-calling';
type AgentState = 'idle' | 'running' | 'error' | 'destroyed';
```

### AgentContext

Agent 运行上下文。

```typescript
interface AgentContext {
  sessionId?: string;            // 会话 ID
  userId?: string;               // 用户 ID
  conversationId?: string;       // 对话 ID
  parentMessageId?: string;      // 父消息 ID
  metadata?: Record<string, any>; // 自定义元数据
}
```

### AgentResponse

Agent 运行结果。

```typescript
interface AgentResponse {
  message: string;               // Agent 回复
  success: boolean;              // 是否成功
  metadata?: {
    iterations: number;          // 迭代次数
    toolsUsed: string[];         // 使用的工具列表
    duration: number;            // 执行时长（毫秒）
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    [key: string]: any;
  };
  error?: string;                // 错误信息
}
```

### ReActAgent

基于 ReAct 模式的 Agent 实现。

```typescript
import { ReActAgent, AgentConfig } from '@openagent/core';

// 创建 Agent
const config: AgentConfig = {
  id: 'my-agent',
  name: 'My Assistant',
  provider: 'openai',
  mode: 'react',
  systemPrompt: 'You are a helpful assistant.',
  maxIterations: 10,
  temperature: 0.7,
};

const agent = new ReActAgent(config);

// 初始化
await agent.initialize();

// 运行
const response = await agent.run('Hello!', {
  sessionId: 'session-123',
  userId: 'user-456',
});

console.log(response.message);
console.log('Iterations:', response.metadata?.iterations);

// 添加工具
agent.addTool({
  name: 'get_weather',
  description: 'Get weather',
  parameters: { type: 'object', properties: {} },
  execute: async (params) => ({ success: true, data: {} }),
});

// 获取工具列表
const tools = agent.getTools();
console.log('Tools:', tools.map(t => t.name));

// 移除工具
agent.removeTool('get_weather');

// 销毁
await agent.destroy();
```

### BaseAgent

Agent 基类，提供通用功能。

```typescript
import { BaseAgent, AgentConfig } from '@openagent/core';

class MyCustomAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async run(input: string, context?: AgentContext): Promise<AgentResponse> {
    // 自定义实现
    this.logger.info('Running agent', { input });
    
    try {
      // 调用 LLM
      const response = await this.callLLM(input);
      
      // 执行工具（如果需要）
      if (this.shouldUseTool(response)) {
        const toolResult = await this.executeTool(response.toolCall);
        // 处理结果
      }
      
      return {
        message: response.content,
        success: true,
        metadata: { iterations: 1 },
      };
    } catch (error) {
      this.logger.error('Agent error', error);
      return {
        message: '',
        success: false,
        error: error.message,
      };
    }
  }
}
```

---

## 🔧 Tool API

### Tool 接口

工具定义接口。

```typescript
interface Tool {
  name: string;                    // 工具名称（唯一）
  description: string;             // 工具描述（LLM 使用）
  parameters: JSONSchema;          // 参数 Schema
  execute: (params: any) => Promise<ToolResult>;
}
```

### JSONSchema

参数 Schema 定义。

```typescript
interface JSONSchema {
  type: string;                    // 类型: object, string, number, etc.
  properties?: Record<string, {    // 属性定义
    type: string;
    description?: string;
    enum?: string[];
    items?: JSONSchema;
    required?: boolean;
  }>;
  required?: string[];             // 必需字段
  items?: JSONSchema;              // 数组项 Schema
}
```

### ToolResult

工具执行结果。

```typescript
interface ToolResult {
  success: boolean;     // 执行是否成功
  data?: any;          // 返回数据
  error?: string;      // 错误信息
  metadata?: {         // 元数据
    duration?: number;  // 执行时长
    [key: string]: any;
  };
}
```

### 创建工具

```typescript
import { Tool, ToolResult } from '@openagent/core';

const myTool: Tool = {
  name: 'calculate',
  description: 'Perform mathematical calculations',
  
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression',
      },
      precision: {
        type: 'number',
        description: 'Decimal precision',
      },
    },
    required: ['expression'],
  },
  
  execute: async (params: any): Promise<ToolResult> => {
    const startTime = Date.now();
    
    try {
      const result = eval(params.expression);
      
      return {
        success: true,
        data: { result },
        metadata: {
          duration: Date.now() - startTime,
          expression: params.expression,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  },
};
```

### ToolExecutor

工具执行引擎。

```typescript
import { ToolExecutor } from '@openagent/core';

const executor = new ToolExecutor(undefined, undefined, {
  timeout: 30000,           // 超时时间
  enableCache: true,        // 启用缓存
  maxConcurrent: 5,         // 最大并发数
});

// 注册工具
executor.register(
  {
    name: 'query',
    description: 'Query data',
    parameters: { type: 'object', properties: {} },
  },
  async (params) => {
    // 执行逻辑
    return { success: true, data: {} };
  }
);

// 执行工具
const result = await executor.execute('query', { param1: 'value1' });

if (result.success) {
  console.log('Result:', result.data);
}

// 验证参数
const isValid = await executor.validate('query', { param1: 'value1' });

// 检查工具是否启用
const isEnabled = await executor.isEnabled('query');

// 取消注册
executor.unregister('query');
```

---

## 💬 Session API

### SessionManager

会话管理器。

```typescript
import { SessionManager } from '@openagent/core';

const sessionManager = new SessionManager({
  maxSessions: 1000,         // 最大会话数
  sessionTTL: 3600000,       // 会话 TTL（1小时）
  enableCache: true,         // 启用缓存
});

// 创建会话
const session = await sessionManager.create({
  userId: 'user-123',
  provider: 'openai',
  model: 'gpt-4',
  metadata: {
    source: 'web',
  },
});

console.log('Session ID:', session.id);

// 获取会话
const existingSession = await sessionManager.get(session.id);

// 更新会话
await sessionManager.update(session.id, {
  metadata: {
    source: 'mobile',
  },
});

// 添加消息
await sessionManager.addMessage(session.id, {
  role: 'user',
  content: 'Hello!',
});

// 获取消息
const messages = await sessionManager.getMessages(session.id);
console.log('Messages:', messages);

// 分页获取消息
const paginatedMessages = await sessionManager.getMessagesPaginated(
  session.id,
  {
    limit: 50,
    cursor: 'message-id-cursor',
    order: 'desc',
  }
);

console.log('Messages:', paginatedMessages.items);
console.log('Has next:', paginatedMessages.hasNext);
console.log('Next cursor:', paginatedMessages.nextCursor);

// 删除会话
await sessionManager.delete(session.id);

// 清理过期会话
await sessionManager.cleanup();
```

### Session

会话对象。

```typescript
interface Session {
  id: string;                    // 会话 ID
  userId: string;                // 用户 ID
  provider: AgentProvider;       // LLM 提供商
  model?: string;                // 模型名称
  messages: Message[];           // 消息列表
  metadata: Record<string, any>; // 元数据
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
  expiresAt?: Date;              // 过期时间
}
```

### Message

消息对象。

```typescript
interface Message {
  id: string;                    // 消息 ID
  sessionId: string;             // 会话 ID
  role: 'user' | 'assistant' | 'system';  // 角色
  content: string;               // 消息内容
  timestamp: Date;               // 时间戳
  metadata?: Record<string, any>; // 元数据
}
```

### PaginationOptions

分页选项。

```typescript
interface PaginationOptions {
  limit?: number;                // 每页数量（默认: 50）
  cursor?: string;               // 游标
  order?: 'asc' | 'desc';        // 排序方向（默认: 'asc'）
}
```

### PaginatedResult

分页结果。

```typescript
interface PaginatedResult<T> {
  items: T[];                    // 数据项
  hasNext: boolean;              // 是否有下一页
  hasPrev: boolean;              // 是否有上一页
  nextCursor?: string;           // 下一页游标
  prevCursor?: string;           // 上一页游标
  total?: number;                // 总数（如果支持）
}
```

---

## 📡 Event API

### EventEmitter

事件发射器。

```typescript
import { EventEmitter, EventType } from '@openagent/core';

const eventEmitter = new EventEmitter();

// 订阅单个事件
eventEmitter.on(EventType.AGENT_START, (event) => {
  console.log('Agent started:', event.data);
});

eventEmitter.on(EventType.TOOL_END, (event) => {
  console.log('Tool completed:', event.data);
});

// 订阅所有事件
eventEmitter.onAll((event) => {
  console.log('Event:', event.type, event.data);
});

// 发射事件
await eventEmitter.emit({
  type: EventType.AGENT_START,
  timestamp: new Date(),
  data: {
    agentId: 'my-agent',
    input: 'Hello',
  },
});

// 取消订阅
const handler = (event) => console.log(event);
eventEmitter.on(EventType.AGENT_END, handler);
eventEmitter.off(EventType.AGENT_END, handler);

// 清除所有监听器
eventEmitter.clear();
```

### EventType

事件类型枚举。

```typescript
enum EventType {
  // Agent 事件
  AGENT_START = 'agent:start',
  AGENT_END = 'agent:end',
  AGENT_ERROR = 'agent:error',
  
  // Tool 事件
  TOOL_START = 'tool:start',
  TOOL_END = 'tool:end',
  TOOL_ERROR = 'tool:error',
  
  // Session 事件
  SESSION_CREATED = 'session:created',
  SESSION_UPDATED = 'session:updated',
  SESSION_CLOSED = 'session:closed',
  
  // Message 事件
  MESSAGE_CREATED = 'message:created',
  
  // LLM 事件
  LLM_REQUEST = 'llm:request',
  LLM_RESPONSE = 'llm:response',
  LLM_ERROR = 'llm:error',
  
  // 通用事件
  ERROR = 'error',
}
```

### AgentEvent

事件对象。

```typescript
interface AgentEvent {
  type: EventType;               // 事件类型
  timestamp: Date;               // 时间戳
  data: any;                     // 事件数据
  metadata?: Record<string, any>; // 元数据
}
```

---

## 🗄️ Cache API

### Cache

缓存接口。

```typescript
interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, options?: CacheOptions): void;
  delete(key: string): boolean;
  clear(): void;
  has(key: string): boolean;
  size(): number;
  keys(): string[];
}

interface CacheOptions {
  ttl?: number;                  // 过期时间（毫秒）
}
```

### LRU Cache

最近最少使用缓存。

```typescript
import { createLRUCache } from '@openagent/core';

const cache = createLRUCache<string>({
  maxSize: 1000,                 // 最大缓存数
});

// 设置
cache.set('key1', 'value1');
cache.set('key2', 'value2', { ttl: 60000 });  // 1 分钟过期

// 获取
const value = cache.get('key1');
console.log(value);  // 'value1'

// 检查
const exists = cache.has('key1');
console.log(exists);  // true

// 删除
cache.delete('key1');

// 清空
cache.clear();

// 大小
const size = cache.size();
console.log(size);  // 1

// 所有键
const keys = cache.keys();
console.log(keys);  // ['key2']
```

### TTL Cache

定时过期缓存。

```typescript
import { createTTLCache } from '@openagent/core';

const cache = createTTLCache<any>({
  ttl: 60000,                    // 默认 1 分钟过期
  cleanupInterval: 300000,       // 每 5 分钟清理过期项
});

// 使用
cache.set('key', { data: 'value' });
const value = cache.get('key');
```

---

## 📝 Logger API

### Logger

日志接口。

```typescript
import { createLogger, LogLevel } from '@openagent/core';

const logger = createLogger('my-module', {
  level: LogLevel.INFO,
  format: 'json',
});

// 基础日志
logger.trace('Trace message');
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', new Error('Something went wrong'));
logger.fatal('Fatal message', new Error('Critical error'));

// 结构化日志
logger.info('User action', {
  userId: 'user-123',
  action: 'login',
  ip: '192.168.1.100',
});

// 子日志（带上下文）
const childLogger = logger.child({
  requestId: 'req-456',
  sessionId: 'session-789',
});

childLogger.info('Request processed');
```

### LogLevel

日志级别。

```typescript
enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
  SILENT = 6,
}
```

---

## ⚠️ Error Handling

### OpenAgentError

基础错误类。

```typescript
import { OpenAgentError, ErrorCode } from '@openagent/core';

try {
  await agent.run('question');
} catch (error) {
  if (error instanceof OpenAgentError) {
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    console.log('Error details:', error.details);
  }
}
```

### ErrorCode

错误代码枚举。

```typescript
enum ErrorCode {
  // Agent 错误
  AGENT_NOT_INITIALIZED = 'AGENT_NOT_INITIALIZED',
  AGENT_ALREADY_RUNNING = 'AGENT_ALREADY_RUNNING',
  AGENT_DESTROYED = 'AGENT_DESTROYED',
  
  // Tool 错误
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  TOOL_VALIDATION_ERROR = 'TOOL_VALIDATION_ERROR',
  TOOL_TIMEOUT_ERROR = 'TOOL_TIMEOUT_ERROR',
  
  // Session 错误
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  
  // LLM 错误
  LLM_ERROR = 'LLM_ERROR',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',
  
  // 通用错误
  INVALID_INPUT = 'INVALID_INPUT',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

### 特定错误类

```typescript
import {
  AgentNotInitializedError,
  ToolNotFoundError,
  SessionNotFoundError,
  LLMError,
} from '@openagent/core';

try {
  await agent.run('question');
} catch (error) {
  if (error instanceof AgentNotInitializedError) {
    console.log('Agent not initialized');
  } else if (error instanceof ToolNotFoundError) {
    console.log('Tool not found:', error.toolName);
  } else if (error instanceof SessionNotFoundError) {
    console.log('Session not found:', error.sessionId);
  } else if (error instanceof LLMError) {
    console.log('LLM error:', error.provider, error.message);
  }
}
```

---

## 📚 相关文档

- **[Tools API](./tools-api.md)** - 内置工具 API
- **[LLM Adapters](./llm-adapters.md)** - LLM 适配器配置
- **[Advanced API](./advanced-api.md)** - 高级功能 API

---

**需要更多帮助？查看 [示例代码](../../examples/)** 💡
