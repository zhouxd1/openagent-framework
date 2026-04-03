# Getting Started Guide

This guide will help you get up and running with OpenAgent Framework.

## Installation

### Prerequisites

Before installing OpenAgent, ensure you have:

- **Node.js 20.x** or later
- **npm 9.x** or later
- **Git** for version control
- **SQLite** for development database
- **Redis** (optional) for caching

### Quick Install

```bash
# Clone the repository
git clone https://github.com/openagent/framework.git
cd framework

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Setup database
npm run db:generate
npm run db:migrate

# Build the project
npm run build

# Run CLI
./packages/cli/bin/run.js --help
```

## Basic Usage

### 1. Hello World

Start with a simple hello command:

```bash
openagent hello
# Output: 🎉 Hello World! Welcome to OpenAgent Framework.
```

### 2. Create a Session

```typescript
import { SessionManager } from '@openagent/core';

const sessionManager = new SessionManager();

// Create a new session
const session = await sessionManager.create({
  userId: 'user-123',
  metadata: {
    environment: 'production'
  }
});

console.log('Session created:', session.id);
```

### 3. Use LLM Provider

```typescript
import { OpenAIAdapter } from '@openagent/adapters';

const llm = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4-turbo-preview'
});

// Send a message
const response = await llm.complete({
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ]
});

console.log('Response:', response.message.content);
```

### 4. Execute Tools

```typescript
import { createToolExecutor } from '@openagent/tools';

const executor = createToolExecutor();

// List available tools
const tools = await executor.getTools();
console.log('Available tools:', tools.map(t => t.name));

// Execute a tool
const result = await executor.execute('calculator', {
  expression: '2 + 2'
});

console.log('Result:', result.data); // Output: 4
```

### 5. Build a Complete Agent

```typescript
import { SessionManager } from '@openagent/core';
import { OpenAIAdapter } from '@openagent/adapters';
import { createToolExecutor } from '@openagent/tools';

// Initialize components
const sessionManager = new SessionManager();
const llm = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY
});
const toolExecutor = createToolExecutor();

// Create a session
const session = await sessionManager.create({
  userId: 'user-123'
});

// Add user message
await sessionManager.addMessage(session.id, {
  role: 'user',
  content: 'What is the weather in San Francisco?'
});

// Get conversation history
const messages = await sessionManager.getMessages(session.id);

// Get LLM response
const response = await llm.complete({
  messages: messages.map(m => ({
    role: m.role,
    content: m.content
  }))
});

// Add assistant response
await sessionManager.addMessage(session.id, {
  role: 'assistant',
  content: response.message.content
});

console.log('Assistant:', response.message.content);
```

## Project Structure

```
framework/
├── packages/
│   ├── core/              # Core interfaces and utilities
│   │   ├── src/
│   │   │   ├── interfaces.ts
│   │   │   ├── types.ts
│   │   │   ├── session-manager.ts
│   │   │   ├── tool-executor.ts
│   │   │   └── ...
│   │   └── tests/
│   ├── cli/               # CLI commands
│   │   ├── src/
│   │   │   └── commands/
│   │   └── bin/
│   ├── adapters/          # LLM provider adapters
│   │   └── src/
│   │       ├── openai-adapter.ts
│   │       └── ...
│   └── tools/             # Built-in tools
│       └── src/
│           └── builtin/
├── prisma/                # Database schema
│   └── schema.prisma
├── docs/                  # Documentation
├── tests/                 # Integration tests
└── package.json           # Root package
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="file:./dev.db"

# Redis (Optional)
REDIS_URL="redis://localhost:6379"

# LLM Providers
OPENAI_API_KEY="your-key-here"
ANTHROPIC_API_KEY="your-key-here"

# Session
SESSION_SECRET="your-secret-here"
SESSION_TTL="86400"

# Logging
LOG_LEVEL="info"
NODE_ENV="development"
```

### TypeScript Configuration

The project uses TypeScript with strict mode enabled. Key configurations:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## Common Tasks

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- packages/core/tests/utils.test.ts

# Run with coverage
npm run test:coverage
```

### Building the Project

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@openagent/core
```

### Database Management

```bash
# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate

# Open Prisma Studio
npm run db:studio
```

### Linting and Formatting

```bash
# Run linter
npm run lint

# Format code
npm run format
```

## Next Steps

- Read the [API Reference](./api-reference.md)
- Learn about the [Architecture](./architecture.md)
- Explore [Examples](./examples/)
- Join our [Community](https://github.com/openagent/framework/discussions)

## Troubleshooting

### Common Issues

**Issue**: Prisma client not generated
```bash
# Solution
npm run db:generate
```

**Issue**: Database migration fails
```bash
# Solution: Reset database
npx prisma migrate reset
```

**Issue**: TypeScript compilation errors
```bash
# Solution: Clean and rebuild
npm run clean
npm run build
```

### Getting Help

- **Documentation**: Check the `docs/` folder
- **Issues**: [GitHub Issues](https://github.com/openagent/framework/issues)
- **Discussions**: [GitHub Discussions](https://github.com/openagent/framework/discussions)

---

Happy coding! 🚀
