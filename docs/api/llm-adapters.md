# LLM 适配器参考

OpenAgent Framework 支持多种 LLM 提供商的完整配置和使用指南。

---

## 📋 目录

1. [OpenAI](#openai)
2. [Claude (Anthropic)](#claude-anthropic)
3. [DeepSeek](#deepseek)
4. [GLM (智谱)](#glm-智谱)
5. [Ollama (本地)](#ollama-本地)
6. [多 LLM 路由](#多-llm-路由)

---

## 🤖 OpenAI

OpenAI GPT 系列模型适配器。

### 安装

```bash
npm install @openagent/llm-openai
```

### 导入

```typescript
import { OpenAIProvider, OpenAIConfig } from '@openagent/llm-openai';
```

### 配置

```typescript
interface OpenAIConfig {
  // API 配置
  apiKey: string;              // OpenAI API Key
  organization?: string;        // 组织 ID
  baseURL?: string;            // 自定义 API 端点
  
  // 模型配置
  model?: string;              // 模型名称
  temperature?: number;        // 温度参数（0-2）
  maxTokens?: number;          // 最大 Token 数
  topP?: number;              // Top P（0-1）
  presencePenalty?: number;    // 存在惩罚（-2 to 2）
  frequencyPenalty?: number;   // 频率惩罚（-2 to 2）
  
  // 请求配置
  timeout?: number;            // 超时时间（毫秒）
  maxRetries?: number;         // 最大重试次数
  
  // 代理配置
  proxy?: {
    host: string;
    port: number;
    auth?: {
      username: string;
      password: string;
    };
  };
}
```

### 使用示例

```typescript
import { OpenAIProvider } from '@openagent/llm-openai';

// 创建提供商
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
  
  model: 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 2000,
  
  timeout: 60000,
  maxRetries: 3,
});

// 聊天完成
const response = await provider.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
});

console.log(response.content);
console.log('Tokens:', response.usage);

// 流式响应
const stream = await provider.stream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  onToken: (token) => process.stdout.write(token),
});

console.log('\nComplete!');
```

### 可用模型

| 模型名称 | 上下文长度 | 用途 | 推荐场景 |
|---------|----------|------|---------|
| `gpt-4-turbo-preview` | 128K | 最新 GPT-4 Turbo | 推荐，性价比高 |
| `gpt-4` | 8K | GPT-4 基础版 | 复杂推理任务 |
| `gpt-4-32k` | 32K | GPT-4 32K | 长文本 |
| `gpt-3.5-turbo` | 16K | GPT-3.5 Turbo | 快速、低成本 |
| `gpt-3.5-turbo-16k` | 16K | GPT-3.5 16K | 中等长度文本 |

### 高级功能

#### Function Calling

```typescript
const response = await provider.chat({
  messages: [
    { role: 'user', content: 'What is the weather in Beijing?' },
  ],
  functions: [
    {
      name: 'get_weather',
      description: 'Get current weather',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'City name',
          },
        },
        required: ['city'],
      },
    },
  ],
  functionCall: 'auto',
});

if (response.functionCall) {
  console.log('Function:', response.functionCall.name);
  console.log('Arguments:', response.functionCall.arguments);
}
```

#### Vision (GPT-4V)

```typescript
const response = await provider.chat({
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What is in this image?',
        },
        {
          type: 'image_url',
          imageUrl: {
            url: 'https://example.com/image.jpg',
            // 或使用 base64
            // url: 'data:image/jpeg;base64,{base64_data}',
          },
        },
      ],
    },
  ],
  model: 'gpt-4-vision-preview',
});

console.log(response.content);
```

#### JSON Mode

```typescript
const response = await provider.chat({
  messages: [
    { role: 'user', content: 'List 3 fruits with their colors' },
  ],
  responseFormat: { type: 'json_object' },
});

const fruits = JSON.parse(response.content);
console.log(fruits);
```

---

## 🎭 Claude (Anthropic)

Claude 系列模型适配器。

### 安装

```bash
npm install @openagent/llm-claude
```

### 导入

```typescript
import { ClaudeProvider, ClaudeConfig } from '@openagent/llm-claude';
```

### 配置

```typescript
interface ClaudeConfig {
  // API 配置
  apiKey: string;              // Anthropic API Key
  baseURL?: string;            // 自定义 API 端点
  
  // 模型配置
  model?: string;              // 模型名称
  maxTokens?: number;          // 最大 Token 数（必需）
  temperature?: number;        // 温度参数（0-1）
  topP?: number;              // Top P（0-1）
  topK?: number;              // Top K
  
  // 系统提示词
  systemPrompt?: string;       // 系统提示词
  
  // 停止序列
  stopSequences?: string[];    // 停止序列
  
  // 请求配置
  timeout?: number;            // 超时时间（毫秒）
  maxRetries?: number;         // 最大重试次数
}
```

### 使用示例

```typescript
import { ClaudeProvider } from '@openagent/llm-claude';

const provider = new ClaudeProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  
  model: 'claude-3-opus-20240229',
  maxTokens: 4096,
  temperature: 0.7,
  
  systemPrompt: 'You are a helpful AI assistant.',
});

// 聊天完成
const response = await provider.chat({
  messages: [
    { role: 'user', content: 'Hello, Claude!' },
  ],
});

console.log(response.content);

// 流式响应
const stream = await provider.stream({
  messages: [{ role: 'user', content: 'Write a poem' }],
  onToken: (token) => process.stdout.write(token),
});
```

### 可用模型

| 模型名称 | 上下文长度 | 特点 | 推荐场景 |
|---------|----------|------|---------|
| `claude-3-opus-20240229` | 200K | 最强推理能力 | 复杂任务、高质量输出 |
| `claude-3-sonnet-20240229` | 200K | 平衡性能和成本 | 推荐，通用场景 |
| `claude-3-haiku-20240307` | 200K | 快速响应 | 简单任务、实时应用 |
| `claude-2.1` | 200K | Claude 2.1 | 向后兼容 |

### 高级功能

#### Tool Use

```typescript
const response = await provider.chat({
  messages: [
    { role: 'user', content: 'What is 25 * 4?' },
  ],
  tools: [
    {
      name: 'calculator',
      description: 'Perform calculations',
      input_schema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Math expression',
          },
        },
        required: ['expression'],
      },
    },
  ],
});

if (response.toolUse) {
  console.log('Tool:', response.toolUse.name);
  console.log('Input:', response.toolUse.input);
}
```

#### Vision

```typescript
const response = await provider.chat({
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'url',
            url: 'https://example.com/image.jpg',
            // 或使用 base64
            // type: 'base64',
            // media_type: 'image/jpeg',
            // data: 'base64_data',
          },
        },
        {
          type: 'text',
          text: 'Describe this image',
        },
      ],
    },
  ],
  model: 'claude-3-opus-20240229',
});

console.log(response.content);
```

---

## 🧠 DeepSeek

DeepSeek 模型适配器。

### 安装

```bash
npm install @openagent/llm-deepseek
```

### 导入

```typescript
import { DeepSeekProvider, DeepSeekConfig } from '@openagent/llm-deepseek';
```

### 配置

```typescript
interface DeepSeekConfig {
  // API 配置
  apiKey: string;              // DeepSeek API Key
  baseURL?: string;            // 自定义 API 端点
  
  // 模型配置
  model?: string;              // 模型名称
  temperature?: number;        // 温度参数
  maxTokens?: number;          // 最大 Token 数
  topP?: number;              // Top P
  
  // 请求配置
  timeout?: number;            // 超时时间
  maxRetries?: number;         // 最大重试次数
}
```

### 使用示例

```typescript
import { DeepSeekProvider } from '@openagent/llm-deepseek';

const provider = new DeepSeekProvider({
  apiKey: process.env.DEEPSEEK_API_KEY,
  
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 4000,
});

// 聊天完成
const response = await provider.chat({
  messages: [
    { role: 'user', content: 'Explain quantum computing' },
  ],
});

console.log(response.content);
```

### 可用模型

| 模型名称 | 用途 | 特点 |
|---------|------|------|
| `deepseek-chat` | 通用对话 | 推荐，性价比高 |
| `deepseek-coder` | 代码生成 | 代码专家，支持多种语言 |

### DeepSeek Coder

```typescript
const coderProvider = new DeepSeekProvider({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-coder',
});

const response = await coderProvider.chat({
  messages: [
    { 
      role: 'user', 
      content: 'Write a Python function to sort a list' 
    },
  ],
});

console.log(response.content);
```

---

## 🌟 GLM (智谱)

GLM (智谱) 模型适配器。

### 安装

```bash
npm install @openagent/llm-glm
```

### 配置与使用

```typescript
import { GLMProvider } from '@openagent/llm-glm';

const provider = new GLMProvider({
  apiKey: process.env.GLM_API_KEY,
  
  model: 'glm-4',
  temperature: 0.7,
  maxTokens: 4000,
});

const response = await provider.chat({
  messages: [
    { role: 'user', content: '你好！' },
  ],
});

console.log(response.content);
```

### 可用模型

| 模型名称 | 特点 | 推荐场景 |
|---------|------|---------|
| `glm-4` | 最新版本，能力强 | 推荐 |
| `glm-3-turbo` | 快速，性价比高 | 简单任务 |

---

## 🐫 Ollama (本地)

Ollama 本地模型适配器。

### 安装

```bash
npm install @openagent/llm-ollama
```

### 配置

```typescript
interface OllamaConfig {
  // 服务配置
  baseURL?: string;            // Ollama 服务地址
  
  // 模型配置
  model: string;               // 模型名称
  temperature?: number;        // 温度参数
  numCtx?: number;            // 上下文长度
  numPredict?: number;        // 预测 Token 数
  
  // 请求配置
  timeout?: number;            // 超时时间
}
```

### 使用示例

```typescript
import { OllamaProvider } from '@openagent/llm-ollama';

const provider = new OllamaProvider({
  baseURL: 'http://localhost:11434',
  
  model: 'llama2',
  temperature: 0.7,
  numCtx: 4096,
});

const response = await provider.chat({
  messages: [
    { role: 'user', content: 'Hello!' },
  ],
});

console.log(response.content);
```

### 常用模型

| 模型名称 | 参数量 | 特点 |
|---------|-------|------|
| `llama2` | 7B/13B/70B | Meta Llama 2 |
| `mistral` | 7B | Mistral AI |
| `codellama` | 7B/13B/34B | 代码专用 |
| `deepseek-coder` | 6.7B | DeepSeek 代码模型 |
| `qwen` | 7B/14B | 通义千问 |

### 安装模型

```bash
# 安装 Ollama
# https://ollama.ai

# 拉取模型
ollama pull llama2
ollama pull mistral
ollama pull codellama

# 列出已安装模型
ollama list
```

---

## 🔄 多 LLM 路由

使用多个 LLM 提供商，根据任务类型自动路由。

### 配置路由器

```typescript
import { LLMRouter } from '@openagent/core';
import { OpenAIProvider } from '@openagent/llm-openai';
import { ClaudeProvider } from '@openagent/llm-claude';
import { DeepSeekProvider } from '@openagent/llm-deepseek';

// 创建提供商
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
    model: 'deepseek-coder',
  }),
};

// 创建路由器
const router = new LLMRouter({
  providers,
  defaultProvider: 'openai',
  
  // 路由规则
  routing: {
    // 代码任务 → DeepSeek Coder
    code: 'deepseek',
    
    // 推理任务 → Claude
    reasoning: 'claude',
    
    // 创意写作 → OpenAI
    creative: 'openai',
    
    // 默认 → OpenAI
    default: 'openai',
  },
  
  // 故障转移
  fallback: {
    openai: ['claude', 'deepseek'],
    claude: ['openai'],
    deepseek: ['openai'],
  },
  
  // 负载均衡（可选）
  loadBalancing: {
    enabled: true,
    strategy: 'round-robin',  // 或 'least-connections'
  },
});
```

### 使用路由器

```typescript
// 自动路由
const response = await router.chat({
  messages: [{ role: 'user', content: 'Write a Python function' }],
  taskType: 'code',  // 自动路由到 DeepSeek Coder
});

// 手动指定提供商
const response = await router.chat({
  messages: [{ role: 'user', content: 'Explain relativity' }],
  provider: 'claude',  // 使用 Claude
});

// 故障转移
const response = await router.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  fallback: true,  // 启用故障转移
});
```

### 自定义路由逻辑

```typescript
const router = new LLMRouter({
  providers,
  
  // 自定义路由函数
  router: (messages, context) => {
    const content = messages[messages.length - 1].content.toLowerCase();
    
    // 代码相关 → DeepSeek
    if (content.includes('code') || content.includes('function')) {
      return 'deepseek';
    }
    
    // 数学/推理 → Claude
    if (content.includes('math') || content.includes('proof')) {
      return 'claude';
    }
    
    // 默认 → OpenAI
    return 'openai';
  },
});
```

---

## 📊 成本优化

### Token 计数

```typescript
import { TokenCounter } from '@openagent/core';

const counter = new TokenCounter();

const tokens = counter.count('Hello, world!', 'gpt-4');
console.log('Tokens:', tokens);

const cost = counter.estimateCost(tokens, 'gpt-4', 'input');
console.log('Cost:', cost);
```

### 缓存策略

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  
  // 启用缓存
  cache: {
    enabled: true,
    ttl: 3600000,  // 1 小时
    maxSize: 1000,  // 最多缓存 1000 个响应
  },
});
```

---

## 📚 相关文档

- **[配置指南](../getting-started/configuration.md)** - LLM 配置详解
- **[Core API](./core-api.md)** - 核心 API 参考
- **[性能优化](../best-practices/performance-optimization.md)** - 性能最佳实践

---

**选择合适的 LLM，打造强大的 Agent！** 🚀
