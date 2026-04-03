# Basic Chatbot Example

A simple chatbot example using OpenAgent Framework.

## Features

- Basic chatbot using GPT-4
- Conversation history management
- Streaming responses
- Error handling

## Quick Start

```bash
# Install dependencies
npm install

# Set API key
export OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# Run
npm start
```

## Project Structure

```
basic-chatbot/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    └── index.ts
```

## Code

See `src/index.ts` for the complete implementation.

## Usage

```bash
# Chat with the bot
npm start

# Enter your message when prompted
> Hello, how are you?

# Bot will respond
Bot: Hello! I'm doing well, thank you for asking...
```

## Customization

1. **Change Model**: Edit `src/index.ts` and change `model: 'gpt-4'`
2. **Add System Prompt**: Modify `systemPrompt` in the config
3. **Add Tools**: Import and add tools to the `tools` array

## Next Steps

- Add custom tools
- Implement persistent conversation history
- Add web interface
- Deploy to production

## License

MIT
