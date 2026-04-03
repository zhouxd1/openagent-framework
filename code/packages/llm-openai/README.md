# @openagent/llm-openai

OpenAI LLM adapter for OpenAgent Framework with full support for chat completions, streaming, and Function Calling.

## Features

- 🚀 **Chat Completions** - Full support for OpenAI's chat completion API
- 🌊 **Streaming** - Real-time streaming responses via AsyncIterator
- 🛠️ **Function Calling** - Automatic tool execution with multi-turn conversations
- 🔄 **Retry Logic** - Built-in retry mechanism for rate limits and transient errors
- 📝 **TypeScript** - Full TypeScript support with comprehensive types
- 🎯 **Error Handling** - Robust error handling with detailed error messages
- 🔧 **Configurable** - Flexible configuration options for all use cases

## Installation

```bash
npm install @openagent/llm-openai
```

## Quick Start

### Basic Usage

```typescript
import { OpenAIAgent } from '@openagent/llm-openai';

const agent = new OpenAIAgent({
  id: 'my-agent',
  name: 'Assistant',
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

await agent.initialize();

const response = await agent.run('What is the capital of France?');
console.log(response.message);
```

### With Tools (Function Calling)

```typescript
import { OpenAIAgent } from '@openagent/llm-openai';
import { Tool } from '@openagent/core';

const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get the current weather for a location',
  parameters: {
    location: {
      type: 'string',
      description: 'City name',
      required: true,
    },
    unit: {
      type: 'string',
      description: 'Temperature unit (celsius or fahrenheit)',
      enum: ['celsius', 'fahrenheit'],
      required: false,
    },
  },
  execute: async (params) => {
    // Implement weather API call
    const weather = await fetchWeather(params.location, params.unit);
    return {
      success: true,
      data: weather,
    };
  },
};

const agent = new OpenAIAgent({
  id: 'weather-agent',
  name: 'WeatherBot',
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

agent.addTool(weatherTool);
await agent.initialize();

const response = await agent.run('What is the weather in Tokyo?');
console.log(response.message);
```

### Streaming Responses

```typescript
const agent = new OpenAIAgent({
  id: 'streaming-agent',
  name: 'StreamingBot',
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

await agent.initialize();

// Stream response chunks
for await (const chunk of await agent.stream('Tell me a story')) {
  process.stdout.write(chunk);
}
```

### Direct Provider Usage

```typescript
import { OpenAIProvider } from '@openagent/llm-openai';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
});

// Simple completion
const response = await provider.complete({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
});

console.log(response.content);

// Streaming
for await (const chunk of provider.stream({
  messages: [{ role: 'user', content: 'Tell me a joke' }],
})) {
  if (chunk.delta) {
    console.log(chunk.delta);
  }
}

// With tool execution
const toolResponse = await provider.executeWithTools(
  {
    messages: [{ role: 'user', content: 'What time is it?' }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_current_time',
          description: 'Get the current time',
          parameters: { type: 'object', properties: {} },
        },
      },
    ],
  },
  async (toolCall) => {
    if (toolCall.function.name === 'get_current_time') {
      return JSON.stringify({ time: new Date().toISOString() });
    }
    throw new Error('Unknown tool');
  }
);
```

## Configuration

### OpenAIConfig

```typescript
interface OpenAIConfig {
  // Required
  apiKey: string;              // OpenAI API key
  
  // Optional
  baseURL?: string;            // Custom API endpoint
  model?: string;              // Model to use (default: 'gpt-4')
  temperature?: number;        // Temperature 0-2 (default: 0.7)
  maxTokens?: number;          // Max response tokens (default: 2000)
  timeout?: number;            // Request timeout in ms (default: 60000)
  maxRetries?: number;         // Max retry attempts (default: 3)
  organization?: string;       // OpenAI organization ID
}
```

### OpenAIAgentConfig

Extends `AgentConfig` with OpenAI-specific options:

```typescript
interface OpenAIAgentConfig extends AgentConfig, OpenAIConfig {
  retryOnRateLimit?: boolean;              // Auto-retry on 429 errors
  customHeaders?: Record<string, string>;  // Custom API headers
  maxIterations?: number;                  // Max tool calling iterations
}
```

## API Reference

### OpenAIProvider

#### `complete(request: LLMRequest): Promise<LLMResponse>`

Execute a chat completion request.

```typescript
const response = await provider.complete({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gpt-4',              // Optional
  temperature: 0.7,            // Optional
  maxTokens: 100,              // Optional
  tools: [...],                // Optional
  toolChoice: 'auto',          // Optional
});
```

#### `stream(request: LLMRequest): AsyncIterator<LLMChunk>`

Stream a chat completion response.

```typescript
for await (const chunk of provider.stream({
  messages: [{ role: 'user', content: 'Hello!' }],
})) {
  console.log(chunk.delta);
}
```

#### `executeWithTools(request, toolExecutor, maxIterations?)`

Execute completion with automatic tool calling loop.

```typescript
const response = await provider.executeWithTools(
  {
    messages: [{ role: 'user', content: 'What is 2+2?' }],
    tools: [calculatorTool],
  },
  async (toolCall) => {
    const args = JSON.parse(toolCall.function.arguments);
    const result = await executeCalculator(args);
    return JSON.stringify(result);
  },
  5  // max iterations (default: 5)
);
```

#### `isAvailable(): Promise<boolean>`

Check if OpenAI API is accessible.

```typescript
const available = await provider.isAvailable();
```

#### `getModels(): Promise<string[]>`

Get list of available GPT models.

```typescript
const models = await provider.getModels();
// ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo', ...]
```

### OpenAIAgent

Extends `BaseAgent` with OpenAI-specific functionality.

#### `run(input: string, context?: AgentContext): Promise<AgentResponse>`

Execute the agent with input.

```typescript
const response = await agent.run('Hello!', {
  sessionId: 'session-123',
  userId: 'user-456',
  maxIterations: 10,
});
```

#### `stream(input: string, context?: AgentContext): AsyncGenerator<string>`

Stream agent response.

```typescript
for await (const chunk of await agent.stream('Hello!')) {
  process.stdout.write(chunk);
}
```

#### Tool Management

```typescript
agent.addTool(tool);              // Add a tool
agent.removeTool('tool_name');    // Remove a tool
const tools = agent.getTools();   // Get all tools
```

## Types

### LLMRequest

```typescript
interface LLMRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'text' | 'json_object' };
  stop?: string[];
  metadata?: Metadata;
}
```

### LLMResponse

```typescript
interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | string;
  id?: string;
  model?: string;
  metadata?: Metadata;
}
```

### Message

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}
```

### ToolCall

```typescript
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;  // JSON-encoded
  };
}
```

## Error Handling

The provider throws `OpenAgentError` for all errors:

```typescript
import { OpenAgentError, ErrorCode } from '@openagent/core';

try {
  await provider.complete(request);
} catch (error) {
  if (error instanceof OpenAgentError) {
    console.error('Error code:', error.code);
    console.error('Message:', error.message);
    console.error('Details:', error.details);
  }
}
```

Common error codes:
- `ErrorCode.LLM_ERROR` - OpenAI API error
- `ErrorCode.MAX_ITERATIONS_EXCEEDED` - Tool calling loop exceeded max iterations

## Retry Logic

The provider automatically retries on:
- Rate limit errors (429)
- Server errors (5xx)

Configure retry behavior:

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 5,  // Max retry attempts
});
```

## Best Practices

### 1. Always Initialize Agents

```typescript
await agent.initialize();
// ... use agent
await agent.destroy();
```

### 2. Handle Tool Execution Errors

```typescript
const tool: Tool = {
  name: 'my_tool',
  description: 'My tool',
  parameters: { ... },
  execute: async (params) => {
    try {
      const result = await doSomething(params);
      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
};
```

### 3. Use Conversation History

```typescript
// Agent maintains history automatically
await agent.run('What is the capital of France?');
await agent.run('What is its population?'); // Knows we're talking about Paris
```

### 4. Set Appropriate Timeouts

```typescript
const agent = new OpenAIAgent({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,  // 30 seconds
  maxTokens: 1000, // Limit response size
});
```

### 5. Monitor Token Usage

```typescript
const response = await agent.run('Hello');
console.log('Tokens used:', response.metadata?.tokensUsed?.total);
```

## Examples

### Custom Base URL (Azure OpenAI)

```typescript
const agent = new OpenAIAgent({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: 'https://your-resource.openai.azure.com/',
  model: 'gpt-4-deployment',
});
```

### JSON Mode

```typescript
const response = await provider.complete({
  messages: [
    { role: 'system', content: 'You return JSON responses.' },
    { role: 'user', content: 'List 3 fruits' },
  ],
  responseFormat: { type: 'json_object' },
});

const fruits = JSON.parse(response.content);
```

### Multi-Tool Agent

```typescript
const agent = new OpenAIAgent({
  id: 'multi-tool-agent',
  name: 'Assistant',
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

agent.addTool(weatherTool);
agent.addTool(calculatorTool);
agent.addTool(searchTool);

await agent.initialize();

const response = await agent.run(
  'What is the weather in Tokyo? Also, what is 25 * 4?'
);
```

## Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## License

MIT

## Contributing

See the main repository for contribution guidelines.

## Support

For issues and questions, please use the GitHub issue tracker.
