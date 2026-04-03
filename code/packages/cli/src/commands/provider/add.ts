/**
 * Provider Add Command
 * 
 * Add a new LLM provider configuration
 */

import { Command, Args, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConfigManager, ProviderConfig } from '../../lib/config-manager';
import {
  getProviderTemplate,
  getProviderDisplayName,
  getProviderDescription,
  hasProviderTemplate,
  getSupportedProviders,
} from '../../lib/provider-templates';

export default class ProviderAdd extends Command {
  static description = 'Add a new LLM provider configuration';

  static examples = [
    '<%= config.bin %> provider add openai',
    '<%= config.bin %> provider add zhipu --api-key zhipu-xxx',
    '<%= config.bin %> provider add deepseek --api-key sk-xxx --base-url https://api.deepseek.com/v1',
    '<%= config.bin %> provider add custom --api-key xxx --base-url https://api.custom.com/v1',
  ];

  static args = {
    name: Args.string({
      description: 'Provider name (e.g., openai, zhipu, deepseek, ollama)',
      required: false,
    }),
  };

  static flags = {
    'api-key': Flags.string({
      description: 'API key for the provider',
      char: 'k',
    }),
    'base-url': Flags.string({
      description: 'API base URL',
      char: 'u',
    }),
    'default-model': Flags.string({
      description: 'Default model to use',
      char: 'm',
    }),
    'set-default': Flags.boolean({
      description: 'Set as default provider',
      char: 'd',
      default: false,
    }),
    'organization': Flags.string({
      description: 'Organization ID (for OpenAI)',
      char: 'o',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProviderAdd);
    
    let providerName: string | undefined = args.name;

    // If no provider name provided, prompt user to select or enter
    if (!providerName) {
      const supportedProviders = getSupportedProviders();
      
      const answers = await inquirer.prompt<{
        providerChoice: string;
      }>([
        {
          type: 'list',
          name: 'providerChoice',
          message: 'Select a provider or choose "custom" to enter manually:',
          choices: [
            ...supportedProviders.map(p => ({
              name: `${getProviderDisplayName(p)} - ${getProviderDescription(p)}`,
              value: p,
            })),
            { name: 'Custom provider (enter manually)', value: 'custom' },
          ],
        },
      ]);

      if (answers.providerChoice === 'custom') {
        const customAnswer = await inquirer.prompt<{
          customName: string;
        }>([
          {
            type: 'input',
            name: 'customName',
            message: 'Enter provider name:',
            validate: (input: string) => input.length > 0 || 'Provider name is required',
          },
        ]);
        providerName = customAnswer.customName;
      } else {
        providerName = answers.providerChoice;
      }
    }

    // Normalize provider name
    providerName = providerName!.toLowerCase();

    // Check if provider already exists
    if (await ConfigManager.hasProvider(providerName)) {
      const { overwrite } = await inquirer.prompt<{
        overwrite: boolean;
      }>([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Provider "${providerName}" already exists. Overwrite?`,
          default: false,
        },
      ]);

      if (!overwrite) {
        this.log(chalk.yellow('Operation cancelled.'));
        return;
      }
    }

    // Get template for the provider
    const template = getProviderTemplate(providerName) || {};

    // Display provider info
    this.log('');
    this.log(chalk.bold(`Configuring ${getProviderDisplayName(providerName)}`));
    if (hasProviderTemplate(providerName)) {
      this.log(chalk.gray(getProviderDescription(providerName)));
    }
    this.log('');

    // Get API key
    let apiKey: string | undefined = flags['api-key'];
    if (!apiKey) {
      const apiKeyAnswer = await inquirer.prompt<{
        apiKey: string;
      }>([
        {
          type: 'password',
          name: 'apiKey',
          message: `Enter API key for ${providerName}:`,
          mask: '*',
          validate: (input: string) => {
            if (!input || input.length === 0) {
              return 'API key is required';
            }
            return true;
          },
        },
      ]);
      apiKey = apiKeyAnswer.apiKey;
    }

    // Get base URL (use template default if available)
    let baseURL: string | undefined = flags['base-url'];
    if (!baseURL && template.baseURL) {
      const { useDefault } = await inquirer.prompt<{
        useDefault: boolean;
      }>([
        {
          type: 'confirm',
          name: 'useDefault',
          message: `Use default base URL? (${template.baseURL})`,
          default: true,
        },
      ]);

      if (!useDefault) {
        const urlAnswer = await inquirer.prompt<{
          baseURL: string;
        }>([
          {
            type: 'input',
            name: 'baseURL',
            message: 'Enter custom base URL:',
            validate: (input: string) => {
              if (!input) return 'Base URL is required';
              try {
                new URL(input);
                return true;
              } catch {
                return 'Invalid URL format';
              }
            },
          },
        ]);
        baseURL = urlAnswer.baseURL;
      } else {
        baseURL = template.baseURL;
      }
    } else if (!baseURL) {
      const urlAnswer = await inquirer.prompt<{
        baseURL: string;
      }>([
        {
          type: 'input',
          name: 'baseURL',
          message: 'Enter API base URL:',
          validate: (input: string) => {
            if (!input) return 'Base URL is required';
            try {
              new URL(input);
              return true;
            } catch {
              return 'Invalid URL format';
            }
          },
        },
      ]);
      baseURL = urlAnswer.baseURL;
    }

    // Get default model (use template default if available)
    let defaultModel: string | undefined = flags['default-model'];
    if (!defaultModel) {
      if (template.defaultModel) {
        const { useDefaultModel } = await inquirer.prompt<{
          useDefaultModel: boolean;
        }>([
          {
            type: 'confirm',
            name: 'useDefaultModel',
            message: `Use default model? (${template.defaultModel})`,
            default: true,
          },
        ]);

        if (!useDefaultModel) {
          const modelAnswer = await inquirer.prompt<{
            defaultModel: string;
          }>([
            {
              type: 'input',
              name: 'defaultModel',
              message: 'Enter default model name:',
            },
          ]);
          defaultModel = modelAnswer.defaultModel;
        } else {
          defaultModel = template.defaultModel;
        }
      } else {
        const modelAnswer = await inquirer.prompt<{
          defaultModel: string;
        }>([
          {
            type: 'input',
            name: 'defaultModel',
            message: 'Enter default model name (optional):',
          },
        ]);
        defaultModel = modelAnswer.defaultModel || undefined;
      }
    }

    // Build provider configuration
    const providerConfig: ProviderConfig = {
      apiKey: apiKey!,
      baseURL,
      defaultModel,
      organization: flags.organization,
      timeout: template.timeout,
      maxRetries: template.maxRetries,
    };

    // Remove undefined values
    Object.keys(providerConfig).forEach(key => {
      if (providerConfig[key as keyof ProviderConfig] === undefined) {
        delete providerConfig[key as keyof ProviderConfig];
      }
    });

    // Add provider to configuration
    await ConfigManager.addProvider(providerName, providerConfig);

    // Set as default if requested or if it's the first provider
    const config = await ConfigManager.load();
    const isFirstProvider = Object.keys(config.providers || {}).length === 1;
    
    if (flags['set-default'] || isFirstProvider) {
      await ConfigManager.setDefaultProvider(providerName);
      this.log(chalk.green(`✓ Provider "${providerName}" added and set as default`));
    } else {
      this.log(chalk.green(`✓ Provider "${providerName}" added`));
    }

    // Display configuration summary
    this.log('');
    this.log(chalk.bold('Configuration Summary:'));
    this.log(`  Provider: ${getProviderDisplayName(providerName)}`);
    this.log(`  Base URL: ${baseURL}`);
    this.log(`  Default Model: ${defaultModel || 'not set'}`);
    this.log(`  API Key: ***${apiKey!.slice(-4)}`);
    
    if (flags.organization) {
      this.log(`  Organization: ${flags.organization}`);
    }

    this.log('');
    this.log(chalk.gray('Test your configuration:'));
    this.log(chalk.cyan(`  ${this.config.bin} chat --provider ${providerName}`));
  }
}
