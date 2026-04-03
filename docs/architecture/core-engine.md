# 核心引擎

本文档详细介绍 OpenAgent Framework 核心引擎的设计与实现，包括 Agent 系统、工具执行引擎、会话管理和 Worker Pool。

---

## 📋 目录

1. [Agent 系统](#agent-系统)
2. [工具执行引擎](#工具执行引擎)
3. [会话管理](#会话管理)
4. [Worker Pool](#worker-pool)
5. [事件系统](#事件系统)

---

## 🤖 Agent 系统

### Agent 生命周期

Agent 从创建到销毁经历以下状态：

```
┌───────────────────────────────────────────────────────┐
│              Agent State Machine                       │
└───────────────────────────────────────────────────────┘

           ┌──────────┐
           │  IDLE    │ ◄─────── Initial State
           │          │
           └──────────┘
                │
                │ run() called
                ▼
           ┌──────────┐
           │ RUNNING  │
           │          │
           └──────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
   ┌─────────┐    ┌─────────┐
   │ SUCCESS │    │  ERROR  │
   │         │    │         │
   └─────────┘    └─────────┘
        │               │
        └───────┬───────┘
                │
                │ destroy() called
                ▼
           ┌──────────┐
           │DESTROYED │
           │          │
           └──────────┘
```

**状态说明**：

| 状态 | 说明 | 可转换状态 |
|------|------|-----------|
| `IDLE` | Agent 已初始化，空闲状态 | RUNNING, DESTROYED |
| `RUNNING` | Agent 正在处理请求 | SUCCESS, ERROR |
| `SUCCESS` | 执行成功（临时状态） | IDLE, DESTROYED |
| `ERROR` | 执行失败（临时状态） | IDLE, DESTROYED |
| `DESTROYED` | Agent 已销毁，不可用 | - |

### Agent 实现原理

#### BaseAgent 基类

```typescript
// packages/core/src/agent/base-agent.ts

export abstract class BaseAgent implements IAgent {
  readonly id: string;
  readonly name: string;
  readonly provider: AgentProvider;
  
  protected _state: AgentState = 'idle';
  protected tools: Map<string, Tool> = new Map();
  protected logger: Logger;
  protected eventEmitter: EventEmitter;
  
  constructor(protected config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.provider = config.provider;
    this.logger = createLogger(`agent:${this.id}`);
    this.eventEmitter = new EventEmitter();
    
    // 注册初始工具
    if (config.tools) {
      config.tools.forEach(tool => this.addTool(tool));
    }
  }
  
  get state(): AgentState {
    return this._state;
  }
  
  async initialize(): Promise<void> {
    this.logger.info('Initializing agent', { id: this.id });
    // 子类实现具体初始化逻辑
    await this.onInitialize();
    this.logger.info('Agent initialized successfully');
  }
  
  async run(input: string, context?: AgentContext): Promise<AgentResponse> {
    // 状态检查
    if (this._state === 'destroyed') {
      throw new AgentDestroyedError(this.id);
    }
    
    if (this._state === 'running') {
      throw new AgentAlreadyRunningError(this.id);
    }
    
    this._state = 'running';
    const startTime = Date.now();
    
    try {
      // 发射开始事件
      await this.eventEmitter.emit({
        type: EventType.AGENT_START,
        timestamp: new Date(),
        data: { agentId: this.id, input },
      });
      
      // 执行 Agent 逻辑
      const response = await this.execute(input, context);
      
      // 发射结束事件
      await this.eventEmitter.emit({
        type: EventType.AGENT_END,
        timestamp: new Date(),
        data: {
          agentId: this.id,
          duration: Date.now() - startTime,
          success: true,
        },
      });
      
      this._state = 'idle';
      return response;
      
    } catch (error: any) {
      // 发射错误事件
      await this.eventEmitter.emit({
        type: EventType.AGENT_ERROR,
        timestamp: new Date(),
        data: {
          agentId: this.id,
          error: error.message,
          duration: Date.now() - startTime,
        },
      });
      
      this._state = 'idle';
      throw error;
    }
  }
  
  protected abstract execute(
    input: string,
    context?: AgentContext
  ): Promise<AgentResponse>;
  
  protected abstract onInitialize(): Promise<void>;
  
  addTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} already exists, overwriting`);
    }
    this.tools.set(tool.name, tool);
    this.logger.debug(`Tool added: ${tool.name}`);
  }
  
  removeTool(toolName: string): void {
    if (!this.tools.has(toolName)) {
      this.logger.warn(`Tool ${toolName} not found`);
      return;
    }
    this.tools.delete(toolName);
    this.logger.debug(`Tool removed: ${toolName}`);
  }
  
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  async destroy(): Promise<void> {
    this.logger.info('Destroying agent', { id: this.id });
    this.tools.clear();
    this._state = 'destroyed';
    this.eventEmitter.clear();
  }
}
```

#### ReActAgent 实现

ReAct (Reasoning and Acting) 模式的 Agent 实现：

```typescript
// packages/core/src/agent/react-agent.ts

export class ReActAgent extends BaseAgent {
  private llmAdapter: LLMAdapter;
  private maxIterations: number;
  
  constructor(config: AgentConfig) {
    super(config);
    this.maxIterations = config.maxIterations || 10;
    this.llmAdapter = this.createLLMAdapter(config);
  }
  
  protected async onInitialize(): Promise<void> {
    // 初始化 LLM 适配器
    await this.llmAdapter.initialize();
  }
  
  protected async execute(
    input: string,
    context?: AgentContext
  ): Promise<AgentResponse> {
    const messages: Message[] = [
      { role: 'system', content: this.config.systemPrompt },
      { role: 'user', content: input },
    ];
    
    const toolsUsed: string[] = [];
    let iterations = 0;
    
    while (iterations < this.maxIterations) {
      iterations++;
      this.logger.debug(`Iteration ${iterations}`);
      
      // 调用 LLM
      const response = await this.llmAdapter.chat(messages, {
        tools: this.getToolDefinitions(),
      });
      
      // 如果没有工具调用，返回结果
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return {
          message: response.content,
          success: true,
          metadata: {
            iterations,
            toolsUsed,
            tokensUsed: response.usage,
          },
        };
      }
      
      // 执行工具调用
      for (const toolCall of response.toolCalls) {
        this.logger.info(`Executing tool: ${toolCall.name}`);
        
        const result = await this.executeTool(
          toolCall.name,
          toolCall.arguments
        );
        
        toolsUsed.push(toolCall.name);
        
        // 添加工具结果到消息历史
        messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
        });
        
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
        });
      }
    }
    
    // 达到最大迭代次数
    return {
      message: '达到最大迭代次数，请尝试简化问题。',
      success: false,
      metadata: { iterations, toolsUsed },
    };
  }
  
  private async executeTool(
    name: string,
    args: any
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool ${name} not found`,
      };
    }
    
    try {
      const result = await tool.execute(args);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  private getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
  
  private createLLMAdapter(config: AgentConfig): LLMAdapter {
    // 根据 provider 创建对应的适配器
    switch (config.provider) {
      case 'openai':
        return new OpenAIAdapter(config.llmConfig);
      case 'claude':
        return new ClaudeAdapter(config.llmConfig);
      // ... 其他适配器
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
```

### 消息处理流程

```
┌───────────────────────────────────────────────────────┐
│          Agent Message Processing Flow                 │
└───────────────────────────────────────────────────────┘

User Input
     │
     ▼
┌─────────────┐
│  Validate   │  1. Check input format
│   Input     │  2. Sanitize content
└─────────────┘  3. Apply length limits
     │
     ▼
┌─────────────┐
│   Build     │  1. Add system prompt
│  Messages   │  2. Add conversation history
└─────────────┘  3. Add current input
     │
     ▼
┌─────────────┐
│   Call      │  1. Send to LLM
│    LLM      │  2. Stream response
└─────────────┘  3. Parse tool calls
     │
     ├─── No Tool Call ─────────────┐
     │                              │
     ▼                              ▼
┌─────────────┐              ┌─────────────┐
│   Parse     │              │   Return    │
│ Tool Calls  │              │   Result    │
└─────────────┘              └─────────────┘
     │
     ▼
┌─────────────┐
│  Execute    │  1. Validate params
│   Tools     │  2. Run tool function
└─────────────┘  3. Handle errors
     │
     ▼
┌─────────────┐
│   Update    │  1. Add tool results
│  Messages   │  2. Continue loop
└─────────────┘
     │
     └─── Loop Back to LLM Call ───┘
```

---

## 🔧 工具执行引擎

### 工具注册机制

```typescript
// packages/core/src/tool/tool-registry.ts

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private logger: Logger;
  
  constructor() {
    this.logger = createLogger('tool-registry');
  }
  
  register(tool: Tool, options?: ToolOptions): void {
    // 验证工具定义
    this.validateTool(tool);
    
    const registeredTool: RegisteredTool = {
      ...tool,
      options: {
        enabled: true,
        timeout: 30000,
        ...options,
      },
      registeredAt: new Date(),
    };
    
    this.tools.set(tool.name, registeredTool);
    this.logger.info(`Tool registered: ${tool.name}`);
  }
  
  unregister(toolName: string): boolean {
    if (!this.tools.has(toolName)) {
      this.logger.warn(`Tool ${toolName} not found`);
      return false;
    }
    
    this.tools.delete(toolName);
    this.logger.info(`Tool unregistered: ${toolName}`);
    return true;
  }
  
  get(toolName: string): RegisteredTool | undefined {
    return this.tools.get(toolName);
  }
  
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }
  
  getByCategory(category: string): RegisteredTool[] {
    return this.getAll().filter(
      tool => tool.options.category === category
    );
  }
  
  private validateTool(tool: Tool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool name is required and must be a string');
    }
    
    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool description is required');
    }
    
    if (!tool.parameters || typeof tool.parameters !== 'object') {
      throw new Error('Tool parameters schema is required');
    }
    
    if (typeof tool.execute !== 'function') {
      throw new Error('Tool execute function is required');
    }
  }
}
```

### 执行流程

```typescript
// packages/core/src/tool/tool-executor.ts

export class ToolExecutor {
  private registry: ToolRegistry;
  private validator: ToolValidator;
  private logger: Logger;
  private config: ExecutorConfig;
  
  constructor(
    registry?: ToolRegistry,
    validator?: ToolValidator,
    config?: ExecutorConfig
  ) {
    this.registry = registry || new ToolRegistry();
    this.validator = validator || new ToolValidator();
    this.logger = createLogger('tool-executor');
    this.config = config || {};
  }
  
  async execute(
    toolName: string,
    params: any,
    context?: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    
    // 1. 获取工具
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }
    
    // 2. 检查是否启用
    if (!tool.options.enabled) {
      throw new ToolDisabledError(toolName);
    }
    
    // 3. 权限检查
    if (context?.permissions) {
      await this.checkPermissions(tool, context.permissions);
    }
    
    // 4. 参数验证
    const validation = await this.validator.validate(
      tool.parameters,
      params
    );
    
    if (!validation.valid) {
      return {
        success: false,
        error: `Parameter validation failed: ${validation.errors.join(', ')}`,
        metadata: { duration: Date.now() - startTime },
      };
    }
    
    // 5. 执行工具（带超时）
    try {
      const result = await this.executeWithTimeout(
        tool,
        params,
        tool.options.timeout || this.config.timeout || 30000
      );
      
      // 6. 记录审计日志
      await this.logExecution(toolName, params, result, startTime);
      
      return result;
      
    } catch (error: any) {
      this.logger.error(`Tool execution failed: ${toolName}`, error);
      
      return {
        success: false,
        error: error.message,
        metadata: { duration: Date.now() - startTime },
      };
    }
  }
  
  private async executeWithTimeout(
    tool: RegisteredTool,
    params: any,
    timeout: number
  ): Promise<ToolResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolTimeoutError(tool.name, timeout));
      }, timeout);
      
      tool.execute(params)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  private async checkPermissions(
    tool: RegisteredTool,
    permissions: string[]
  ): Promise<void> {
    const requiredPermissions = tool.options.permissions || [];
    
    const hasAllPermissions = requiredPermissions.every(
      perm => permissions.includes(perm)
    );
    
    if (!hasAllPermissions) {
      throw new PermissionDeniedError(
        `Missing permissions for tool: ${tool.name}`
      );
    }
  }
  
  private async logExecution(
    toolName: string,
    params: any,
    result: ToolResult,
    startTime: number
  ): Promise<void> {
    this.logger.info('Tool executed', {
      tool: toolName,
      success: result.success,
      duration: Date.now() - startTime,
      params: this.sanitizeParams(params),
    });
  }
  
  private sanitizeParams(params: any): any {
    // 移除敏感信息
    const sanitized = { ...params };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret'];
    
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }
}
```

### 执行流程图

```
┌───────────────────────────────────────────────────────┐
│          Tool Execution Flow                           │
└───────────────────────────────────────────────────────┘

Tool Call Request
     │
     ▼
┌─────────────┐
│   Lookup    │  Find tool in registry
│    Tool     │
└─────────────┘
     │
     ├─── Not Found ────┐
     │                   │
     ▼                   ▼
┌─────────────┐   ┌─────────────┐
│   Check     │   │   Return    │
│   Enabled   │   │   Error     │
└─────────────┘   └─────────────┘
     │
     ├─── Disabled ─────┐
     │                   │
     ▼                   ▼
┌─────────────┐   ┌─────────────┐
│   Check     │   │   Return    │
│ Permissions │   │   Error     │
└─────────────┘   └─────────────┘
     │
     ├─── No Permission ┐
     │                   │
     ▼                   ▼
┌─────────────┐   ┌─────────────┐
│   Validate  │   │   Return    │
│   Params    │   │   Error     │
└─────────────┘   └─────────────┘
     │
     ├─── Invalid ──────┐
     │                   │
     ▼                   ▼
┌─────────────┐   ┌─────────────┐
│   Execute   │   │   Return    │
│  Function   │   │   Error     │
└─────────────┘   └─────────────┘
     │
     ├─── Timeout ──────┐
     │                   │
     ▼                   ▼
┌─────────────┐   ┌─────────────┐
│    Log      │   │   Return    │
│  Execution  │   │   Error     │
└─────────────┘   └─────────────┘
     │
     ▼
Return Result
```

---

## 💬 会话管理

### 会话生命周期

```
┌───────────────────────────────────────────────────────┐
│          Session Lifecycle                            │
└───────────────────────────────────────────────────────┘

       ┌──────────┐
       │ CREATED  │
       │          │
       └──────────┘
            │
            │ First message
            ▼
       ┌──────────┐
       │  ACTIVE  │ ◄─── Normal state
       │          │
       └──────────┘
            │
    ┌───────┴───────┐
    │               │
    ▼               ▼
┌─────────┐   ┌─────────┐
│  IDLE   │   │ EXPIRED │
│         │   │         │
└─────────┘   └─────────┘
    │               │
    └───────┬───────┘
            │
            │ Cleanup
            ▼
       ┌──────────┐
       │ CLOSED   │
       │          │
       └──────────┘
```

### SessionManager 实现

```typescript
// packages/core/src/session/session-manager.ts

export class SessionManager {
  private store: SessionStore;
  private messageStore: MessageStore;
  private cache: Cache<Session>;
  private logger: Logger;
  private config: SessionManagerConfig;
  
  constructor(config?: SessionManagerConfig) {
    this.config = {
      maxSessions: 10000,
      sessionTTL: 3600000, // 1 hour
      enableCache: true,
      ...config,
    };
    
    this.store = new SessionStore();
    this.messageStore = new MessageStore();
    this.cache = createLRUCache<Session>({ maxSize: 1000 });
    this.logger = createLogger('session-manager');
    
    // 定期清理过期会话
    this.startCleanupScheduler();
  }
  
  async create(options: CreateSessionOptions): Promise<Session> {
    // 检查会话数量限制
    const activeCount = await this.getActiveCount(options.userId);
    if (activeCount >= this.config.maxSessions) {
      throw new SessionLimitExceededError(options.userId);
    }
    
    const session: Session = {
      id: this.generateId(),
      userId: options.userId,
      provider: options.provider,
      model: options.model,
      messages: [],
      metadata: options.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.sessionTTL),
    };
    
    // 保存到数据库
    await this.store.create(session);
    
    // 缓存
    if (this.config.enableCache) {
      this.cache.set(session.id, session);
    }
    
    this.logger.info('Session created', {
      sessionId: session.id,
      userId: session.userId,
    });
    
    return session;
  }
  
  async get(sessionId: string): Promise<Session | null> {
    // 尝试从缓存获取
    if (this.config.enableCache) {
      const cached = this.cache.get(sessionId);
      if (cached) {
        return cached;
      }
    }
    
    // 从数据库获取
    const session = await this.store.get(sessionId);
    if (!session) {
      return null;
    }
    
    // 检查是否过期
    if (session.expiresAt && session.expiresAt < new Date()) {
      await this.delete(sessionId);
      throw new SessionExpiredError(sessionId);
    }
    
    // 更新缓存
    if (this.config.enableCache) {
      this.cache.set(sessionId, session);
    }
    
    return session;
  }
  
  async update(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<Session> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    
    const updated = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };
    
    await this.store.update(sessionId, updated);
    
    // 更新缓存
    if (this.config.enableCache) {
      this.cache.set(sessionId, updated);
    }
    
    return updated;
  }
  
  async addMessage(
    sessionId: string,
    message: Omit<Message, 'id' | 'sessionId' | 'timestamp'>
  ): Promise<Message> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }
    
    const fullMessage: Message = {
      id: this.generateId(),
      sessionId,
      ...message,
      timestamp: new Date(),
    };
    
    // 保存消息
    await this.messageStore.add(fullMessage);
    
    // 更新会话
    await this.update(sessionId, {
      messages: [...session.messages, fullMessage],
    });
    
    return fullMessage;
  }
  
  async getMessages(
    sessionId: string,
    options?: PaginationOptions
  ): Promise<Message[]> {
    return this.messageStore.getBySession(sessionId, options);
  }
  
  async getMessagesPaginated(
    sessionId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<Message>> {
    return this.messageStore.getPaginated(sessionId, options);
  }
  
  async delete(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
    await this.messageStore.deleteBySession(sessionId);
    
    if (this.config.enableCache) {
      this.cache.delete(sessionId);
    }
    
    this.logger.info('Session deleted', { sessionId });
  }
  
  private async getActiveCount(userId: string): Promise<number> {
    return this.store.countActive(userId);
  }
  
  private startCleanupScheduler(): void {
    // 每 5 分钟清理一次过期会话
    setInterval(async () => {
      await this.cleanup();
    }, 300000);
  }
  
  async cleanup(): Promise<number> {
    const expired = await this.store.findExpired();
    
    for (const session of expired) {
      await this.delete(session.id);
    }
    
    this.logger.info(`Cleaned up ${expired.length} expired sessions`);
    return expired.length;
  }
  
  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 消息存储

```typescript
// packages/core/src/session/message-store.ts

export class MessageStore {
  private db: Database;
  private logger: Logger;
  
  constructor() {
    this.db = new Database();
    this.logger = createLogger('message-store');
  }
  
  async add(message: Message): Promise<void> {
    await this.db.query(
      `INSERT INTO messages (id, session_id, role, content, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        message.id,
        message.sessionId,
        message.role,
        message.content,
        message.metadata,
        message.timestamp,
      ]
    );
  }
  
  async getBySession(
    sessionId: string,
    options?: PaginationOptions
  ): Promise<Message[]> {
    const limit = options?.limit || 50;
    const offset = options?.cursor ? parseInt(options.cursor) : 0;
    
    const result = await this.db.query(
      `SELECT * FROM messages
       WHERE session_id = $1
       ORDER BY timestamp ASC
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    );
    
    return result.rows.map(this.mapRowToMessage);
  }
  
  async getPaginated(
    sessionId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<Message>> {
    const limit = options.limit || 50;
    const cursor = options.cursor ? parseInt(options.cursor) : 0;
    
    const messages = await this.getBySession(sessionId, {
      limit: limit + 1,
      cursor: cursor.toString(),
    });
    
    const hasNext = messages.length > limit;
    const items = hasNext ? messages.slice(0, -1) : messages;
    
    return {
      items,
      hasNext,
      hasPrev: cursor > 0,
      nextCursor: hasNext ? (cursor + limit).toString() : undefined,
      prevCursor: cursor > 0 ? Math.max(0, cursor - limit).toString() : undefined,
    };
  }
  
  async deleteBySession(sessionId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM messages WHERE session_id = $1',
      [sessionId]
    );
  }
  
  private mapRowToMessage(row: any): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      metadata: row.metadata,
      timestamp: row.timestamp,
    };
  }
}
```

---

## 🔀 Worker Pool

### 并发控制

Worker Pool 用于控制并发任务执行：

```typescript
// packages/core/src/workers/worker-pool.ts

export interface WorkerTask<T = any> {
  id: string;
  execute: () => Promise<T>;
  priority?: number;
}

export class WorkerPool {
  private concurrency: number;
  private queue: PriorityQueue<WorkerTask>;
  private activeWorkers: number = 0;
  private logger: Logger;
  
  constructor(concurrency: number = 5) {
    this.concurrency = concurrency;
    this.queue = new PriorityQueue<WorkerTask>((a, b) => {
      return (b.priority || 0) - (a.priority || 0);
    });
    this.logger = createLogger('worker-pool');
  }
  
  async submit<T>(task: WorkerTask<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.enqueue({
        ...task,
        execute: async () => {
          try {
            const result = await task.execute();
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        },
      });
      
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    while (this.activeWorkers < this.concurrency && !this.queue.isEmpty()) {
      const task = this.queue.dequeue();
      if (!task) break;
      
      this.activeWorkers++;
      this.logger.debug(`Starting task ${task.id}, active: ${this.activeWorkers}`);
      
      task.execute()
        .then(() => {
          this.activeWorkers--;
          this.logger.debug(`Completed task ${task.id}, active: ${this.activeWorkers}`);
          this.processQueue();
        })
        .catch((error) => {
          this.activeWorkers--;
          this.logger.error(`Task ${task.id} failed:`, error);
          this.processQueue();
        });
    }
  }
  
  getStats(): PoolStats {
    return {
      activeWorkers: this.activeWorkers,
      queuedTasks: this.queue.size(),
      availableSlots: this.concurrency - this.activeWorkers,
    };
  }
}
```

### 任务调度

```typescript
// packages/core/src/workers/task-scheduler.ts

export class TaskScheduler {
  private pool: WorkerPool;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private logger: Logger;
  
  constructor(pool: WorkerPool) {
    this.pool = pool;
    this.logger = createLogger('task-scheduler');
  }
  
  schedule(
    taskId: string,
    task: () => Promise<any>,
    options?: ScheduleOptions
  ): string {
    const scheduledTask: ScheduledTask = {
      id: taskId,
      task,
      scheduledAt: new Date(),
      runAt: options?.runAt,
      priority: options?.priority || 0,
      retries: options?.retries || 0,
      maxRetries: options?.maxRetries || 3,
    };
    
    this.scheduledTasks.set(taskId, scheduledTask);
    
    if (options?.runAt) {
      // 延迟执行
      const delay = options.runAt.getTime() - Date.now();
      setTimeout(() => this.executeTask(scheduledTask), delay);
    } else {
      // 立即执行
      this.executeTask(scheduledTask);
    }
    
    return taskId;
  }
  
  cancel(taskId: string): boolean {
    return this.scheduledTasks.delete(taskId);
  }
  
  private async executeTask(task: ScheduledTask): Promise<void> {
    try {
      await this.pool.submit({
        id: task.id,
        execute: task.task,
        priority: task.priority,
      });
      
      this.scheduledTasks.delete(task.id);
      this.logger.info(`Task ${task.id} completed successfully`);
      
    } catch (error: any) {
      this.logger.error(`Task ${task.id} failed:`, error);
      
      // 重试逻辑
      if (task.retries < task.maxRetries) {
        task.retries++;
        const delay = this.getRetryDelay(task.retries);
        
        this.logger.info(`Retrying task ${task.id} in ${delay}ms (attempt ${task.retries}/${task.maxRetries})`);
        
        setTimeout(() => this.executeTask(task), delay);
      } else {
        this.logger.error(`Task ${task.id} failed after ${task.maxRetries} retries`);
        this.scheduledTasks.delete(task.id);
      }
    }
  }
  
  private getRetryDelay(attempt: number): number {
    // 指数退避
    return Math.min(1000 * Math.pow(2, attempt), 30000);
  }
}
```

### 负载均衡

```typescript
// packages/core/src/workers/load-balancer.ts

export class LoadBalancer {
  private pools: WorkerPool[];
  private strategy: LoadBalanceStrategy;
  
  constructor(pools: WorkerPool[], strategy: LoadBalanceStrategy = 'round-robin') {
    this.pools = pools;
    this.strategy = strategy;
  }
  
  select(): WorkerPool {
    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin();
      case 'least-connections':
        return this.leastConnections();
      case 'random':
        return this.random();
      default:
        return this.roundRobin();
    }
  }
  
  private currentIndex: number = 0;
  
  private roundRobin(): WorkerPool {
    const pool = this.pools[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.pools.length;
    return pool;
  }
  
  private leastConnections(): WorkerPool {
    return this.pools.reduce((min, pool) => {
      const minStats = min.getStats();
      const poolStats = pool.getStats();
      return poolStats.activeWorkers < minStats.activeWorkers ? pool : min;
    });
  }
  
  private random(): WorkerPool {
    const index = Math.floor(Math.random() * this.pools.length);
    return this.pools[index];
  }
}
```

---

## 📡 事件系统

### EventEmitter 实现

```typescript
// packages/core/src/event/event-emitter.ts

export class EventEmitter {
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();
  private logger: Logger;
  
  constructor() {
    this.logger = createLogger('event-emitter');
  }
  
  on(eventType: EventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }
  
  onAll(handler: EventHandler): void {
    this.globalHandlers.add(handler);
  }
  
  off(eventType: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  async emit(event: AgentEvent): Promise<void> {
    this.logger.debug('Emitting event', { type: event.type });
    
    // 调用特定事件处理器
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error: any) {
          this.logger.error('Event handler error', error);
        }
      }
    }
    
    // 调用全局处理器
    for (const handler of this.globalHandlers) {
      try {
        await handler(event);
      } catch (error: any) {
        this.logger.error('Global handler error', error);
      }
    }
  }
  
  clear(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
  }
}
```

---

## 📊 性能监控

### 关键指标

```typescript
// 监控 Agent 性能
const metrics = {
  // Agent 指标
  agentStartTime: 0,
  agentEndTime: 0,
  toolExecutionTime: 0,
  llmCallTime: 0,
  
  // 会话指标
  activeSessions: 0,
  messagesPerSession: 0,
  
  // 系统指标
  cpuUsage: 0,
  memoryUsage: 0,
  eventLoopLag: 0,
};
```

---

## 📚 相关文档

- **[架构概览](./overview.md)** - 系统整体架构
- **[工具系统](./tool-system.md)** - 工具开发指南
- **[LLM 集成](./llm-integration.md)** - LLM 适配器
- **[性能优化](../best-practices/performance-optimization.md)** - 性能调优

---

**核心引擎文档完成！深入理解框架核心！** 🚀
