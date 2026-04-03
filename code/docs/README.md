# OpenAgent Framework Documentation

Welcome to the OpenAgent Framework documentation! This directory contains comprehensive guides and references for using and contributing to the framework.

## 📚 Documentation Index

### Getting Started
- **[Getting Started Guide](./getting-started.md)** - Complete setup and basic usage tutorial
- **[Project Summary](./project-summary.md)** - Overview of what's been implemented

### Architecture
- **Architecture Overview** - Coming soon
- **API Reference** - Coming soon
- **Database Schema** - See prisma/schema.prisma

### Development
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute to the project
- **[Code of Conduct](../CODE_OF_CONDUCT.md)** - Community guidelines
- **[Changelog](../CHANGELOG.md)** - Version history and changes

## 🚀 Quick Links

### For Users
1. [Installation](./getting-started.md#installation)
2. [Basic Usage](./getting-started.md#basic-usage)
3. [Examples](./getting-started.md#common-tasks)

### For Developers
1. [Development Setup](../CONTRIBUTING.md#development-setup)
2. [Coding Standards](../CONTRIBUTING.md#coding-standards)
3. [Testing Guidelines](../CONTRIBUTING.md#testing-guidelines)

## 📖 Documentation Structure

```
docs/
├── README.md                 This file
├── getting-started.md        Setup and basic usage
├── project-summary.md        Implementation status
├── architecture.md           (Coming soon)
├── api-reference.md          (Coming soon)
└── examples/                 (Coming soon)
    ├── basic-session.md
    ├── custom-tools.md
    └── llm-integration.md
```

## 🔍 Topics by Category

### Core Concepts
- [ ] Agent Architecture
- [ ] Session Management
- [ ] Tool System
- [ ] Permission Model
- [ ] Event System

### LLM Integration
- [ ] OpenAI Integration
- [ ] Anthropic Integration
- [ ] Google Gemini Integration
- [ ] Custom LLM Adapters

### Tools
- [ ] Built-in Tools
- [ ] Creating Custom Tools
- [ ] Tool Validation
- [ ] Tool Execution Context

### Advanced Topics
- [ ] Performance Optimization
- [ ] Scaling and Deployment
- [ ] Security Best Practices
- [ ] Monitoring and Logging

## 💡 Examples

### Basic Session
```typescript
import { SessionManager } from '@openagent/core';

const sessionManager = new SessionManager();
const session = await sessionManager.create({
  userId: 'user-123',
  metadata: { environment: 'production' }
});
```

### Using LLM Provider
```typescript
import { OpenAIAdapter } from '@openagent/adapters';

const llm = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY
});

const response = await llm.complete({
  messages: [
    { role: 'user', content: 'Hello!' }
  ]
});
```

### Executing Tools
```typescript
import { createToolExecutor } from '@openagent/tools';

const executor = createToolExecutor();
const result = await executor.execute('calculator', {
  expression: '2 + 2'
});
```

## 🆘 Getting Help

### Documentation Issues
If you find errors or have suggestions for improving the documentation:
1. Open an issue on GitHub
2. Label it as "documentation"
3. Describe what needs improvement

### Technical Questions
1. Check the [Getting Started Guide](./getting-started.md)
2. Search [GitHub Discussions](https://github.com/openagent/framework/discussions)
3. Ask a new question if needed

### Bug Reports
1. Check existing issues
2. Use the bug report template
3. Include reproduction steps

## 🔄 Documentation Updates

This documentation is actively maintained and updated. Check the repository for the latest version.

Last Updated: April 2024
Version: v0.1.0-alpha.1

---

## 📋 Contributing to Documentation

We welcome documentation improvements! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Documentation Style Guide
- Use clear, simple language
- Include code examples
- Provide screenshots when helpful
- Keep examples up-to-date
- Test all code snippets

---

**Happy Coding! 🎉**

Questions? Join our [GitHub Discussions](https://github.com/openagent/framework/discussions)
