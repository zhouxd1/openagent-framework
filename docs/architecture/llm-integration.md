# LLM 集成

本文档详细介绍 OpenAgent Framework 如何集成多个大语言模型（LLM）提供商，包括适配器设计、流式响应、Token 管理和成本优化。

---

## 📋 目录

1. [适配器模式](#适配器模式)
2. [支持的 LLM](#支持的-llm)
3. [流式响应](#流式响应)
4. [Token 管理](#token-管理)
5. [错误处理](#错误处理)
6. [多模型编排](#多模型编排)

---

## 🎯 适配器模式

### 统一接口

所有 LLM 适配器都实现统一的 `LLMAdapter` 接口：

```typescript
// packages/core/src/llm/types.ts

/**
 * LLM 适配器接口
 */
export interface LLMAdapter {
  /**
   * 适配器名称
   */
  readonly name: string;
  
  /**
   * 支持的模型列表
   */
  readonly models: string[];
  
  /**
   * 初始化适配器
   */
  initialize(): Promise<void>;
  
  /**
   * 发送聊天请求
   */
  chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse>;
  
  /**
   * 流式聊天
   */
  chatStream?(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterator<StreamChunk>;
  
  /**
   * 计算Token数量
   */
  countTokens?(text: string): Promise<number>;
  
  /**
   * 获取模型信息
   */
  getModelInfo?(model: string): ModelInfo;
  
  /**
   * 健康检查
   */
  healthCheck?(): Promise<boolean>;
}

/**
 * 消息格式
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

/**
 * 聊天选项
 */
export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  tools?: ToolDefinition[];
  responseFormat?: { type: 'text' | 'json_object' };
  metadata?: Record<string, any>;
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  metadata?: {
    model: string;
    provider: string;
    latency: number;
    [key: string]: any;
  };
}

/**
 * Token 使用情况
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 流式响应块
 */
export interface StreamChunk {
  content?: string;
  toolCalls?: Partial<ToolCall>;
  finishReason?: string;
  usage?: TokenUsage;
}

/**
 * 模型信息
 */
export interface ModelInfo {
  name: string;
  provider: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  pricing: {
    inputPer1k: number;
    outputPer1k: number;
  };
}
```

### BaseLLMAdapter 基类

```typescript
// packages/core/src/llm/base-adapter.ts

export abstract class BaseLLMAdapter implements LLMAdapter {
  abstract readonly name: string;
  abstract readonly models: string[];
  
  protected config: LLMAdapterConfig;
  protected logger: Logger;
  protected httpClient: HttpClient;
  
  constructor(config: LLMAdapterConfig) {
    this.config = config;
    this.logger = createLogger(`llm:${this.name}`);
    this.httpClient = new HttpClient({
      timeout: config.timeout || 60000,
      retries: config.retries || 3,
    });
  }
  
  async initialize(): Promise<void> {
    // 验证配置
    this.validateConfig();
    
    // 执行健康检查
    if (this.config.healthCheck !== false) {
      const healthy = await this.healthCheck();
      if (!healthy) {
        throw new Error(`Failed to connect to ${this.name} API`);
      }
    }
    
    this.logger.info(`${this.name} adapter initialized`);
  }
  
  abstract chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse>;
  
  async healthCheck(): Promise<boolean> {
    try {
      // 简单的健康检查：尝试获取模型列表
      await this.getModelList();
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }
  
  getModelInfo(model: string): ModelInfo {
    const modelConfig = this.config.models?.[model];
    
    return {
      name: model,
      provider: this.name,
      maxTokens: modelConfig?.maxTokens || 4096,
      supportsStreaming: modelConfig?.supportsStreaming !== false,
      supportsTools: modelConfig?.supportsTools !== false,
      supportsVision: modelConfig?.supportsVision || false,
      pricing: modelConfig?.pricing || {
        inputPer1k: 0,
        outputPer1k: 0,
      },
    };
  }
  
  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.name}`);
    }
  }
  
  protected abstract getModelList(): Promise<any>;
  
  /**
   * 通用重试逻辑
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // 判断是否应该重试
        if (!this.shouldRetry(error)) {
          throw error;
        }
        
        // 等待后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.logger.warn(
          `Attempt ${attempt} failed, retrying in ${delay}ms`,
          { error: error.message }
        );
        await sleep(delay);
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
  
  protected shouldRetry(error: any): boolean {
    // 网络错误：重试
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // 速率限制：重试
    if (error.status === 429) {
      return true;
    }
    
    // 服务器错误：重试
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // 其他错误：不重试
    return false;
  }
}

export interface LLMAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  healthCheck?: boolean;
  models?: Record<string, ModelConfig>;
}

export interface ModelConfig {
  maxTokens?: number;
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  supportsVision?: boolean;
  pricing?: {
    inputPer1k: number;
    outputPer1k: number;
  };
}
```

---

## 🤖 支持的 LLM

### OpenAI

```typescript
// packages/llm-openai/src/adapter.ts

export class OpenAIAdapter extends BaseLLMAdapter {
  readonly name = 'openai';
  readonly models = [
    'gpt-4-turbo-preview',
    'gpt-4',
    'gpt-4-32k',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
  ];
  
  private baseUrl = 'https://api.openai.com/v1';
  
  constructor(config: OpenAIConfig) {
    super(config);
    
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }
  
  async chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    
    return this.withRetry(async () => {
      const request = this.buildRequest(messages, options);
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/chat/completions`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );
      
      const data = JSON.parse(response.body);
      
      return this.parseResponse(data, startTime);
    });
  }
  
  async *chatStream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterator<StreamChunk> {
    const request = this.buildRequest(messages, options);
    request.stream = true;
    
    const response = await this.httpClient.post(
      `${this.baseUrl}/chat/completions`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );
    
    // 解析 SSE 流
    for await (const chunk of this.parseSSE(response.body)) {
      yield chunk;
    }
  }
  
  private buildRequest(
    messages: Message[],
    options?: ChatOptions
  ): OpenAIRequest {
    return {
      model: options?.model || this.config.defaultModel || 'gpt-4-turbo-preview',
      messages: messages.map(this.convertMessage),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stop: options?.stopSequences,
      tools: options?.tools?.map(this.convertTool),
      response_format: options?.responseFormat,
    };
  }
  
  private convertMessage(message: Message): OpenAIMessage {
    const openaiMessage: OpenAIMessage = {
      role: message.role,
      content: message.content,
    };
    
    if (message.name) {
      openaiMessage.name = message.name;
    }
    
    if (message.toolCalls) {
      openaiMessage.tool_calls = message.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }
    
    if (message.toolCallId) {
      openaiMessage.tool_call_id = message.toolCallId;
    }
    
    return openaiMessage;
  }
  
  private convertTool(tool: ToolDefinition): OpenAITool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }
  
  private parseResponse(data: any, startTime: number): ChatResponse {
    const choice = data.choices[0];
    
    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: choice.finish_reason,
      metadata: {
        model: data.model,
        provider: 'openai',
        latency: Date.now() - startTime,
      },
    };
  }
  
  private async *parseSSE(body: string): AsyncIterator<StreamChunk> {
    const lines = body.split('\n');
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      
      const data = line.slice(6);
      if (data === '[DONE]') break;
      
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices[0]?.delta;
        
        if (delta) {
          yield {
            content: delta.content,
            toolCalls: delta.tool_calls?.map((tc: any) => ({
              id: tc.id,
              name: tc.function?.name,
              arguments: tc.function?.arguments 
                ? JSON.parse(tc.function.arguments)
                : undefined,
            })),
          };
        }
      } catch (error) {
        // 忽略解析错误
      }
    }
  }
  
  protected async getModelList(): Promise<any> {
    const response = await this.httpClient.get(
      `${this.baseUrl}/models`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      }
    );
    
    return JSON.parse(response.body);
  }
}

export interface OpenAIConfig extends LLMAdapterConfig {
  defaultModel?: string;
  organization?: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
  tools?: OpenAITool[];
  response_format?: { type: string };
  stream?: boolean;
}

interface OpenAIMessage {
  role: string;
  content: string;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}
```

### Claude (Anthropic)

```typescript
// packages/llm-claude/src/adapter.ts

export class ClaudeAdapter extends BaseLLMAdapter {
  readonly name = 'claude';
  readonly models = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-2.1',
    'claude-2.0',
  ];
  
  private baseUrl = 'https://api.anthropic.com/v1';
  
  constructor(config: ClaudeConfig) {
    super(config);
    
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }
  
  async chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    
    return this.withRetry(async () => {
      const request = this.buildRequest(messages, options);
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/messages`,
        {
          headers: {
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      );
      
      const data = JSON.parse(response.body);
      
      return this.parseResponse(data, startTime);
    });
  }
  
  private buildRequest(
    messages: Message[],
    options?: ChatOptions
  ): ClaudeRequest {
    // Claude 需要分离 system prompt
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    return {
      model: options?.model || this.config.defaultModel || 'claude-3-opus-20240229',
      messages: otherMessages.map(this.convertMessage),
      system: systemMessage?.content,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature,
      top_p: options?.topP,
      stop_sequences: options?.stopSequences,
      tools: options?.tools?.map(this.convertTool),
    };
  }
  
  private convertMessage(message: Message): ClaudeMessage {
    return {
      role: message.role === 'tool' ? 'user' : message.role,
      content: message.content,
    };
  }
  
  private convertTool(tool: ToolDefinition): ClaudeTool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    };
  }
  
  private parseResponse(data: any, startTime: number): ChatResponse {
    const content = data.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');
    
    const toolCalls = data.content
      .filter((block: any) => block.type === 'tool_use')
      .map((block: any) => ({
        id: block.id,
        name: block.name,
        arguments: block.input,
      }));
    
    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'tool_calls',
      metadata: {
        model: data.model,
        provider: 'claude',
        latency: Date.now() - startTime,
      },
    };
  }
  
  protected async getModelList(): Promise<any> {
    // Claude 不提供模型列表 API，直接返回配置的模型
    return { models: this.models };
  }
}

export interface ClaudeConfig extends LLMAdapterConfig {
  defaultModel?: string;
}

interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  tools?: ClaudeTool[];
}

interface ClaudeMessage {
  role: string;
  content: string;
}

interface ClaudeTool {
  name: string;
  description: string;
  input_schema: any;
}
```

### DeepSeek

```typescript
// packages/llm-deepseek/src/adapter.ts

export class DeepSeekAdapter extends BaseLLMAdapter {
  readonly name = 'deepseek';
  readonly models = [
    'deepseek-chat',
    'deepseek-coder',
  ];
  
  private baseUrl = 'https://api.deepseek.com/v1';
  
  // DeepSeek API 兼容 OpenAI 格式
  // 可以继承或复用 OpenAI Adapter 的逻辑
}
```

### GLM (智谱)

```typescript
// packages/llm-glm/src/adapter.ts

export class GLMAdapter extends BaseLLMAdapter {
  readonly name = 'glm';
  readonly models = [
    'glm-4',
    'glm-4-air',
    'glm-4-airx',
    'glm-3-turbo',
  ];
  
  private baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
  
  // GLM API 类似 OpenAI，但有些细微差别
}
```

### Ollama

```typescript
// packages/llm-ollama/src/adapter.ts

export class OllamaAdapter extends BaseLLMAdapter {
  readonly name = 'ollama';
  readonly models: string[] = []; // 动态获取
  
  private baseUrl = 'http://localhost:11434';
  
  constructor(config: OllamaConfig) {
    super(config);
    
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }
  
  async initialize(): Promise<void> {
    // Ollama 不需要 API key
    // 获取可用模型列表
    const models = await this.getModelList();
    (this as any).models = models.map((m: any) => m.name);
    
    this.logger.info('Ollama adapter initialized', {
      models: this.models,
    });
  }
  
  async chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    
    const request = {
      model: options?.model || this.config.defaultModel || 'llama2',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      options: {
        temperature: options?.temperature,
        num_predict: options?.maxTokens,
        top_p: options?.topP,
        stop: options?.stopSequences,
      },
    };
    
    const response = await this.httpClient.post(
      `${this.baseUrl}/api/chat`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );
    
    const data = JSON.parse(response.body);
    
    return {
      content: data.message.content,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      finishReason: 'stop',
      metadata: {
        model: data.model,
        provider: 'ollama',
        latency: Date.now() - startTime,
      },
    };
  }
  
  protected async getModelList(): Promise<any> {
    const response = await this.httpClient.get(
      `${this.baseUrl}/api/tags`
    );
    
    const data = JSON.parse(response.body);
    return data.models || [];
  }
}

export interface OllamaConfig extends LLMAdapterConfig {
  apiKey?: string; // Optional for Ollama
  defaultModel?: string;
}
```

---

## 🌊 流式响应

### SSE 实现

```typescript
// packages/core/src/llm/streaming.ts

export class StreamManager {
  private adapters: Map<string, LLMAdapter> = new Map();
  private activeStreams: Map<string, AbortController> = new Map();
  
  /**
   * 创建流式响应
   */
  async createStream(
    streamId: string,
    adapter: LLMAdapter,
    messages: Message[],
    options?: ChatOptions
  ): Promise<AsyncIterator<StreamChunk>> {
    if (!adapter.chatStream) {
      throw new Error(`Adapter ${adapter.name} does not support streaming`);
    }
    
    // 创建中止控制器
    const controller = new AbortController();
    this.activeStreams.set(streamId, controller);
    
    // 返回异步迭代器
    return adapter.chatStream(messages, options);
  }
  
  /**
   * 取消流
   */
  cancelStream(streamId: string): void {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
    }
  }
  
  /**
   * 收集完整流
   */
  async collectStream(
    stream: AsyncIterator<StreamChunk>
  ): Promise<ChatResponse> {
    const chunks: StreamChunk[] = [];
    let content = '';
    const toolCalls: Map<string, ToolCall> = new Map();
    
    for await (const chunk of stream) {
      chunks.push(chunk);
      
      // 累积内容
      if (chunk.content) {
        content += chunk.content;
      }
      
      // 累积工具调用
      if (chunk.toolCalls) {
        for (const tc of chunk.toolCalls) {
          if (tc.id) {
            const existing = toolCalls.get(tc.id) || {
              id: tc.id,
              name: '',
              arguments: {},
            };
            
            if (tc.name) existing.name = tc.name;
            if (tc.arguments) {
              existing.arguments = {
                ...existing.arguments,
                ...tc.arguments,
              };
            }
            
            toolCalls.set(tc.id, existing);
          }
        }
      }
    }
    
    return {
      content,
      toolCalls: toolCalls.size > 0 
        ? Array.from(toolCalls.values())
        : undefined,
      finishReason: chunks[chunks.length - 1]?.finishReason || 'stop',
      metadata: {
        chunks: chunks.length,
      },
    };
  }
}
```

### WebSocket 支持

```typescript
// packages/core/src/llm/websocket.ts

export class WebSocketStreamHandler {
  private ws: WebSocket;
  private streams: Map<string, StreamCallbacks> = new Map();
  
  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    this.ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data);
        
        // 根据流 ID 分发消息
        const callbacks = this.streams.get(message.streamId);
        if (callbacks) {
          if (message.type === 'chunk') {
            callbacks.onChunk(message.chunk);
          } else if (message.type === 'complete') {
            callbacks.onComplete(message.response);
            this.streams.delete(message.streamId);
          } else if (message.type === 'error') {
            callbacks.onError(new Error(message.error));
            this.streams.delete(message.streamId);
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message', error);
      }
    });
  }
  
  subscribe(
    streamId: string,
    callbacks: StreamCallbacks
  ): void {
    this.streams.set(streamId, callbacks);
  }
  
  unsubscribe(streamId: string): void {
    this.streams.delete(streamId);
  }
  
  close(): void {
    this.ws.close();
  }
}

export interface StreamCallbacks {
  onChunk: (chunk: StreamChunk) => void;
  onComplete: (response: ChatResponse) => void;
  onError: (error: Error) => void;
}
```

---

## 💰 Token 管理

### Token 计数

```typescript
// packages/core/src/llm/token-counter.ts

export class TokenCounter {
  private encoders: Map<string, any> = new Map();
  
  /**
   * 计算 Token 数量
   */
  async count(
    text: string,
    model: string
  ): Promise<number> {
    const encoder = await this.getEncoder(model);
    return encoder.encode(text).length;
  }
  
  /**
   * 计算消息的 Token 数量
   */
  async countMessages(
    messages: Message[],
    model: string
  ): Promise<number> {
    let count = 0;
    
    for (const message of messages) {
      // 每条消息的格式开销
      count += 4; // <im_start>{role}\n{content}<im_end>\n
      
      count += await this.count(message.content, model);
      
      if (message.name) {
        count += await this.count(message.name, model);
      }
      
      if (message.toolCalls) {
        for (const tc of message.toolCalls) {
          count += await this.count(tc.name, model);
          count += await this.count(JSON.stringify(tc.arguments), model);
        }
      }
    }
    
    // 对话的额外开销
    count += 2;
    
    return count;
  }
  
  /**
   * 获取编码器
   */
  private async getEncoder(model: string): Promise<any> {
    if (this.encoders.has(model)) {
      return this.encoders.get(model);
    }
    
    // 根据模型选择编码器
    const encoding = this.getEncodingForModel(model);
    const encoder = await import('tiktoken').then(
      tiktoken => tiktoken.get_encoding(encoding)
    );
    
    this.encoders.set(model, encoder);
    return encoder;
  }
  
  private getEncodingForModel(model: string): string {
    if (model.startsWith('gpt-4')) {
      return 'cl100k_base';
    }
    if (model.startsWith('gpt-3.5')) {
      return 'cl100k_base';
    }
    if (model.startsWith('claude')) {
      return 'cl100k_base';
    }
    return 'cl100k_base';
  }
}
```

### 成本优化

```typescript
// packages/core/src/llm/cost-optimizer.ts

export class CostOptimizer {
  private tokenCounter: TokenCounter;
  private pricingTable: Map<string, Pricing> = new Map();
  
  constructor() {
    this.tokenCounter = new TokenCounter();
    this.loadPricingTable();
  }
  
  /**
   * 估算成本
   */
  async estimateCost(
    messages: Message[],
    model: string
  ): Promise<CostEstimate> {
    const pricing = this.pricingTable.get(model);
    if (!pricing) {
      throw new Error(`Unknown model: ${model}`);
    }
    
    const inputTokens = await this.tokenCounter.countMessages(messages, model);
    
    // 估算输出 Token（假设平均响应）
    const estimatedOutputTokens = Math.min(inputTokens, 1000);
    
    const inputCost = (inputTokens / 1000) * pricing.inputPer1k;
    const outputCost = (estimatedOutputTokens / 1000) * pricing.outputPer1k;
    
    return {
      inputTokens,
      estimatedOutputTokens,
      estimatedCost: inputCost + outputCost,
      breakdown: {
        input: inputCost,
        output: outputCost,
      },
    };
  }
  
  /**
   * 选择最经济的模型
   */
  selectCheapestModel(
    task: string,
    constraints?: ModelConstraints
  ): string {
    const models = this.getModelsForTask(task, constraints);
    
    return models.reduce((cheapest, model) => {
      const pricing = this.pricingTable.get(model);
      const cheapestPricing = this.pricingTable.get(cheapest);
      
      const totalCost = pricing.inputPer1k + pricing.outputPer1k;
      const cheapestCost = cheapestPricing.inputPer1k + cheapestPricing.outputPer1k;
      
      return totalCost < cheapestCost ? model : cheapest;
    });
  }
  
  /**
   * 优化提示词
   */
  async optimizePrompt(
    prompt: string,
    model: string,
    targetReduction: number = 0.3
  ): Promise<string> {
    const currentTokens = await this.tokenCounter.count(prompt, model);
    const targetTokens = Math.floor(currentTokens * (1 - targetReduction));
    
    // 简化策略
    let optimized = prompt;
    
    // 1. 移除多余空格
    optimized = optimized.replace(/\s+/g, ' ');
    
    // 2. 移除注释
    optimized = optimized.replace(/\/\/.*$/gm, '');
    optimized = optimized.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 3. 压缩重复内容
    optimized = this.compressRepetitions(optimized);
    
    const newTokens = await this.tokenCounter.count(optimized, model);
    
    if (newTokens <= targetTokens) {
      return optimized;
    }
    
    // 如果还不够，需要更激进的优化
    // 可以使用 LLM 来总结提示词
    return this.summarizePrompt(optimized, targetTokens);
  }
  
  private loadPricingTable(): void {
    // 加载定价数据
    this.pricingTable.set('gpt-4-turbo-preview', {
      inputPer1k: 0.01,
      outputPer1k: 0.03,
    });
    
    this.pricingTable.set('gpt-3.5-turbo', {
      inputPer1k: 0.0005,
      outputPer1k: 0.0015,
    });
    
    this.pricingTable.set('claude-3-opus-20240229', {
      inputPer1k: 0.015,
      outputPer1k: 0.075,
    });
    
    // ... 更多模型
  }
  
  private compressRepetitions(text: string): string {
    // 简单的重复压缩逻辑
    return text.replace(/(.{10,}?)\1+/g, '$1 [repeated]');
  }
  
  private async summarizePrompt(
    prompt: string,
    targetTokens: number
  ): Promise<string> {
    // 使用便宜的模型总结提示词
    // 实际实现会调用 LLM
    return prompt.slice(0, targetTokens * 4); // 粗略估计
  }
  
  private getModelsForTask(
    task: string,
    constraints?: ModelConstraints
  ): string[] {
    let models = Array.from(this.pricingTable.keys());
    
    if (constraints?.minContextWindow) {
      models = models.filter(m => 
        this.getContextWindow(m) >= constraints.minContextWindow!
      );
    }
    
    if (constraints?.supportsTools) {
      models = models.filter(m => 
        this.supportsTools(m)
      );
    }
    
    return models;
  }
  
  private getContextWindow(model: string): number {
    // 返回模型的上下文窗口大小
    const windows: Record<string, number> = {
      'gpt-4-turbo-preview': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385,
      'claude-3-opus-20240229': 200000,
    };
    
    return windows[model] || 4096;
  }
  
  private supportsTools(model: string): boolean {
    // 检查模型是否支持工具调用
    const toolModels = [
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
    ];
    
    return toolModels.includes(model);
  }
}

export interface Pricing {
  inputPer1k: number;
  outputPer1k: number;
}

export interface CostEstimate {
  inputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  breakdown: {
    input: number;
    output: number;
  };
}

export interface ModelConstraints {
  minContextWindow?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
}
```

### 速率限制

```typescript
// packages/core/src/llm/rate-limiter.ts

export class LLMRateLimiter {
  private limits: Map<string, RateLimit> = new Map();
  private usage: Map<string, UsageTracker> = new Map();
  
  constructor() {
    this.loadLimits();
  }
  
  /**
   * 检查是否可以发送请求
   */
  async checkLimit(
    provider: string,
    model: string,
    estimatedTokens: number
  ): Promise<LimitCheck> {
    const key = `${provider}:${model}`;
    const limit = this.limits.get(key);
    
    if (!limit) {
      return { allowed: true };
    }
    
    const tracker = this.getTracker(key);
    
    // 检查 RPM（每分钟请求数）
    if (limit.requestsPerMinute) {
      const rpm = tracker.getRequestCount('minute');
      if (rpm >= limit.requestsPerMinute) {
        return {
          allowed: false,
          reason: 'RPM limit exceeded',
          retryAfter: tracker.getResetTime('minute'),
        };
      }
    }
    
    // 检查 TPM（每分钟 Token 数）
    if (limit.tokensPerMinute) {
      const tpm = tracker.getTokenCount('minute');
      if (tpm + estimatedTokens > limit.tokensPerMinute) {
        return {
          allowed: false,
          reason: 'TPM limit exceeded',
          retryAfter: tracker.getResetTime('minute'),
        };
      }
    }
    
    return { allowed: true };
  }
  
  /**
   * 记录使用
   */
  async recordUsage(
    provider: string,
    model: string,
    tokens: number
  ): Promise<void> {
    const key = `${provider}:${model}`;
    const tracker = this.getTracker(key);
    
    tracker.recordRequest();
    tracker.recordTokens(tokens);
  }
  
  private loadLimits(): void {
    // 加载速率限制配置
    this.limits.set('openai:gpt-4', {
      requestsPerMinute: 500,
      tokensPerMinute: 10000,
    });
    
    this.limits.set('openai:gpt-3.5-turbo', {
      requestsPerMinute: 3500,
      tokensPerMinute: 90000,
    });
    
    this.limits.set('claude:claude-3-opus', {
      requestsPerMinute: 60,
      tokensPerMinute: 40000,
    });
  }
  
  private getTracker(key: string): UsageTracker {
    if (!this.usage.has(key)) {
      this.usage.set(key, new UsageTracker());
    }
    return this.usage.get(key)!;
  }
}

export interface RateLimit {
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
}

export interface LimitCheck {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}

class UsageTracker {
  private requests: Array<{ time: number; tokens: number }> = [];
  
  recordRequest(): void {
    this.requests.push({
      time: Date.now(),
      tokens: 0,
    });
    this.cleanOldEntries();
  }
  
  recordTokens(tokens: number): void {
    const last = this.requests[this.requests.length - 1];
    if (last) {
      last.tokens = tokens;
    }
  }
  
  getRequestCount(period: 'minute' | 'day'): number {
    const cutoff = this.getCutoff(period);
    return this.requests.filter(r => r.time > cutoff).length;
  }
  
  getTokenCount(period: 'minute' | 'day'): number {
    const cutoff = this.getCutoff(period);
    return this.requests
      .filter(r => r.time > cutoff)
      .reduce((sum, r) => sum + r.tokens, 0);
  }
  
  getResetTime(period: 'minute' | 'day'): number {
    const cutoff = this.getCutoff(period);
    const oldest = this.requests.find(r => r.time > cutoff);
    return oldest ? cutoff + 60000 : Date.now();
  }
  
  private getCutoff(period: 'minute' | 'day'): number {
    const now = Date.now();
    if (period === 'minute') {
      return now - 60000;
    }
    return now - 86400000;
  }
  
  private cleanOldEntries(): void {
    const cutoff = Date.now() - 86400000; // 保留 24 小时
    this.requests = this.requests.filter(r => r.time > cutoff);
  }
}
```

---

## ⚠️ 错误处理

### 错误类型

```typescript
// packages/core/src/llm/errors.ts

export class LLMError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(
    provider: string,
    public retryAfter: number
  ) {
    super(
      `Rate limit exceeded for ${provider}`,
      provider,
      'RATE_LIMIT',
      { retryAfter }
    );
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(provider: string, public timeout: number) {
    super(
      `Request timeout for ${provider} after ${timeout}ms`,
      provider,
      'TIMEOUT',
      { timeout }
    );
  }
}

export class LLMAuthenticationError extends LLMError {
  constructor(provider: string) {
    super(
      `Authentication failed for ${provider}`,
      provider,
      'AUTHENTICATION_ERROR'
    );
  }
}

export class LLMModelNotFoundError extends LLMError {
  constructor(provider: string, public model: string) {
    super(
      `Model ${model} not found for ${provider}`,
      provider,
      'MODEL_NOT_FOUND',
      { model }
    );
  }
}

export class LLMContextLengthExceededError extends LLMError {
  constructor(
    provider: string,
    public tokens: number,
    public limit: number
  ) {
    super(
      `Context length exceeded: ${tokens} > ${limit}`,
      provider,
      'CONTEXT_LENGTH_EXCEEDED',
      { tokens, limit }
    );
  }
}
```

### 重试机制

```typescript
// packages/core/src/llm/retry.ts

export class RetryStrategy {
  private config: RetryConfig;
  
  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        'RATE_LIMIT',
        'TIMEOUT',
        'SERVICE_UNAVAILABLE',
      ],
      ...config,
    };
  }
  
  async execute<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // 检查是否应该重试
        if (!this.shouldRetry(error)) {
          throw error;
        }
        
        // 计算延迟
        const delay = this.calculateDelay(attempt);
        
        console.warn(
          `${context} failed (attempt ${attempt}/${this.config.maxRetries}), ` +
          `retrying in ${delay}ms: ${error.message}`
        );
        
        await sleep(delay);
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
  
  private shouldRetry(error: any): boolean {
    if (error instanceof LLMError) {
      return this.config.retryableErrors.includes(error.code);
    }
    
    // 网络错误
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // HTTP 5xx 错误
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    return false;
  }
  
  private calculateDelay(attempt: number): number {
    const delay = this.config.initialDelay * 
      Math.pow(this.config.backoffMultiplier, attempt - 1);
    
    // 添加随机抖动（避免雷群效应）
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.min(delay + jitter, this.config.maxDelay);
  }
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 🔄 多模型编排

### 模型路由

```typescript
// packages/core/src/llm/model-router.ts

export class ModelRouter {
  private adapters: Map<string, LLMAdapter> = new Map();
  private rules: RoutingRule[] = [];
  
  /**
   * 注册适配器
   */
  registerAdapter(adapter: LLMAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }
  
  /**
   * 添加路由规则
   */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    // 按优先级排序
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  
  /**
   * 选择最佳模型
   */
  selectModel(context: RequestContext): SelectedModel {
    // 应用路由规则
    for (const rule of this.rules) {
      if (this.matchesRule(context, rule)) {
        const adapter = this.adapters.get(rule.provider);
        if (!adapter) {
          continue;
        }
        
        return {
          provider: rule.provider,
          model: rule.model,
          adapter,
          reason: rule.name,
        };
      }
    }
    
    // 默认模型
    return this.getDefaultModel();
  }
  
  private matchesRule(context: RequestContext, rule: RoutingRule): boolean {
    // 检查任务类型
    if (rule.taskTypes && !rule.taskTypes.includes(context.taskType)) {
      return false;
    }
    
    // 检查用户等级
    if (rule.userTiers && !rule.userTiers.includes(context.userTier)) {
      return false;
    }
    
    // 检查复杂度
    if (rule.minComplexity && context.complexity < rule.minComplexity) {
      return false;
    }
    
    // 检查是否需要工具
    if (rule.requiresTools !== undefined && 
        rule.requiresTools !== context.requiresTools) {
      return false;
    }
    
    return true;
  }
  
  private getDefaultModel(): SelectedModel {
    const adapter = this.adapters.get('openai');
    return {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      adapter: adapter!,
      reason: 'default',
    };
  }
}

export interface RoutingRule {
  name: string;
  provider: string;
  model: string;
  priority?: number;
  taskTypes?: string[];
  userTiers?: string[];
  minComplexity?: number;
  requiresTools?: boolean;
}

export interface RequestContext {
  taskType: string;
  userTier: string;
  complexity: number;
  requiresTools: boolean;
  estimatedTokens: number;
}

export interface SelectedModel {
  provider: string;
  model: string;
  adapter: LLMAdapter;
  reason: string;
}
```

### 使用示例

```typescript
// 配置模型路由器
const router = new ModelRouter();

// 注册适配器
router.registerAdapter(new OpenAIAdapter(openaiConfig));
router.registerAdapter(new ClaudeAdapter(claudeConfig));
router.registerAdapter(new OllamaAdapter(ollamaConfig));

// 添加路由规则
router.addRule({
  name: 'Complex Tasks → GPT-4',
  provider: 'openai',
  model: 'gpt-4-turbo-preview',
  priority: 10,
  minComplexity: 8,
});

router.addRule({
  name: 'Code Generation → Claude',
  provider: 'claude',
  model: 'claude-3-opus-20240229',
  priority: 9,
  taskTypes: ['code_generation', 'code_review'],
});

router.addRule({
  name: 'Simple Tasks → GPT-3.5',
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  priority: 5,
  minComplexity: 0,
  maxComplexity: 5,
});

router.addRule({
  name: 'Local Tasks → Ollama',
  provider: 'ollama',
  model: 'llama2',
  priority: 3,
  taskTypes: ['local_processing'],
});

// 使用路由器
const context: RequestContext = {
  taskType: 'code_generation',
  userTier: 'premium',
  complexity: 9,
  requiresTools: true,
  estimatedTokens: 5000,
};

const selected = router.selectModel(context);
console.log(`Using ${selected.provider}/${selected.model} because: ${selected.reason}`);
```

---

## 📚 相关文档

- **[核心引擎](./core-engine.md)** - Agent 和工具执行
- **[架构概览](./overview.md)** - 系统整体架构
- **[Agent 设计最佳实践](../best-practices/agent-design.md)** - Agent 设计指南
- **[配置指南](../getting-started/configuration.md)** - 配置说明

---

**LLM 集成文档完成！连接强大的 AI 能力！** 🤖
