# 工具系统

本文档详细介绍 OpenAgent Framework 的工具系统设计，包括工具接口定义、注册机制、执行流程和安全机制。

---

## 📋 目录

1. [工具接口](#工具接口)
2. [工具注册](#工具注册)
3. [工具执行](#工具执行)
4. [安全机制](#安全机制)
5. [内置工具](#内置工具)

---

## 🔧 工具接口

### Tool 接口定义

所有工具都必须实现 `Tool` 接口：

```typescript
// packages/core/src/tool/types.ts

export interface Tool {
  /**
   * 工具名称（唯一标识）
   * - 使用 snake_case 命名
   * - 应该具有描述性
   * - 示例: get_weather, send_email, query_database
   */
  name: string;
  
  /**
   * 工具描述
   * - 清晰说明工具的用途
   * - LLM 会根据描述决定是否使用
   * - 建议包含使用示例
   */
  description: string;
  
  /**
   * 参数 Schema (JSON Schema 格式)
   * - 定义参数类型和结构
   * - 用于参数验证
   * - LLM 根据这个生成参数
   */
  parameters: JSONSchema;
  
  /**
   * 执行函数
   * @param params - 经验证的参数
   * @returns 工具执行结果
   */
  execute: (params: any) => Promise<ToolResult>;
  
  /**
   * 工具元数据（可选）
   */
  metadata?: {
    version?: string;
    author?: string;
    category?: string;
    tags?: string[];
    deprecated?: boolean;
    replacement?: string;
  };
}

/**
 * JSON Schema 定义
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, PropertySchema>;
  required?: string[];
  items?: JSONSchema;
  additionalProperties?: boolean;
  description?: string;
}

export interface PropertySchema {
  type: string;
  description?: string;
  enum?: any[];
  default?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  items?: JSONSchema;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  /**
   * 执行是否成功
   */
  success: boolean;
  
  /**
   * 返回数据（成功时）
   */
  data?: any;
  
  /**
   * 错误信息（失败时）
   */
  error?: string;
  
  /**
   * 元数据
   */
  metadata?: {
    duration?: number;         // 执行时长（毫秒）
    cached?: boolean;          // 是否来自缓存
    [key: string]: any;        // 其他自定义元数据
  };
}
```

### 参数验证（Zod）

框架使用 Zod 进行参数验证：

```typescript
// packages/core/src/tool/tool-validator.ts

import { z } from 'zod';

export class ToolValidator {
  /**
   * 验证参数是否符合 Schema
   */
  async validate(
    schema: JSONSchema,
    params: any
  ): Promise<ValidationResult> {
    try {
      // 转换 JSON Schema 到 Zod Schema
      const zodSchema = this.jsonSchemaToZod(schema);
      
      // 验证参数
      const validated = await zodSchema.parseAsync(params);
      
      return {
        valid: true,
        data: validated,
        errors: [],
      };
    } catch (error: any) {
      return {
        valid: false,
        data: null,
        errors: this.formatZodErrors(error),
      };
    }
  }
  
  /**
   * JSON Schema 转 Zod Schema
   */
  private jsonSchemaToZod(schema: JSONSchema): z.ZodType {
    switch (schema.type) {
      case 'string':
        return this.buildStringSchema(schema);
      case 'number':
      case 'integer':
        return this.buildNumberSchema(schema);
      case 'boolean':
        return z.boolean();
      case 'array':
        return this.buildArraySchema(schema);
      case 'object':
        return this.buildObjectSchema(schema);
      default:
        return z.any();
    }
  }
  
  private buildStringSchema(schema: JSONSchema): z.ZodString {
    let stringSchema = z.string();
    
    if (schema.minLength) {
      stringSchema = stringSchema.min(schema.minLength);
    }
    
    if (schema.maxLength) {
      stringSchema = stringSchema.max(schema.maxLength);
    }
    
    if (schema.pattern) {
      stringSchema = stringSchema.regex(new RegExp(schema.pattern));
    }
    
    return stringSchema;
  }
  
  private buildNumberSchema(schema: JSONSchema): z.ZodNumber {
    let numberSchema = schema.type === 'integer' 
      ? z.number().int() 
      : z.number();
    
    if (schema.minimum !== undefined) {
      numberSchema = numberSchema.min(schema.minimum);
    }
    
    if (schema.maximum !== undefined) {
      numberSchema = numberSchema.max(schema.maximum);
    }
    
    return numberSchema;
  }
  
  private buildArraySchema(schema: JSONSchema): z.ZodArray<any> {
    if (!schema.items) {
      return z.array(z.any());
    }
    
    return z.array(this.jsonSchemaToZod(schema.items));
  }
  
  private buildObjectSchema(schema: JSONSchema): z.ZodObject<any> {
    const shape: Record<string, z.ZodType> = {};
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        let fieldSchema = this.jsonSchemaToZod(prop);
        
        // 如果不是必需字段，设为可选
        if (!schema.required?.includes(key)) {
          fieldSchema = fieldSchema.optional();
        }
        
        shape[key] = fieldSchema;
      }
    }
    
    return z.object(shape);
  }
  
  private formatZodErrors(error: z.ZodError): string[] {
    return error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    );
  }
}

export interface ValidationResult {
  valid: boolean;
  data: any;
  errors: string[];
}
```

### 返回结果格式

工具应返回标准化的结果：

```typescript
// 成功结果
const successResult: ToolResult = {
  success: true,
  data: {
    temperature: 25,
    humidity: 60,
    condition: 'sunny',
  },
  metadata: {
    duration: 150,
    cached: false,
    source: 'openweathermap',
  },
};

// 错误结果
const errorResult: ToolResult = {
  success: false,
  error: 'City not found: InvalidCity',
  metadata: {
    duration: 10,
  },
};

// 部分成功（警告）
const warningResult: ToolResult = {
  success: true,
  data: {
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
  },
  metadata: {
    duration: 200,
    warnings: ['3 records skipped due to validation errors'],
  },
};
```

---

## 📝 工具注册

### 注册机制

```typescript
// packages/core/src/tool/tool-registry.ts

export interface RegisteredTool extends Tool {
  options: ToolOptions;
  registeredAt: Date;
  registeredBy?: string;
}

export interface ToolOptions {
  enabled?: boolean;              // 是否启用
  timeout?: number;               // 超时时间（毫秒）
  permissions?: string[];         // 所需权限
  category?: string;              // 分类
  tags?: string[];                // 标签
  rateLimit?: {                   // 速率限制
    maxRequests: number;
    windowMs: number;
  };
  cache?: {                       // 缓存配置
    enabled: boolean;
    ttl: number;
    keyGenerator?: (params: any) => string;
  };
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private logger: Logger;
  
  constructor() {
    this.logger = createLogger('tool-registry');
  }
  
  /**
   * 注册工具
   */
  register(tool: Tool, options?: ToolOptions): void {
    // 验证工具定义
    this.validateTool(tool);
    
    // 检查是否已存在
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} already registered, overwriting`);
    }
    
    // 创建注册的工具
    const registeredTool: RegisteredTool = {
      ...tool,
      options: {
        enabled: true,
        timeout: 30000,
        ...options,
      },
      registeredAt: new Date(),
    };
    
    // 添加到注册表
    this.tools.set(tool.name, registeredTool);
    
    // 添加到分类
    if (registeredTool.options.category) {
      this.addToCategory(
        registeredTool.options.category,
        tool.name
      );
    }
    
    this.logger.info(`Tool registered: ${tool.name}`, {
      category: registeredTool.options.category,
      enabled: registeredTool.options.enabled,
    });
  }
  
  /**
   * 批量注册工具
   */
  registerAll(tools: Array<{ tool: Tool; options?: ToolOptions }>): void {
    for (const { tool, options } of tools) {
      this.register(tool, options);
    }
  }
  
  /**
   * 取消注册
   */
  unregister(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) {
      this.logger.warn(`Tool ${toolName} not found`);
      return false;
    }
    
    this.tools.delete(toolName);
    
    // 从分类中移除
    if (tool.options.category) {
      this.removeFromCategory(tool.options.category, toolName);
    }
    
    this.logger.info(`Tool unregistered: ${toolName}`);
    return true;
  }
  
  /**
   * 获取工具
   */
  get(toolName: string): RegisteredTool | undefined {
    return this.tools.get(toolName);
  }
  
  /**
   * 获取所有工具
   */
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * 按分类获取
   */
  getByCategory(category: string): RegisteredTool[] {
    const toolNames = this.categories.get(category);
    if (!toolNames) return [];
    
    return Array.from(toolNames)
      .map(name => this.tools.get(name))
      .filter((tool): tool is RegisteredTool => tool !== undefined);
  }
  
  /**
   * 按标签获取
   */
  getByTags(tags: string[]): RegisteredTool[] {
    return this.getAll().filter(tool => {
      const toolTags = tool.options.tags || [];
      return tags.some(tag => toolTags.includes(tag));
    });
  }
  
  /**
   * 搜索工具
   */
  search(query: string): RegisteredTool[] {
    const lowerQuery = query.toLowerCase();
    
    return this.getAll().filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.options.tags?.some(tag => 
        tag.toLowerCase().includes(lowerQuery)
      )
    );
  }
  
  /**
   * 启用/禁用工具
   */
  setEnabled(toolName: string, enabled: boolean): void {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }
    
    tool.options.enabled = enabled;
    this.logger.info(`Tool ${toolName} ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  private validateTool(tool: Tool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool name is required and must be a string');
    }
    
    if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      throw new Error(
        'Tool name must be snake_case and start with a letter'
      );
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
  
  private addToCategory(category: string, toolName: string): void {
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category)!.add(toolName);
  }
  
  private removeFromCategory(category: string, toolName: string): void {
    const tools = this.categories.get(category);
    if (tools) {
      tools.delete(toolName);
      if (tools.size === 0) {
        this.categories.delete(category);
      }
    }
  }
}
```

### 动态加载

```typescript
// packages/core/src/tool/tool-loader.ts

export class ToolLoader {
  private registry: ToolRegistry;
  private logger: Logger;
  
  constructor(registry: ToolRegistry) {
    this.registry = registry;
    this.logger = createLogger('tool-loader');
  }
  
  /**
   * 从文件加载工具
   */
  async loadFromFile(filePath: string): Promise<void> {
    try {
      const module = await import(filePath);
      const tool = module.default || module.tool;
      
      if (!tool) {
        throw new Error(`No tool exported from ${filePath}`);
      }
      
      this.registry.register(tool, module.options);
      this.logger.info(`Tool loaded from file: ${filePath}`);
    } catch (error: any) {
      this.logger.error(`Failed to load tool from ${filePath}`, error);
      throw error;
    }
  }
  
  /**
   * 从目录加载工具
   */
  async loadFromDirectory(dirPath: string): Promise<number> {
    const files = await fs.readdir(dirPath);
    let loadedCount = 0;
    
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        try {
          await this.loadFromFile(path.join(dirPath, file));
          loadedCount++;
        } catch (error) {
          // 继续加载其他文件
          continue;
        }
      }
    }
    
    this.logger.info(`Loaded ${loadedCount} tools from ${dirPath}`);
    return loadedCount;
  }
  
  /**
   * 从 NPM 包加载工具
   */
  async loadFromPackage(packageName: string): Promise<void> {
    try {
      const module = await import(packageName);
      const tools = module.tools || [module.default];
      
      for (const tool of tools) {
        this.registry.register(tool, module.options);
      }
      
      this.logger.info(`Tools loaded from package: ${packageName}`);
    } catch (error: any) {
      this.logger.error(`Failed to load tools from ${packageName}`, error);
      throw error;
    }
  }
}
```

### 工具发现

```typescript
// packages/core/src/tool/tool-discovery.ts

export class ToolDiscovery {
  private registry: ToolRegistry;
  private logger: Logger;
  
  constructor(registry: ToolRegistry) {
    this.registry = registry;
    this.logger = createLogger('tool-discovery');
  }
  
  /**
   * 发现适合任务的工具
   */
  discoverForTask(task: string): RegisteredTool[] {
    const allTools = this.registry.getAll();
    
    // 简单的关键词匹配
    // 实际应用中可以使用向量搜索或 LLM 辅助
    const taskLower = task.toLowerCase();
    
    return allTools.filter(tool => {
      const keywords = [
        tool.name,
        tool.description,
        ...(tool.options.tags || []),
      ].map(k => k.toLowerCase());
      
      return keywords.some(k => taskLower.includes(k));
    });
  }
  
  /**
   * 获取工具推荐
   */
  async getRecommendations(
    context: string,
    limit: number = 5
  ): Promise<ToolRecommendation[]> {
    const tools = this.discoverForTask(context);
    
    // 计算相关性分数
    const scored = tools.map(tool => ({
      tool,
      score: this.calculateRelevanceScore(tool, context),
    }));
    
    // 排序并返回 top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ tool, score }) => ({
        name: tool.name,
        description: tool.description,
        score,
        reason: this.generateRecommendationReason(tool, context),
      }));
  }
  
  private calculateRelevanceScore(tool: RegisteredTool, context: string): number {
    let score = 0;
    const contextLower = context.toLowerCase();
    
    // 名称匹配
    if (contextLower.includes(tool.name.toLowerCase())) {
      score += 3;
    }
    
    // 描述匹配
    const descWords = tool.description.toLowerCase().split(/\s+/);
    for (const word of descWords) {
      if (contextLower.includes(word)) {
        score += 1;
      }
    }
    
    // 标签匹配
    const tags = tool.options.tags || [];
    for (const tag of tags) {
      if (contextLower.includes(tag.toLowerCase())) {
        score += 2;
      }
    }
    
    return score;
  }
  
  private generateRecommendationReason(
    tool: RegisteredTool,
    context: string
  ): string {
    const matches = [];
    const contextLower = context.toLowerCase();
    
    if (contextLower.includes(tool.name.toLowerCase())) {
      matches.push('name matches');
    }
    
    if (tool.options.tags?.some(t => contextLower.includes(t.toLowerCase()))) {
      matches.push('relevant tags');
    }
    
    return matches.length > 0 
      ? `Recommended because: ${matches.join(', ')}`
      : 'General purpose tool';
  }
}

export interface ToolRecommendation {
  name: string;
  description: string;
  score: number;
  reason: string;
}
```

---

## ⚙️ 工具执行

### 执行流程图

```
┌───────────────────────────────────────────────────────┐
│          Tool Execution Flow                           │
└───────────────────────────────────────────────────────┘

Tool Call from Agent
         │
         ▼
    ┌─────────┐
    │  Input  │  Receive tool call
    └─────────┘
         │
         ▼
    ┌─────────┐
    │ Lookup  │  Find tool in registry
    └─────────┘
         │
         ├───── Not Found ──────> Return Error
         │
         ▼
    ┌─────────┐
    │ Enabled │  Check if tool enabled
    └─────────┘
         │
         ├───── Disabled ───────> Return Error
         │
         ▼
    ┌─────────┐
    │Validate │  Validate parameters
    └─────────┘
         │
         ├───── Invalid ────────> Return Error
         │
         ▼
    ┌─────────┐
    │ Permit  │  Check permissions
    └─────────┘
         │
         ├───── Denied ─────────> Return Error
         │
         ▼
    ┌─────────┐
    │ Rate    │  Check rate limit
    │ Limit   │
    └─────────┘
         │
         ├───── Exceeded ───────> Return Error
         │
         ▼
    ┌─────────┐
    │ Cache   │  Check cache
    │ Lookup  │
    └─────────┘
         │
         ├───── Hit ────────────> Return Cached Result
         │
         ▼
    ┌─────────┐
    │ Execute │  Run tool function
    │(Timeout)│
    └─────────┘
         │
         ├───── Timeout ────────> Return Error
         │
         ├───── Error ──────────> Return Error
         │
         ▼
    ┌─────────┐
    │  Cache  │  Cache result (if enabled)
    │  Store  │
    └─────────┘
         │
         ▼
    ┌─────────┐
    │  Audit  │  Log execution
    │  Log    │
    └─────────┘
         │
         ▼
    ┌─────────┐
    │ Return  │  Return result to agent
    └─────────┘
```

### ToolExecutor 实现

```typescript
// packages/core/src/tool/tool-executor.ts

export class ToolExecutor {
  private registry: ToolRegistry;
  private validator: ToolValidator;
  private cache: Cache<ToolResult>;
  private rateLimiter: RateLimiter;
  private logger: Logger;
  private config: ExecutorConfig;
  
  constructor(
    registry?: ToolRegistry,
    validator?: ToolValidator,
    config?: ExecutorConfig
  ) {
    this.registry = registry || new ToolRegistry();
    this.validator = validator || new ToolValidator();
    this.cache = createLRUCache<ToolResult>({ maxSize: 1000 });
    this.rateLimiter = new RateLimiter();
    this.logger = createLogger('tool-executor');
    this.config = {
      timeout: 30000,
      enableCache: true,
      enableRateLimit: true,
      enableAudit: true,
      ...config,
    };
  }
  
  /**
   * 执行工具
   */
  async execute(
    toolName: string,
    params: any,
    context?: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // 1. 获取工具
      const tool = this.getTool(toolName);
      
      // 2. 检查权限
      await this.checkPermissions(tool, context);
      
      // 3. 速率限制检查
      await this.checkRateLimit(tool, context);
      
      // 4. 参数验证
      const validatedParams = await this.validateParams(tool, params);
      
      // 5. 检查缓存
      const cachedResult = await this.checkCache(tool, validatedParams);
      if (cachedResult) {
        return this.addMetadata(cachedResult, startTime, true);
      }
      
      // 6. 执行工具（带超时）
      const result = await this.executeWithTimeout(
        tool,
        validatedParams,
        tool.options.timeout || this.config.timeout!
      );
      
      // 7. 缓存结果
      if (this.config.enableCache && result.success) {
        await this.cacheResult(tool, validatedParams, result);
      }
      
      // 8. 记录审计日志
      if (this.config.enableAudit) {
        await this.auditLog(tool, validatedParams, result, startTime);
      }
      
      return this.addMetadata(result, startTime, false);
      
    } catch (error: any) {
      const errorResult: ToolResult = {
        success: false,
        error: error.message,
        metadata: { duration: Date.now() - startTime },
      };
      
      // 记录错误日志
      this.logger.error('Tool execution failed', {
        tool: toolName,
        error: error.message,
        duration: Date.now() - startTime,
      });
      
      return errorResult;
    }
  }
  
  /**
   * 批量执行工具
   */
  async executeBatch(
    tasks: Array<{ toolName: string; params: any }>,
    context?: ExecutionContext
  ): Promise<ToolResult[]> {
    return Promise.all(
      tasks.map(task => this.execute(task.toolName, task.params, context))
    );
  }
  
  /**
   * 获取工具
   */
  private getTool(toolName: string): RegisteredTool {
    const tool = this.registry.get(toolName);
    
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }
    
    if (!tool.options.enabled) {
      throw new ToolDisabledError(toolName);
    }
    
    return tool;
  }
  
  /**
   * 权限检查
   */
  private async checkPermissions(
    tool: RegisteredTool,
    context?: ExecutionContext
  ): Promise<void> {
    if (!context?.permissions) {
      return;
    }
    
    const required = tool.options.permissions || [];
    const hasAll = required.every(
      perm => context.permissions!.includes(perm)
    );
    
    if (!hasAll) {
      throw new PermissionDeniedError(
        `Missing permissions for tool: ${tool.name}`
      );
    }
  }
  
  /**
   * 速率限制检查
   */
  private async checkRateLimit(
    tool: RegisteredTool,
    context?: ExecutionContext
  ): Promise<void> {
    if (!this.config.enableRateLimit) {
      return;
    }
    
    const rateLimit = tool.options.rateLimit;
    if (!rateLimit) {
      return;
    }
    
    const key = `${tool.name}:${context?.userId || 'anonymous'}`;
    const allowed = await this.rateLimiter.check(
      key,
      rateLimit.maxRequests,
      rateLimit.windowMs
    );
    
    if (!allowed) {
      throw new RateLimitExceededError(tool.name);
    }
  }
  
  /**
   * 参数验证
   */
  private async validateParams(
    tool: RegisteredTool,
    params: any
  ): Promise<any> {
    const validation = await this.validator.validate(
      tool.parameters,
      params
    );
    
    if (!validation.valid) {
      throw new ToolValidationError(
        `Parameter validation failed: ${validation.errors.join(', ')}`
      );
    }
    
    return validation.data;
  }
  
  /**
   * 检查缓存
   */
  private async checkCache(
    tool: RegisteredTool,
    params: any
  ): Promise<ToolResult | null> {
    if (!this.config.enableCache) {
      return null;
    }
    
    const cacheConfig = tool.options.cache;
    if (!cacheConfig?.enabled) {
      return null;
    }
    
    const key = this.getCacheKey(tool, params);
    const cached = this.cache.get(key);
    
    if (cached) {
      this.logger.debug(`Cache hit for tool: ${tool.name}`);
      return cached;
    }
    
    return null;
  }
  
  /**
   * 缓存结果
   */
  private async cacheResult(
    tool: RegisteredTool,
    params: any,
    result: ToolResult
  ): Promise<void> {
    const cacheConfig = tool.options.cache;
    if (!cacheConfig?.enabled) {
      return;
    }
    
    const key = this.getCacheKey(tool, params);
    this.cache.set(key, result, { ttl: cacheConfig.ttl });
  }
  
  /**
   * 生成缓存键
   */
  private getCacheKey(tool: RegisteredTool, params: any): string {
    const cacheConfig = tool.options.cache;
    
    if (cacheConfig?.keyGenerator) {
      return `${tool.name}:${cacheConfig.keyGenerator(params)}`;
    }
    
    return `${tool.name}:${JSON.stringify(params)}`;
  }
  
  /**
   * 执行工具（带超时）
   */
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
  
  /**
   * 审计日志
   */
  private async auditLog(
    tool: RegisteredTool,
    params: any,
    result: ToolResult,
    startTime: number
  ): Promise<void> {
    this.logger.info('Tool executed', {
      tool: tool.name,
      success: result.success,
      duration: Date.now() - startTime,
      params: this.sanitizeParams(params),
      error: result.error,
    });
  }
  
  /**
   * 清理敏感参数
   */
  private sanitizeParams(params: any): any {
    const sanitized = { ...params };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'key'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }
  
  /**
   * 添加元数据
   */
  private addMetadata(
    result: ToolResult,
    startTime: number,
    cached: boolean
  ): ToolResult {
    return {
      ...result,
      metadata: {
        ...result.metadata,
        duration: Date.now() - startTime,
        cached,
      },
    };
  }
}
```

---

## 🔒 安全机制

### 参数验证

```typescript
// 严格的参数验证示例

const secureTool: Tool = {
  name: 'query_database',
  description: 'Query the database',
  
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'SQL query',
        minLength: 1,
        maxLength: 1000,
      },
      params: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 100,
      },
    },
    required: ['query'],
  },
  
  execute: async (params) => {
    // 额外的安全检查
    if (containsSQLInjection(params.query)) {
      return {
        success: false,
        error: 'Invalid query: potential SQL injection detected',
      };
    }
    
    // 执行查询
    const result = await database.query(params.query, params.params);
    
    return {
      success: true,
      data: result,
    };
  },
};
```

### 权限控制

```typescript
// 权限系统配置

const adminTool: Tool = {
  name: 'delete_user',
  description: 'Delete a user account (admin only)',
  
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID to delete',
      },
    },
    required: ['userId'],
  },
  
  // 在 ToolOptions 中指定所需权限
  metadata: {
    permissions: ['admin', 'user:delete'],
  },
  
  execute: async (params) => {
    // 删除用户
    await userManager.delete(params.userId);
    
    return {
      success: true,
      data: { deleted: true },
    };
  },
};

// 注册时设置权限
registry.register(adminTool, {
  permissions: ['admin', 'user:delete'],
});
```

### 审计日志

```typescript
// 审计日志系统

export class AuditLogger {
  private logger: Logger;
  private db: Database;
  
  constructor() {
    this.logger = createLogger('audit');
    this.db = new Database();
  }
  
  async log(entry: AuditEntry): Promise<void> {
    // 写入日志
    await this.db.query(
      `INSERT INTO audit_logs 
       (timestamp, user_id, action, resource, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.timestamp,
        entry.userId,
        entry.action,
        entry.resource,
        JSON.stringify(entry.details),
        entry.ipAddress,
      ]
    );
    
    // 同时写入日志文件
    this.logger.info('Audit', entry);
  }
  
  async query(filters: AuditFilters): Promise<AuditEntry[]> {
    // 查询审计日志
    const result = await this.db.query(
      `SELECT * FROM audit_logs
       WHERE user_id = $1
       AND action = $2
       AND timestamp >= $3
       ORDER BY timestamp DESC
       LIMIT 100`,
      [filters.userId, filters.action, filters.startDate]
    );
    
    return result.rows;
  }
}

export interface AuditEntry {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
}
```

---

## 🛠️ 内置工具

OpenAgent Framework 提供了一系列内置工具：

### 1. HTTP 请求工具

```typescript
// packages/tools/src/http-request.ts

export const httpRequestTool: Tool = {
  name: 'http_request',
  description: 'Make HTTP requests to external APIs',
  
  parameters: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        description: 'HTTP method',
      },
      url: {
        type: 'string',
        format: 'uri',
        description: 'Request URL',
      },
      headers: {
        type: 'object',
        description: 'Request headers',
      },
      body: {
        type: 'object',
        description: 'Request body',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        default: 30000,
      },
    },
    required: ['method', 'url'],
  },
  
  execute: async (params) => {
    try {
      const response = await fetch(params.url, {
        method: params.method,
        headers: params.headers,
        body: params.body ? JSON.stringify(params.body) : undefined,
      });
      
      const data = await response.json();
      
      return {
        success: response.ok,
        data: {
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: data,
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

### 2. 文件操作工具

```typescript
// packages/tools/src/file-operations.ts

export const fileReadTool: Tool = {
  name: 'file_read',
  description: 'Read file contents',
  
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path',
      },
      encoding: {
        type: 'string',
        enum: ['utf-8', 'binary'],
        default: 'utf-8',
      },
    },
    required: ['path'],
  },
  
  execute: async (params) => {
    try {
      // 安全检查：防止路径遍历
      const safePath = sanitizePath(params.path);
      
      const content = await fs.readFile(safePath, params.encoding);
      
      return {
        success: true,
        data: {
          content: content.toString(),
          size: content.length,
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

### 3. 计算工具

```typescript
// packages/tools/src/calculator.ts

export const calculatorTool: Tool = {
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
        minimum: 0,
        maximum: 15,
        default: 2,
      },
    },
    required: ['expression'],
  },
  
  execute: async (params) => {
    try {
      // 安全地计算表达式（不使用 eval）
      const result = safeEvaluate(params.expression);
      
      return {
        success: true,
        data: {
          result: Number(result.toFixed(params.precision)),
          expression: params.expression,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Invalid expression: ${error.message}`,
      };
    }
  },
};

function safeEvaluate(expression: string): number {
  // 使用安全的表达式解析器
  // 避免使用 eval
  const parser = new MathParser();
  return parser.evaluate(expression);
}
```

---

## 📚 相关文档

- **[核心引擎](./core-engine.md)** - Agent 和工具执行引擎
- **[LLM 集成](./llm-integration.md)** - LLM 适配器配置
- **[工具开发最佳实践](../best-practices/tool-development.md)** - 工具开发指南
- **[创建自定义工具](../getting-started/custom-tools.md)** - 自定义工具教程

---

**工具系统文档完成！开始构建强大的工具！** 🔧
