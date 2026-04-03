# Code Assistant Example

An AI-powered code assistant that helps with code analysis, formatting, and generation.

## Features

- Code analysis and review
- Code formatting
- Language detection
- Multi-language support (JavaScript, TypeScript, Python, etc.)

## Quick Start

```bash
# Install dependencies
npm install

# Set API key
export OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Run
npm start
```

## Available Tools

1. **analyze_code** - Analyze code for issues and improvements
2. **format_code** - Format code according to best practices
3. **detect_language** - Detect programming language

## Usage

```bash
# Analyze code
> Analyze this code: function foo(x) { return x * 2 }

# Format code
> Format this Python code: def hello(): print("hello")

# Get help
> How can I improve this function?
```

## Example Session

```
You: Analyze this JavaScript code:
function calc(a,b) {
  return a+b
}

Assistant: I'll analyze the code for you.

[Uses analyze_code tool]

Here's my analysis:
✓ The function is syntactically correct
⚠ Consider adding:
  - Type annotations
  - Parameter validation
  - JSDoc comments
  - Descriptive function name

Suggested improvements:
/**
 * Adds two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Arguments must be numbers');
  }
  return a + b;
}
```

## License

MIT
