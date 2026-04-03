# Agent 设计最佳实践

本文档提供 OpenAgent Framework Agent 设计的最佳实践，包括提示词工程、上下文管理、多轮对话和错误处理策略。

---

## 📋 目录

1. [提示词工程](#提示词工程)
2. [上下文管理](#上下文管理)
3. [多轮对话](#多轮对话)
4. [错误处理](#错误处理)
5. [工具集成](#工具集成)
6. [测试和调试](#测试和调试)

---

## 💡 提示词工程

### 系统提示词

**✅ 优秀的系统提示词**：

```typescript
const systemPrompt = `You are a helpful AI assistant specialized in customer support for an e-commerce platform.

## Your Role
- Help customers with product inquiries
- Assist with order tracking and issues
- Process returns and refunds
- Provide product recommendations

## Capabilities
- Search products in the catalog
- Check order status
- Process refunds (with approval)
- Send follow-up emails

## Guidelines
1. Be friendly and professional
2. Provide accurate information
3. Escalate complex issues to human agents
4. Never share sensitive customer data
5. Always confirm actions before executing

## Response Format
- Start with a brief acknowledgment
- Provide clear, actionable information
- End with a helpful next step

## Limitations
- Cannot access payment information
- Cannot modify orders after shipping
- Cannot apply additional discounts

When uncertain, say "Let me check that for you" rather than guessing.`;
```

**❌ 差的系统提示词**：

```typescript
// ❌ 太简单
const badPrompt1 = 'You are a helpful assistant.';

// ❌ 太模糊
const badPrompt2 = 'Help customers with their questions.';

// ❌ 太复杂
const badPrompt3 = `
You are an assistant. You can do many things. 
Users might ask you anything. Try to help them.
Sometimes you should search. Sometimes you should answer directly.
Use your best judgment. Be helpful but not too verbose.
Actually, being verbose is fine if needed. Just be appropriate.
Also remember to be friendly. And professional. But casual too.
...（更多矛盾和重复的指令）
`;
```

### 系统提示词模板

```typescript
// 提示词模板生成器
class PromptTemplate {
  static createSystemPrompt(config: AgentConfig): string {
    return `
# ${config.name}

${config.description}

## Your Role
${config.role}

## Capabilities
${config.capabilities.map(c => `- ${c}`).join('\n')}

## Guidelines
${config.guidelines.map((g, i) => `${i + 1}. ${g}`).join('\n')}

## Response Format
${config.responseFormat}

## Limitations
${config.limitations.map(l => `- ${l}`).join('\n')}

${config.additionalInstructions || ''}
`.trim();
  }
}

// 使用模板
const agent = new ReActAgent({
  id: 'support-agent',
  name: 'Customer Support Agent',
  systemPrompt: PromptTemplate.createSystemPrompt({
    name: 'Customer Support Agent',
    description: 'AI assistant for customer support',
    role: 'Help customers with inquiries, orders, and returns',
    capabilities: [
      'Search products',
      'Check order status',
      'Process returns',
      'Send emails',
    ],
    guidelines: [
      'Be friendly and professional',
      'Provide accurate information',
      'Escalate complex issues',
    ],
    responseFormat: 'Brief acknowledgment → Clear answer → Next step',
    limitations: [
      'Cannot access payment info',
      'Cannot modify shipped orders',
    ],
  }),
});
```

### 用户提示词优化

```typescript
// 优化用户输入
class PromptOptimizer {
  /**
   * 清理和优化用户输入
   */
  static optimizeUserInput(input: string): string {
    // 1. 移除多余空格
    let optimized = input.trim().replace(/\s+/g, ' ');
    
    // 2. 修正常见拼写错误
    optimized = this.correctSpelling(optimized);
    
    // 3. 添加上下文（如果需要）
    if (this.needsContext(optimized)) {
      optimized = this.addContext(optimized);
    }
    
    return optimized;
  }
  
  /**
   * 添加上下文提示
   */
  static addContextualHints(input: string, context: AgentContext): string {
    const hints: string[] = [];
    
    // 添加时间上下文
    if (this.containsTimeReference(input)) {
      hints.push(`Current date: ${new Date().toISOString().split('T')[0]}`);
    }
    
    // 添加用户上下文
    if (context.userId) {
      hints.push(`User ID: ${context.userId}`);
    }
    
    // 添加位置上下文
    if (context.location) {
      hints.push(`User location: ${context.location}`);
    }
    
    if (hints.length > 0) {
      return `[${hints.join(', ')}] ${input}`;
    }
    
    return input;
  }
  
  private static needsContext(input: string): boolean {
    // 检查是否需要额外上下文
    const contextIndicators = ['today', 'now', 'current', 'my'];
    return contextIndicators.some(indicator => 
      input.toLowerCase().includes(indicator)
    );
  }
  
  private static correctSpelling(text: string): string {
    // 简单的拼写纠正
    const corrections: Record<string, string> = {
      'teh': 'the',
      'adn': 'and',
      'recieve': 'receive',
      'occured': 'occurred',
    };
    
    for (const [wrong, correct] of Object.entries(corrections)) {
      text = text.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), correct);
    }
    
    return text;
  }
  
  private static addContext(input: string): string {
    // 添加隐含的上下文
    const date = new Date().toLocaleDateString();
    return `${input} (Context: Today is ${date})`;
  }
  
  private static containsTimeReference(input: string): boolean {
    const timeWords = ['today', 'yesterday', 'tomorrow', 'now', 'this week'];
    return timeWords.some(word => input.toLowerCase().includes(word));
  }
}
```

### Few-Shot 示例

```typescript
// 使用 Few-Shot 提示
const fewShotPrompt = `
Here are some examples of how to handle customer inquiries:

Example 1:
User: "Where is my order?"
Assistant: I'll help you track your order. Let me look that up.
[Uses check_order_status tool]
Assistant: Your order #12345 was shipped yesterday and is currently in transit. Expected delivery is in 2-3 business days. Would you like me to send you tracking updates via email?

Example 2:
User: "I want to return this product"
Assistant: I understand you'd like to return a product. I can help with that.
[Uses get_order_details tool]
Assistant: I found your recent order #12346 with 2 items. Which item would you like to return? Once confirmed, I'll process the return and send you a prepaid shipping label.

Example 3:
User: "What's your return policy?"
Assistant: Our return policy allows returns within 30 days of purchase for most items. Items must be unused and in original packaging. Some exclusions apply to clearance items. Would you like me to check if your item is eligible for return?

Now, please handle the following user inquiry following the same pattern:
`;
```

---

## 📚 上下文管理

### 上下文大小控制

```typescript
// 上下文管理器
class ContextManager {
  private maxTokens: number;
  private tokenCounter: TokenCounter;
  
  constructor(maxTokens: number = 4000) {
    this.maxTokens = maxTokens;
    this.tokenCounter = new TokenCounter();
  }
  
  /**
   * 管理对话历史大小
   */
  async manageContext(
    messages: Message[],
    options?: ContextOptions
  ): Promise<Message[]> {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    // 计算系统提示词的 Token
    const systemTokens = systemMessage 
      ? await this.tokenCounter.count(systemMessage.content)
      : 0;
    
    const availableTokens = this.maxTokens - systemTokens - 500; // 保留 500 给响应
    
    // 如果总 Token 超过限制，压缩历史
    if (await this.getTotalTokens(conversationMessages) > availableTokens) {
      return this.compressMessages(
        systemMessage,
        conversationMessages,
        availableTokens
      );
    }
    
    return messages;
  }
  
  /**
   * 压缩消息历史
   */
  private async compressMessages(
    systemMessage: Message | undefined,
    messages: Message[],
    maxTokens: number
  ): Promise<Message[]> {
    const compressed: Message[] = [];
    let currentTokens = 0;
    
    // 策略 1: 保留最近的消息
    const reversed = [...messages].reverse();
    
    for (const message of reversed) {
      const tokens = await this.tokenCounter.count(message.content);
      
      if (currentTokens + tokens <= maxTokens) {
        compressed.unshift(message);
        currentTokens += tokens;
      } else {
        break;
      }
    }
    
    // 策略 2: 如果还是太长，总结旧消息
    if (compressed.length < messages.length && compressed.length > 2) {
      const summary = await this.summarizeOldMessages(
        messages.slice(0, messages.length - compressed.length)
      );
      
      compressed.unshift({
        role: 'system',
        content: `[Previous conversation summary: ${summary}]`,
      });
    }
    
    return systemMessage 
      ? [systemMessage, ...compressed]
      : compressed;
  }
  
  /**
   * 总结旧消息
   */
  private async summarizeOldMessages(messages: Message[]): Promise<string> {
    // 使用 LLM 总结
    const summaryPrompt = `Summarize the following conversation in 2-3 sentences:

${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Summary:`;
    
    // 调用 LLM 生成总结
    const summary = await this.callLLM(summaryPrompt);
    return summary;
  }
  
  /**
   * 计算总 Token 数
   */
  private async getTotalTokens(messages: Message[]): Promise<number> {
    let total = 0;
    for (const message of messages) {
      total += await this.tokenCounter.count(message.content);
    }
    return total;
  }
  
  private async callLLM(prompt: string): Promise<string> {
    // 调用 LLM API
    return 'Summary of conversation...';
  }
}

interface ContextOptions {
  preserveRecent?: number;  // 保留最近的 N 条消息
  summarizeOld?: boolean;   // 是否总结旧消息
}
```

### 长期记忆

```typescript
// 长期记忆系统
class LongTermMemory {
  private vectorStore: VectorStore;
  private logger: Logger;
  
  constructor() {
    this.vectorStore = new VectorStore();
    this.logger = createLogger('long-term-memory');
  }
  
  /**
   * 存储重要信息
   */
  async store(userId: string, information: string): Promise<void> {
    // 提取关键信息
    const keyPoints = await this.extractKeyPoints(information);
    
    // 生成向量
    const embedding = await this.vectorStore.embed(keyPoints);
    
    // 存储到向量数据库
    await this.vectorStore.upsert({
      id: generateId(),
      userId,
      content: keyPoints,
      embedding,
      timestamp: new Date(),
    });
    
    this.logger.info('Stored information', { userId, keyPoints });
  }
  
  /**
   * 检索相关记忆
   */
  async retrieve(userId: string, query: string, limit: number = 5): Promise<Memory[]> {
    // 生成查询向量
    const queryEmbedding = await this.vectorStore.embed(query);
    
    // 搜索相似记忆
    const memories = await this.vectorStore.search({
      userId,
      embedding: queryEmbedding,
      limit,
    });
    
    return memories;
  }
  
  /**
   * 提取关键点
   */
  private async extractKeyPoints(text: string): Promise<string> {
    const extractPrompt = `Extract the key information from the following text in a concise summary:

Text: "${text}"

Key information:`;
    
    return await this.callLLM(extractPrompt);
  }
  
  private async callLLM(prompt: string): Promise<string> {
    // 调用 LLM
    return 'Key information extracted...';
  }
}

interface Memory {
  id: string;
  userId: string;
  content: string;
  embedding: number[];
  timestamp: Date;
  relevance?: number;
}

// 使用长期记忆
const memory = new LongTermMemory();

// 存储
await memory.store(userId, 'User prefers email communication over phone calls');

// 检索
const relevantMemories = await memory.retrieve(userId, 'How should I contact the user?');
```

### 上下文压缩

```typescript
// 智能上下文压缩
class ContextCompressor {
  /**
   * 压缩上下文
   */
  async compress(messages: Message[]): Promise<Message[]> {
    // 1. 移除重复信息
    let compressed = this.removeDuplicates(messages);
    
    // 2. 压缩冗长消息
    compressed = await this.compressVerboseMessages(compressed);
    
    // 3. 合并连续的短消息
    compressed = this.mergeShortMessages(compressed);
    
    return compressed;
  }
  
  /**
   * 移除重复内容
   */
  private removeDuplicates(messages: Message[]): Message[] {
    const seen = new Set<string>();
    const unique: Message[] = [];
    
    for (const message of messages) {
      // 标准化内容
      const normalized = this.normalizeContent(message.content);
      
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(message);
      }
    }
    
    return unique;
  }
  
  /**
   * 压缩冗长消息
   */
  private async compressVerboseMessages(messages: Message[]): Promise<Message[]> {
    const maxMessageLength = 500;
    
    return Promise.all(
      messages.map(async (message) => {
        if (message.content.length > maxMessageLength) {
          const compressed = await this.summarizeMessage(message.content);
          return {
            ...message,
            content: compressed,
          };
        }
        return message;
      })
    );
  }
  
  /**
   * 合并短消息
   */
  private mergeShortMessages(messages: Message[]): Message[] {
    const merged: Message[] = [];
    let current: Message | null = null;
    
    for (const message of messages) {
      if (!current) {
        current = { ...message };
        continue;
      }
      
      // 如果是同一角色的短消息，合并
      if (
        message.role === current.role &&
        message.content.length < 100 &&
        current.content.length < 100
      ) {
        current.content += ' ' + message.content;
      } else {
        merged.push(current);
        current = { ...message };
      }
    }
    
    if (current) {
      merged.push(current);
    }
    
    return merged;
  }
  
  private normalizeContent(content: string): string {
    return content.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  private async summarizeMessage(content: string): Promise<string> {
    // 使用 LLM 总结
    return content.slice(0, 200) + '...';
  }
}
```

---

## 💬 多轮对话

### 会话状态管理

```typescript
// 会话状态
interface ConversationState {
  // 基本信息
  sessionId: string;
  userId: string;
  
  // 对话状态
  turnCount: number;
  lastIntent?: string;
  entities: Record<string, any>;
  
  // 上下文
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  
  // 用户偏好
  preferences: Record<string, any>;
  
  // 工具调用历史
  toolHistory: ToolCallRecord[];
}

interface ToolCallRecord {
  toolName: string;
  params: any;
  result: ToolResult;
  timestamp: Date;
}

// 会话状态管理器
class ConversationStateManager {
  private states: Map<string, ConversationState> = new Map();
  
  /**
   * 获取或创建状态
   */
  getOrCreate(sessionId: string, userId: string): ConversationState {
    if (!this.states.has(sessionId)) {
      this.states.set(sessionId, {
        sessionId,
        userId,
        turnCount: 0,
        entities: {},
        topics: [],
        sentiment: 'neutral',
        preferences: {},
        toolHistory: [],
      });
    }
    
    return this.states.get(sessionId)!;
  }
  
  /**
   * 更新状态
   */
  update(sessionId: string, updates: Partial<ConversationState>): void {
    const state = this.states.get(sessionId);
    if (state) {
      Object.assign(state, updates);
    }
  }
  
  /**
   * 记录工具调用
   */
  recordToolCall(
    sessionId: string,
    toolName: string,
    params: any,
    result: ToolResult
  ): void {
    const state = this.states.get(sessionId);
    if (state) {
      state.toolHistory.push({
        toolName,
        params,
        result,
        timestamp: new Date(),
      });
    }
  }
}
```

### 消息历史管理

```typescript
// 消息历史管理
class MessageHistory {
  private messages: Message[] = [];
  private maxMessages: number;
  
  constructor(maxMessages: number = 50) {
    this.maxMessages = maxMessages;
  }
  
  /**
   * 添加消息
   */
  add(message: Message): void {
    this.messages.push({
      ...message,
      timestamp: new Date(),
    });
    
    // 限制历史长度
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }
  
  /**
   * 获取所有消息
   */
  getAll(): Message[] {
    return [...this.messages];
  }
  
  /**
   * 获取最近的 N 条消息
   */
  getRecent(n: number): Message[] {
    return this.messages.slice(-n);
  }
  
  /**
   * 按时间范围获取
   */
  getByTimeRange(start: Date, end: Date): Message[] {
    return this.messages.filter(
      m => m.timestamp >= start && m.timestamp <= end
    );
  }
  
  /**
   * 搜索消息
   */
  search(query: string): Message[] {
    const lowerQuery = query.toLowerCase();
    return this.messages.filter(m =>
      m.content.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * 清空历史
   */
  clear(): void {
    this.messages = [];
  }
}

// 扩展 Message 接口
declare module '@openagent/core' {
  interface Message {
    timestamp?: Date;
  }
}
```

### 对话策略

```typescript
// 对话策略
class ConversationStrategy {
  /**
   * 决定下一步行动
   */
  async decide(
    userMessage: string,
    state: ConversationState,
    context: Message[]
  ): Promise<ConversationAction> {
    // 分析用户意图
    const intent = await this.analyzeIntent(userMessage);
    
    // 更新状态
    state.lastIntent = intent.name;
    state.turnCount++;
    
    // 根据意图决定行动
    switch (intent.name) {
      case 'question':
        return this.handleQuestion(intent, state, context);
      
      case 'request':
        return this.handleRequest(intent, state, context);
      
      case 'feedback':
        return this.handleFeedback(intent, state, context);
      
      case 'greeting':
        return this.handleGreeting(intent, state, context);
      
      default:
        return this.handleDefault(intent, state, context);
    }
  }
  
  /**
   * 处理问题
   */
  private async handleQuestion(
    intent: Intent,
    state: ConversationState,
    context: Message[]
  ): Promise<ConversationAction> {
    return {
      type: 'respond',
      responseType: 'answer',
      shouldUseTools: true,
      tools: this.selectToolsForQuestion(intent),
    };
  }
  
  /**
   * 处理请求
   */
  private async handleRequest(
    intent: Intent,
    state: ConversationState,
    context: Message[]
  ): Promise<ConversationAction> {
    // 检查是否有足够信息
    if (!this.hasEnoughInfo(intent, state)) {
      return {
        type: 'clarify',
        missingInfo: this.getMissingInfo(intent, state),
        question: this.generateClarificationQuestion(intent, state),
      };
    }
    
    return {
      type: 'execute',
      action: intent.action,
      parameters: this.buildParameters(intent, state),
    };
  }
  
  /**
   * 处理反馈
   */
  private async handleFeedback(
    intent: Intent,
    state: ConversationState,
    context: Message[]
  ): Promise<ConversationAction> {
    // 更新情感状态
    state.sentiment = intent.sentiment || 'neutral';
    
    if (intent.sentiment === 'negative') {
      return {
        type: 'apologize',
        responseType: 'empathy',
        shouldEscalate: this.shouldEscalate(intent, state),
      };
    }
    
    return {
      type: 'acknowledge',
      responseType: 'gratitude',
    };
  }
  
  /**
   * 选择工具
   */
  private selectToolsForQuestion(intent: Intent): string[] {
    const toolMap: Record<string, string[]> = {
      'product_inquiry': ['search_products', 'get_product_details'],
      'order_status': ['check_order_status', 'get_order_details'],
      'return_policy': ['get_return_policy'],
    };
    
    return toolMap[intent.category] || [];
  }
  
  /**
   * 检查是否有足够信息
   */
  private hasEnoughInfo(intent: Intent, state: ConversationState): boolean {
    const requiredEntities = this.getRequiredEntities(intent.action);
    return requiredEntities.every(
      entity => state.entities[entity] !== undefined
    );
  }
  
  /**
   * 获取缺失信息
   */
  private getMissingInfo(intent: Intent, state: ConversationState): string[] {
    const requiredEntities = this.getRequiredEntities(intent.action);
    return requiredEntities.filter(
      entity => state.entities[entity] === undefined
    );
  }
  
  /**
   * 生成澄清问题
   */
  private generateClarificationQuestion(
    intent: Intent,
    state: ConversationState
  ): string {
    const missing = this.getMissingInfo(intent, state);
    
    if (missing.includes('orderId')) {
      return 'Could you please provide your order ID?';
    }
    
    if (missing.includes('productId')) {
      return 'Which product are you referring to?';
    }
    
    return 'Could you please provide more details?';
  }
  
  // 辅助方法（实现省略）
  private async analyzeIntent(message: string): Promise<Intent> {
    // 使用 LLM 分析意图
    return { name: 'question', category: 'general', sentiment: 'neutral' };
  }
  
  private handleGreeting(
    intent: Intent,
    state: ConversationState,
    context: Message[]
  ): ConversationAction {
    return { type: 'respond', responseType: 'greeting' };
  }
  
  private handleDefault(
    intent: Intent,
    state: ConversationState,
    context: Message[]
  ): ConversationAction {
    return { type: 'respond', responseType: 'general' };
  }
  
  private getRequiredEntities(action: string): string[] {
    return [];
  }
  
  private buildParameters(intent: Intent, state: ConversationState): any {
    return {};
  }
  
  private shouldEscalate(intent: Intent, state: ConversationState): boolean {
    return state.sentiment === 'negative' && state.turnCount > 5;
  }
}

interface ConversationAction {
  type: 'respond' | 'clarify' | 'execute' | 'apologize' | 'acknowledge';
  responseType?: string;
  shouldUseTools?: boolean;
  tools?: string[];
  missingInfo?: string[];
  question?: string;
  action?: string;
  parameters?: any;
  shouldEscalate?: boolean;
}

interface Intent {
  name: string;
  category?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  action?: string;
}
```

---

## ⚠️ 错误处理

### 用户友好的错误

```typescript
// 错误处理策略
class ErrorHandler {
  private errorMessages: Map<string, string> = new Map([
    ['RATE_LIMIT', 'I\'m processing many requests right now. Please try again in a moment.'],
    ['TIMEOUT', 'This is taking longer than expected. Let me try again.'],
    ['SERVICE_UNAVAILABLE', 'A service I need is temporarily unavailable. Please try again shortly.'],
    ['INVALID_INPUT', 'I didn\'t quite understand that. Could you rephrase?'],
    ['PERMISSION_DENIED', 'I don\'t have permission to do that. Would you like me to find an alternative?'],
  ]);
  
  /**
   * 处理错误
   */
  handleError(error: Error): UserFriendlyError {
    const code = this.getErrorCode(error);
    const message = this.errorMessages.get(code) || 
      'Something went wrong. Let me try a different approach.';
    
    return {
      message,
      code,
      shouldRetry: this.shouldRetry(code),
      alternative: this.suggestAlternative(code),
    };
  }
  
  /**
   * 是否应该重试
   */
  private shouldRetry(code: string): boolean {
    const retryableCodes = ['RATE_LIMIT', 'TIMEOUT', 'SERVICE_UNAVAILABLE'];
    return retryableCodes.includes(code);
  }
  
  /**
   * 建议替代方案
   */
  private suggestAlternative(code: string): string | undefined {
    const alternatives: Record<string, string> = {
      'PERMISSION_DENIED': 'Would you like me to escalate this to a human agent?',
      'SERVICE_UNAVAILABLE': 'I can try a different method or come back to this later.',
    };
    
    return alternatives[code];
  }
  
  private getErrorCode(error: Error): string {
    if (error instanceof LLMRateLimitError) return 'RATE_LIMIT';
    if (error instanceof LLMTimeoutError) return 'TIMEOUT';
    if (error instanceof ToolError) return error.code;
    return 'UNKNOWN_ERROR';
  }
}

interface UserFriendlyError {
  message: string;
  code: string;
  shouldRetry: boolean;
  alternative?: string;
}
```

### 自动重试

```typescript
// 自动重试策略
class AutoRetry {
  /**
   * 执行带重试的操作
   */
  async execute<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const maxRetries = options?.maxRetries || 3;
    const delay = options?.delay || 1000;
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        if (!this.shouldRetry(error, attempt, maxRetries)) {
          throw error;
        }
        
        // 延迟重试
        await this.sleep(delay * attempt);
      }
    }
    
    throw lastError;
  }
  
  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any, attempt: number, maxRetries: number): boolean {
    // 超过最大重试次数
    if (attempt >= maxRetries) {
      return false;
    }
    
    // 不可重试的错误
    const nonRetryableErrors = [
      'VALIDATION_ERROR',
      'PERMISSION_DENIED',
      'NOT_FOUND',
    ];
    
    if (nonRetryableErrors.some(code => error.message?.includes(code))) {
      return false;
    }
    
    return true;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface RetryOptions {
  maxRetries?: number;
  delay?: number;
}
```

### 降级策略

```typescript
// 降级策略
class FallbackStrategy {
  private strategies: Map<string, FallbackHandler> = new Map();
  
  /**
   * 注册降级策略
   */
  register(errorCode: string, handler: FallbackHandler): void {
    this.strategies.set(errorCode, handler);
  }
  
  /**
   * 执行降级
   */
  async fallback(
    errorCode: string,
    context: FallbackContext
  ): Promise<FallbackResult> {
    const handler = this.strategies.get(errorCode);
    
    if (handler) {
      return handler(context);
    }
    
    // 默认降级策略
    return this.defaultFallback(context);
  }
  
  /**
   * 默认降级
   */
  private async defaultFallback(context: FallbackContext): Promise<FallbackResult> {
    return {
      message: 'I encountered an issue. Let me try a different approach.',
      action: 'retry_with_different_tool',
    };
  }
}

// 示例：为外部 API 降级
fallbackStrategy.register('EXTERNAL_SERVICE_ERROR', async (context) => {
  // 尝试使用缓存
  const cached = await cache.get(context.cacheKey);
  
  if (cached) {
    return {
      message: 'I found some information that might help (from cache).',
      data: cached,
      action: 'use_cache',
    };
  }
  
  // 降级到更简单的工具
  return {
    message: 'The detailed lookup is unavailable. Let me try a simpler search.',
    action: 'use_fallback_tool',
    fallbackTool: 'simple_search',
  };
});

type FallbackHandler = (context: FallbackContext) => Promise<FallbackResult>;

interface FallbackContext {
  originalError: Error;
  userMessage: string;
  cacheKey?: string;
  sessionId: string;
}

interface FallbackResult {
  message: string;
  action: string;
  data?: any;
  fallbackTool?: string;
}
```

---

## 🔧 工具集成

### 智能工具选择

```typescript
// 工具选择策略
class ToolSelector {
  /**
   * 选择最适合的工具
   */
  selectTools(
    userMessage: string,
    availableTools: Tool[],
    context: ConversationState
  ): SelectedTools {
    // 1. 基于关键词匹配
    const keywordMatches = this.matchByKeywords(userMessage, availableTools);
    
    // 2. 基于上下文
    const contextMatches = this.matchByContext(availableTools, context);
    
    // 3. 合并结果
    const selected = this.mergeMatches(keywordMatches, contextMatches);
    
    return {
      tools: selected.map(t => t.name),
      confidence: selected[0]?.confidence || 0,
    };
  }
  
  private matchByKeywords(message: string, tools: Tool[]): ToolMatch[] {
    const lowerMessage = message.toLowerCase();
    
    return tools
      .map(tool => {
        const keywords = this.extractKeywords(tool);
        const matchCount = keywords.filter(k => lowerMessage.includes(k)).length;
        
        return {
          tool,
          confidence: matchCount / keywords.length,
        };
      })
      .filter(match => match.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence);
  }
  
  private matchByContext(tools: Tool[], context: ConversationState): ToolMatch[] {
    // 根据会话状态选择工具
    return tools
      .map(tool => {
        let confidence = 0;
        
        // 如果最近使用过，增加置信度
        if (context.toolHistory.some(h => h.toolName === tool.name)) {
          confidence += 0.3;
        }
        
        // 根据意图匹配
        if (this.matchesIntent(tool, context.lastIntent)) {
          confidence += 0.5;
        }
        
        return { tool, confidence };
      })
      .filter(match => match.confidence > 0);
  }
  
  private mergeMatches(
    keywordMatches: ToolMatch[],
    contextMatches: ToolMatch[]
  ): Tool[] {
    // 合并并去重
    const merged = new Map<string, ToolMatch>();
    
    for (const match of [...keywordMatches, ...contextMatches]) {
      const existing = merged.get(match.tool.name);
      if (!existing || existing.confidence < match.confidence) {
        merged.set(match.tool.name, match);
      }
    }
    
    return Array.from(merged.values())
      .sort((a, b) => b.confidence - a.confidence)
      .map(m => m.tool);
  }
  
  private extractKeywords(tool: Tool): string[] {
    const text = `${tool.name} ${tool.description}`.toLowerCase();
    return text.split(/\s+/).filter(w => w.length > 3);
  }
  
  private matchesIntent(tool: Tool, intent?: string): boolean {
    // 简单的意图匹配
    return true;
  }
}

interface ToolMatch {
  tool: Tool;
  confidence: number;
}

interface SelectedTools {
  tools: string[];
  confidence: number;
}
```

---

## 🧪 测试和调试

### Agent 测试

```typescript
// Agent 测试框架
class AgentTester {
  /**
   * 测试 Agent 响应
   */
  async test(agent: IAgent, testCases: TestCase[]): Promise<TestResults> {
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
      const result = await this.runTest(agent, testCase);
      results.push(result);
    }
    
    return {
      total: testCases.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results,
    };
  }
  
  private async runTest(agent: IAgent, testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const response = await agent.run(testCase.input);
      
      // 验证响应
      const validation = this.validateResponse(response, testCase.expected);
      
      return {
        name: testCase.name,
        passed: validation.passed,
        duration: Date.now() - startTime,
        response,
        errors: validation.errors,
      };
    } catch (error: any) {
      return {
        name: testCase.name,
        passed: false,
        duration: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }
  
  private validateResponse(
    response: AgentResponse,
    expected: ExpectedResponse
  ): ValidationResult {
    const errors: string[] = [];
    
    // 检查响应是否包含预期内容
    if (expected.contains) {
      for (const text of expected.contains) {
        if (!response.message.includes(text)) {
          errors.push(`Response should contain "${text}"`);
        }
      }
    }
    
    // 检查工具使用
    if (expected.toolsUsed) {
      const usedTools = response.metadata?.toolsUsed || [];
      for (const tool of expected.toolsUsed) {
        if (!usedTools.includes(tool)) {
          errors.push(`Should use tool "${tool}"`);
        }
      }
    }
    
    // 检查成功状态
    if (expected.success !== undefined && response.success !== expected.success) {
      errors.push(`Success should be ${expected.success}`);
    }
    
    return {
      passed: errors.length === 0,
      errors,
    };
  }
}

interface TestCase {
  name: string;
  input: string;
  expected: ExpectedResponse;
}

interface ExpectedResponse {
  contains?: string[];
  toolsUsed?: string[];
  success?: boolean;
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  response?: AgentResponse;
  errors: string[];
}

interface TestResults {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

interface ValidationResult {
  passed: boolean;
  errors: string[];
}
```

---

## 📚 相关文档

- **[核心引擎](../architecture/core-engine.md)** - Agent 运行时
- **[LLM 集成](../architecture/llm-integration.md)** - LLM 配置
- **[工具开发最佳实践](./tool-development.md)** - 工具开发指南
- **[性能优化](./performance-optimization.md)** - 性能调优

---

**Agent 设计最佳实践文档完成！构建智能 Agent！** 🤖
