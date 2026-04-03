import { ReActAgent, AgentConfig } from '@openagent/core';
import { OpenAIAdapter } from '@openagent/llm-openai';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

// Create LLM adapter
const llm = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4-turbo-preview',
});

// Agent configuration
const config: AgentConfig = {
  id: 'chatbot',
  name: 'Chatbot',
  provider: 'openai',
  mode: 'react',
  systemPrompt: `You are a friendly AI assistant. 
You help users with their questions and provide helpful, accurate information.
Be concise but thorough in your responses.`,
  maxIterations: 5,
  temperature: 0.7,
};

// Create agent
const agent = new ReActAgent(config);

// Initialize
async function initialize() {
  await agent.initialize();
  console.log('Chatbot initialized successfully!\n');
  console.log('Type your message and press Enter to chat.');
  console.log('Type "exit" or "quit" to end the conversation.\n');
}

// Chat loop
async function chat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      const message = input.trim();
      
      // Exit commands
      if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
        console.log('\nGoodbye! 👋');
        rl.close();
        process.exit(0);
      }
      
      // Skip empty messages
      if (!message) {
        askQuestion();
        return;
      }
      
      try {
        console.log('\nBot: ');
        
        // Run agent
        const response = await agent.run(message);
        
        console.log(response.message);
        console.log('\n' + '-'.repeat(50) + '\n');
        
      } catch (error: any) {
        console.error('Error:', error.message);
        console.log('\n');
      }
      
      askQuestion();
    });
  };
  
  askQuestion();
}

// Main
async function main() {
  await initialize();
  await chat();
}

main().catch(console.error);
