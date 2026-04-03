# @openagent/llm-deepseek

DeepSeek adapter for OpenAgent Framework.

## Features

- ✅ Text completion
- ✅ Streaming response
- ✅ Function Calling
- ✅ DeepSeek Coder (代码专用)
- ✅ Long context (64K tokens)
- ✅ OpenAI API compatibility

## Installation

```bash
npm install @openagent/llm-deepseek
```

## Quick Start

### Basic Usage

```typescript
import { DeepSeekAgent } from '@openagent/llm-deepseek';

const agent = new DeepSeekAgent({
  id: 'my-agent',
  name: 'DeepSeekBot',
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat',
});

await agent.initialize();

const response = await agent.run('Hello!');
console.log(response.message);
```

### With Tools

```typescript
import { DeepSeekAgent } from '@openagent/llm-deepseek';

const agent = new DeepSeekAgent({
  id: 'weather-agent',
  name: 'WeatherBot',
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat',
});

// Add a tool
agent.addTool({
  name: 'get_weather',
  description: 'Get weather information for a city',
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
});

await agent.initialize();

const response = await agent.run('What is the weather in Tokyo?');
console.log(response.message);
```

### Streaming

```typescript
import { DeepSeekAgent } from '@openagent/llm-deepseek';

const agent = new DeepSeekAgent({
  id: 'stream-agent',
  name: 'StreamBot',
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat',
});

await agent.initialize();

// Stream response
for await (const chunk of agent.stream('Tell me a story')) {
  process.stdout.write(chunk);
}
```

### Using DeepSeek Coder

```typescript
import { DeepSeekAgent } from '@openagent/llm-deepseek';

const agent = new DeepSeekAgent({
  id: 'code-agent',
  name: 'CodeBot',
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-coder', // Code-specialized model
});

await agent.initialize();

const response = await agent.run('Write a function to sort an array in Python');
console.log(response.message);
```

## Supported Models

### deepseek-chat
- **Type**: General-purpose conversational model
- **Context**: 64K tokens
- **Best for**: General conversations, Q&A, reasoning

### deepseek-coder
- **Type**: Code-specialized model
- **Context**: 64K tokens
- **Best for**: Code generation, debugging, code review

## API Compatibility

DeepSeek API is fully compatible with OpenAI API format:

- Same message format
- Same function calling format
- Same streaming format
- Same error handling

This means you can easily switch between OpenAI and DeepSeek by changing:
1. API key
2. Base URL (default: `https://api.deepseek.com/v1`)
3. Model name

## Configuration

```typescript
interface DeepSeekConfig {
  // Required
  apiKey: string;
  
  // Optional
  baseURL?: string;      // Default: https://api.deepseek.com/v1
  model?: 'deepseek-chat' | 'deepseek-coder';  // Default: 'deepseek-chat'
  temperature?: number;  // 0-2, Default: 1
  maxTokens?: number;    // Default: 4096
  timeout?: number;      // Default: 60000ms
  maxRetries?: number;   // Default: 3
}
```

## Examples

### Example 1: Simple Chat

```typescript
import { DeepSeekAgent } from '@openagent/llm-deepseek';

const agent = new DeepSeekAgent({
  id: 'chat-bot',
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

await agent.initialize();

const response = await agent.run('What is the capital of France?');
console.log(response.message);
// Output: The capital of France is Paris.
```

### Example 2: Code Generation

```typescript
import { DeepSeekAgent } from '@openagent/llm-deepseek';

const agent = new DeepSeekAgent({
  id: 'code-gen',
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-coder',
  systemPrompt: 'You are an expert Python developer.',
});

await agent.initialize();

const response = await agent.run(`
  Write a Python function that:
  1. Takes a list of numbers
  2. Filters out even numbers
  3. Returns the sum of remaining odd numbers
`);

console.log(response.message);
```

### Example 3: Function Calling

```typescript
import { DeepSeekAgent } from '@openagent/llm-deepseek';

const agent = new DeepSeekAgent({
  id: 'assistant',
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// Add calculator tool
agent.addTool({
  name: 'calculate',
  description: 'Perform mathematical calculations',
  parameters: {
    expression: {
      type: 'string',
      description: 'Mathematical expression to evaluate',
      required: true,
    },
  },
  execute: async (params) => {
    const result = eval(params.expression);
    return {
      success: true,
      data: { result },
    };
  },
});

await agent.initialize();

const response = await agent.run('What is 25 * 4 + 10?');
console.log(response.message);
// Output will use the calculate tool and return the result
```

### Example 4: Multi-turn Conversation

```typescript
import { DeepSeekAgent } from '@openagent/llm-deepseek';

const agent = new DeepSeekAgent({
  id: 'conversational-agent',
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

await agent.initialize();

// First message
await agent.run('My name is Alice.');

// Second message - agent remembers context
const response = await agent.run('What is my name?');
console.log(response.message);
// Output: Your name is Alice.
```

## Error Handling

```typescript
import { DeepSeekAgent } from '@openagent/llm-deepseek';

const agent = new DeepSeekAgent({
  id: 'error-demo',
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

await agent.initialize();

const response = await agent.run('Hello!');

if (response.success) {
  console.log('Response:', response.message);
} else {
  console.error('Error:', response.error);
  console.error('Details:', response.metadata);
}
```

## Provider API

### DeepSeekProvider

```typescript
import { DeepSeekProvider } from '@openagent/llm-deepseek';

const provider = new DeepSeekProvider({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat',
});

// Complete
const response = await provider.complete({
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});

// Stream
for await (const chunk of provider.stream({
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
})) {
  console.log(chunk.delta);
}
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Building

```bash
# Build the package
npm run build

# Watch mode
npm run dev
```

## License

MIT

## Links

- [DeepSeek API Documentation](https://platform.deepseek.com/docs)
- [OpenAgent Framework](https://github.com/openagent/framework)
- [Report Issues](https://github.com/openagent/framework/issues)
