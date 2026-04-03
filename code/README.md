# OpenAgent Framework

<div align="center">

![OpenAgent Logo](docs/logo.png)

**Enterprise-grade AI Agent Framework with Multi-LLM Support**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha.1-orange.svg)](https://github.com/openagent/framework)

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## 📖 Overview

OpenAgent Framework is an open-source, enterprise-grade AI agent framework designed to simplify the development, deployment, and management of AI-powered applications. It provides a unified interface for multiple LLM providers, robust tool execution capabilities, and enterprise-ready features like session management and permission control.

## ✨ Features

### Core Capabilities
- 🤖 **Multi-LLM Support** - Seamless integration with OpenAI, Anthropic, Gemini, and more
- 🔧 **Tool System** - Extensible tool executor with built-in safety and validation
- 💬 **Session Management** - Persistent conversation contexts with state tracking
- 🔐 **Permission System** - Fine-grained access control for enterprise deployments

### Developer Experience
- 📦 **Monorepo Architecture** - Clean separation of concerns with shared utilities
- 🎯 **TypeScript First** - Full type safety and excellent IDE support
- 🧪 **Comprehensive Testing** - Unit tests with Vitest and integration tests
- 📚 **Rich Documentation** - Detailed guides and API references

### Production Ready
- 🚀 **CLI Tools** - Powerful command-line interface for management
- 💾 **Database Support** - SQLite for development, PostgreSQL for production
- 🔄 **Redis Integration** - High-performance caching and session storage
- 📊 **Observability** - Built-in logging and monitoring support

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenAgent Framework                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │   CLI    │   │   Core   │   │ Adapters │   │   Tools  │ │
│  │  Package │   │ Package  │   │ Package  │   │ Package  │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘ │
│       │              │              │              │        │
│       └──────────────┴──────────────┴──────────────┘        │
│                              │                               │
│              ┌───────────────┴───────────────┐              │
│              │     Core Interfaces            │              │
│              │  - ToolExecutor                │              │
│              │  - LLMProvider                 │              │
│              │  - SessionManager              │              │
│              │  - PermissionManager           │              │
│              └────────────────────────────────┘              │
│                              │                               │
└──────────────────────────────┴───────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │     Data & Infrastructure       │
              │  - Prisma ORM                    │
              │  - Redis Cache                   │
              │  - SQLite / PostgreSQL          │
              └─────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or later
- npm 9.x or later
- SQLite (for development)
- Redis (optional, for caching)

### Installation

```bash
# Clone the repository
git clone https://github.com/openagent/framework.git
cd framework

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Build the project
npm run build
```

### Basic Usage

```bash
# Show help
openagent --help

# Show version
openagent --version

# Run hello command
openagent hello

# Start interactive session
openagent chat
```

### Programmatic Usage

```typescript
import { SessionManager } from '@openagent/core';
import { OpenAIAdapter } from '@openagent/adapters';
import { ToolExecutor } from '@openagent/tools';

// Initialize components
const llmProvider = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});

const toolExecutor = new ToolExecutor();
const sessionManager = new SessionManager();

// Create a session
const session = await sessionManager.create({
  userId: 'user-123',
  metadata: { environment: 'production' }
});

// Execute a tool
const result = await toolExecutor.execute('weather', {
  location: 'San Francisco'
});
```

## 📦 Packages

### @openagent/core
Core interfaces, types, and utilities used across the framework.

### @openagent/cli
Command-line interface for interacting with the framework.

### @openagent/adapters
LLM provider adapters (OpenAI, Anthropic, Gemini, etc.).

### @openagent/tools
Built-in tools and tool execution system.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- packages/core/tests/session.test.ts
```

## 📚 Documentation

- [Getting Started Guide](docs/getting-started.md)
- [API Reference](docs/api-reference.md)
- [Architecture Overview](docs/architecture.md)
- [Contributing Guide](CONTRIBUTING.md)

## 🛠️ Development

```bash
# Run in development mode
npm run dev

# Lint code
npm run lint

# Format code
npm run format

# Build all packages
npm run build

# Clean build artifacts
npm run clean
```

## 🗺️ Roadmap

### v0.1.0-alpha.1 (Current)
- ✅ Basic CLI with Oclif
- ✅ Core interfaces and types
- ✅ Prisma integration with SQLite
- ✅ Basic OpenAI adapter
- ✅ Tool executor prototype

### v0.2.0-alpha.2 (Next)
- 🔄 Additional LLM adapters (Anthropic, Gemini)
- 🔄 Advanced tool system with validation
- 🔄 Redis caching integration
- 🔄 WebSocket support

### v0.3.0-beta.1
- 📋 PostgreSQL support
- 📋 Permission system
- 📋 Plugin architecture
- 📋 Production deployment guides

### v1.0.0
- 📋 Full API documentation
- 📋 Performance optimization
- 📋 Enterprise features
- 📋 Long-term support

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Oclif](https://oclif.io/) - CLI framework
- Powered by [Prisma](https://www.prisma.io/) - Database toolkit
- Tested with [Vitest](https://vitest.dev/) - Testing framework

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/openagent/framework/issues)
- **Discussions**: [GitHub Discussions](https://github.com/openagent/framework/discussions)
- **Email**: team@openagent.dev

---

<div align="center">
  <sub>Built with ❤️ by the OpenAgent Team</sub>
</div>
