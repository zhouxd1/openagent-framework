# Contributing to OpenAgent Framework

First off, thank you for considering contributing to OpenAgent Framework! It's people like you that make OpenAgent such a great tool.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by the OpenAgent Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to team@openagent.dev.

## Development Setup

### Prerequisites

- Node.js 20.x or later
- npm 9.x or later
- Git
- SQLite (for development)
- Redis (optional, for caching)

### Initial Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/framework.git
cd framework

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Build the project
npm run build

# Run tests
npm test
```

## Development Workflow

### 1. Create a Branch

```bash
# Create a feature branch
git checkout -b feature/amazing-feature

# Or a bugfix branch
git checkout -b bugfix/issue-123
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the coding standards
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Format code
npm run format
```

### 4. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature
git commit -m "feat: add new tool executor"

# Bug fix
git commit -m "fix: resolve session memory leak"

# Documentation
git commit -m "docs: update API reference"

# Refactoring
git commit -m "refactor: simplify permission logic"

# Test
git commit -m "test: add unit tests for tool executor"
```

### 5. Push and Create PR

```bash
git push origin feature/amazing-feature
```

Then create a Pull Request on GitHub.

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Define proper types (avoid `any` when possible)
- Use interfaces for public APIs
- Document public APIs with JSDoc

### Code Style

- Use Prettier for formatting
- Follow ESLint rules
- Use meaningful variable names
- Keep functions small and focused
- Write self-documenting code

### File Organization

```
packages/
  ├── core/
  │   ├── src/
  │   │   ├── interfaces.ts      # Public interfaces
  │   │   ├── types.ts           # Type definitions
  │   │   ├── implementation.ts  # Core logic
  │   │   └── index.ts           # Public exports
  │   └── tests/
  │       └── implementation.test.ts
```

### Example Code

```typescript
/**
 * Session Manager Interface
 */
export interface ISessionManager {
  /**
   * Create a new session
   * @param config - Session configuration
   * @returns Created session state
   */
  create(config: SessionConfig): Promise<SessionState>;
}

/**
 * Session Manager Implementation
 */
export class SessionManager implements ISessionManager {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async create(config: SessionConfig): Promise<SessionState> {
    // Implementation here
  }
}
```

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```
feat(tools): add weather tool implementation

- Add weather tool definition
- Implement weather API integration
- Add unit tests for weather tool

Closes #123
```

## Pull Request Process

### Before Submitting

1. **Update documentation** - Update README.md, API docs, etc.
2. **Add tests** - Maintain or improve code coverage
3. **Run all tests** - Ensure all tests pass
4. **Check linting** - Fix all ESLint issues
5. **Update CHANGELOG** - Add your changes to CHANGELOG.md

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] CHANGELOG updated
```

### Review Process

1. At least 2 approvals required
2. All CI checks must pass
3. No merge conflicts
4. Squash and merge to main

## Testing Guidelines

### Unit Tests

- Write tests for all new functionality
- Aim for >80% code coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Test Structure

```typescript
describe('SessionManager', () => {
  describe('create', () => {
    it('should create a new session with valid config', async () => {
      // Arrange
      const config = { userId: 'test-user' };

      // Act
      const session = await sessionManager.create(config);

      // Assert
      expect(session).toBeDefined();
      expect(session.userId).toBe('test-user');
    });

    it('should throw error for invalid config', async () => {
      // Test error cases
    });
  });
});
```

### Integration Tests

- Test database interactions
- Test API endpoints
- Test tool execution
- Test LLM adapter integrations

## Documentation

### Code Documentation

- Use JSDoc for public APIs
- Include examples in comments
- Document complex algorithms
- Explain business logic

### README Updates

- Update feature list
- Add usage examples
- Update installation steps
- Include screenshots/GIFs if helpful

### API Documentation

- Document all public interfaces
- Include request/response examples
- Document error scenarios
- Keep API docs in sync with code

## Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: team@openagent.dev for private inquiries

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project README

Thank you for contributing! 🎉
