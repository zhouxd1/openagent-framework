/**
 * Chat Command
 * 
 * Start an interactive chat session with an AI agent.
 * Supports multiple LLM providers.
 */

import { Command, Flags } from '@oclif/core';
import { OpenAIAgent } from '@openagent/llm-openai';
import { registerBuiltinTools } from '@openagent/tools';
import { ConfigManager } from '../lib/config-manager';
import { OutputFormatter } from '../lib/output';
import { startREPL } from '../lib/repl';
import { generateId } from '@openagent/core';
import { getProviderDisplayName } from '../lib/provider-templates';
import chalk from 'chalk';

export default class Chat extends Command {
  static description = 'Start an interactive chat session with an AI agent';

  static examples = [
    '<%= config.bin %> chat',
    '<%= config.bin %> chat --provider zhipu',
    '<%= config.bin %> chat --provider openai --model gpt-4-turbo',
    '<%= config.bin %> chat -p deepseek -m deepseek-chat',
  ];

  static flags = {
    provider: Flags.string({
      char: 'p',
      description: 'LLM provider (e.g., openai, zhipu, deepseek)',
    }),
    model: Flags.string({
      char: 'm',
      description: 'LLM model to use (overrides provider default)',
    }),
    'api-key': Flags.string({
      description: 'API key for the provider (overrides config)',
      char: 'k',
    }),
    'base-url': Flags.string({
      description: 'API base URL (overrides config)',
      char: 'u',
    }),
    temperature: Flags.string({
      char: 't',
      description: 'Model temperature (0-1)',
      default: '0.7',
    }),
    debug: Flags.boolean({
      description: 'Enable debug mode',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Chat);

    try {
      // Load configuration
      const config = await ConfigManager.load();

      // Determine provider
      // Priority: flag > config.defaultProvider > 'openai'
      const providerName = flags.provider || config.defaultProvider || 'openai';
      const providerDisplayName = getProviderDisplayName(providerName);

      // Get provider configuration
      let providerConfig;
      try {
        providerConfig = await ConfigManager.getProvider(providerName);
      } catch (error) {
        this.error(
          `Provider "${providerName}" is not configured.\n\n` +
          `To add this provider:\n` +
          `  ${this.config.bin} provider add ${providerName}\n\n` +
          `Or list available providers:\n` +
          `  ${this.config.bin} provider list`,
          { exit: 1 }
        );
      }

      // Determine model
      // Priority: flag > provider default > config default > 'gpt-4'
      const model = flags.model || providerConfig.defaultModel || config.defaultModel || 'gpt-4';
      const temperature = parseFloat(flags.temperature) || 0.7;

      // Determine API key
      // Priority: flag > provider config > error
      const apiKey = flags['api-key'] || providerConfig.apiKey;

      if (!apiKey) {
        this.error(
          `No API key found for provider "${providerName}".\n\n` +
          `Please set it using:\n` +
          `  ${this.config.bin} provider add ${providerName} --api-key YOUR_API_KEY\n\n` +
          `Or set the environment variable: ${providerName.toUpperCase()}_API_KEY`,
          { exit: 1 }
        );
      }

      // Determine base URL
      // Priority: flag > provider config
      const baseURL = flags['base-url'] || providerConfig.baseURL;

      // Initialize agent
      this.log(chalk.gray('Initializing agent...'));
      
      const agentOptions: any = {
        id: `chat-${generateId()}`,
        name: 'OpenAgent CLI',
        provider: providerName,
        apiKey,
        model,
        temperature,
      };

      // Add baseURL if specified (for custom providers)
      if (baseURL) {
        agentOptions.baseURL = baseURL;
      }

      // Add organization if specified (for OpenAI)
      if (providerConfig.organization) {
        agentOptions.organization = providerConfig.organization;
      }

      const agent = new OpenAIAgent(agentOptions);

      // Register builtin tools
      registerBuiltinTools(agent as any);

      this.log(chalk.gray(`Agent ready with ${agent.getTools().length} tools`));
      this.log('');

      // Display session start message
      OutputFormatter.sessionStart(model, providerDisplayName);

      // Start REPL
      await startREPL(agent as any, {
        showSpinner: true,
      });

    } catch (error) {
      if (flags.debug) {
        OutputFormatter.formatError(error as Error, true);
      } else {
        OutputFormatter.formatError(error as Error);
      }
      this.exit(1);
    }
  }
}
