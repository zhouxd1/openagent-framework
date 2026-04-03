# @openagent/llm-claude

Claude (Anthropic) adapter for OpenAgent Framework.

## Installation

```bash
npm install @openagent/llm-claude
```

## Quick Start

### Basic Usage

```typescript
import { ClaudeAgent } from '@openagent/llm-claude';

const agent = new ClaudeAgent({
  id: 'my-agent',
  name: 'Claude Assistant',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229',
});

const response = await agent.run('Hello!');
console.log(response.message);
```

### With System Prompt

```typescript
const agent = new ClaudeAgent({
  id: 'assistant',
  name: 'Personal Assistant',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  systemPrompt: 'You are a helpful personal assistant.',
});
```

### With Tools

```typescript
import { ClaudeAgent } from '@openagent/llm-claude';
import { Tool } from '@openagent/core';

// Define a tool
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
    // Implement tool logic
    return {
      success: true,
      data: { temperature: 72, condition: 'sunny' },
    };
  },
};

// Create agent with tool
const agent = new ClaudeAgent({
  id: 'weather-agent',
  name: 'Weather Assistant',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
});

agent.addTool(weatherTool);

const response = await agent.run("What's the weather in San Francisco?");
```

### Streaming Responses

```typescript
const agent = new ClaudeAgent({
  id: 'streaming-agent',
  name: 'Claude Assistant',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229',
});

// Stream response
for await (const chunk of agent.stream('Tell me a story')) {
  process.stdout.write(chunk);
}
```

### Vision (Multimodal)

```typescript
import fs from 'fs';

const agent = new ClaudeAgent({
  id: 'vision-agent',
  name: 'Vision Assistant',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229',
});

// Read image file
const imageBuffer = fs.readFileSync('image.jpg');
const imageBase64 = imageBuffer.toString('base64');

// Analyze image
const response = await agent.runWithVision(
  'Describe this image in detail',
  imageBase64,
  'image/jpeg'
);

console.log(response.message);
```

### Multi-turn Conversation

```typescript
const agent = new ClaudeAgent({
  id: 'chat-agent',
  name: 'Chat Assistant',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
});

// First message
await agent.run('My name is Alice');

// Second message (context is maintained)
const response = await agent.run('What is my name?');
console.log(response.message); // "Your name is Alice."

// Clear conversation
agent.clearConversation();
```

## Provider Usage

For lower-level control, use the `ClaudeProvider` directly:

```typescript
import { ClaudeProvider } from '@openagent/llm-claude';

const provider = new ClaudeProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229',
});

// Complete request
const response = await provider.complete({
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  maxTokens: 1024,
});

console.log(response.text);
```

### Streaming with Provider

```typescript
const provider = new ClaudeProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229',
});

// Stream response
for await (const chunk of provider.stream({
  messages: [
    { role: 'user', content: 'Tell me a joke' }
  ],
})) {
  if (chunk.delta.type === 'text_delta') {
    console.log(chunk.delta.text);
  }
}
```

### Tool Use with Provider

```typescript
const provider = new ClaudeProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
});

const response = await provider.executeWithTools(
  {
    messages: [
      { role: 'user', content: 'What is the weather in Tokyo?' }
    ],
    tools: [
      {
        name: 'get_weather',
        description: 'Get weather for a location',
        input_schema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name',
            },
          },
          required: ['location'],
        },
      },
    ],
  },
  async (toolUse) => {
    // Execute tool
    if (toolUse.name === 'get_weather') {
      const location = toolUse.input.location;
      return `Weather in ${location}: Sunny, 72°F`;
    }
    throw new Error(`Unknown tool: ${toolUse.name}`);
  }
);

console.log(response.text);
```

## Features

- ✅ **Text Completion** - Full support for Claude's text generation
- ✅ **Streaming Response** - Stream responses in real-time
- ✅ **Tool Use** - Function calling with automatic tool execution loop
- ✅ **Vision** - Multimodal support for image analysis
- ✅ **Long Context** - Support for up to 200K token context window
- ✅ **Multi-turn Conversations** - Built-in conversation history management
- ✅ **Error Handling** - Comprehensive error handling and retries
- ✅ **TypeScript** - Full TypeScript support with strict typing

## Supported Models

| Model | Description | Context Window |
|-------|-------------|----------------|
| `claude-3-opus-20240229` | Most powerful Claude model | 200K tokens |
| `claude-3-sonnet-20240229` | Balanced performance | 200K tokens |
| `claude-3-haiku-20240307` | Fast and efficient | 200K tokens |
| `claude-3-5-sonnet-20241022` | Latest Sonnet (recommended) | 200K tokens |

## API Reference

### ClaudeAgent

#### Constructor

```typescript
new ClaudeAgent(config: ClaudeAgentConfig)
```

#### Methods

- `run(input: string, context?: AgentContext): Promise<AgentResponse>` - Execute agent
- `stream(input: string, context?: AgentContext): AsyncGenerator<string>` - Stream response
- `runWithVision(input: string, imageData: string, mediaType: string, context?: AgentContext): Promise<AgentResponse>` - Vision support
- `clearConversation(): void` - Clear conversation history
- `getConversationHistory(): ClaudeMessage[]` - Get conversation history
- `addTool(tool: Tool): void` - Add a tool
- `removeTool(toolName: string): void` - Remove a tool

### ClaudeProvider

#### Constructor

```typescript
new ClaudeProvider(config: ClaudeConfig)
```

#### Methods

- `complete(request: LLMRequest): Promise<LLMResponse>` - Complete request
- `stream(request: LLMRequest): AsyncIterable<LLMChunk>` - Stream response
- `executeWithTools(request: LLMRequest, executor: Function, maxIterations?: number): Promise<LLMResponse>` - Execute with tools
- `isAvailable(): Promise<boolean>` - Check API availability
- `getModels(): Promise<string[]>` - Get supported models

## Differences from OpenAI Adapter

### Message Format

Claude uses a different message format:

**OpenAI:**
```typescript
{ role: 'system', content: '...' }  // Supported
{ role: 'user', content: '...' }
{ role: 'assistant', content: '...' }
```

**Claude:**
```typescript
{ 
  system: '...',  // System prompt is a separate parameter
  messages: [
    { role: 'user', content: '...' },
    { role: 'assistant', content: '...' }
  ]
}
```

### Tool Calling

Claude uses `tool_use` content blocks instead of OpenAI's `tool_calls`:

**OpenAI:**
```typescript
{
  role: 'assistant',
  content: '...',
  tool_calls: [{ id: '...', function: { name: '...', arguments: '...' } }]
}
```

**Claude:**
```typescript
{
  role: 'assistant',
  content: [
    { type: 'text', text: '...' },
    { type: 'tool_use', id: '...', name: '...', input: { ... } }
  ]
}
```

### Vision

Claude's vision support uses content blocks:

```typescript
{
  role: 'user',
  content: [
    { type: 'text', text: 'Describe this image' },
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: '...'
      }
    }
  ]
}
```

## License

MIT
