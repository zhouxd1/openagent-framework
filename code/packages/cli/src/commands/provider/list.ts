/**
 * Provider List Command
 * 
 * List all configured LLM providers
 */

import { Command } from '@oclif/core';
import chalk from 'chalk';
import { ConfigManager } from '../../lib/config-manager';
import { getProviderDisplayName } from '../../lib/provider-templates';

export default class ProviderList extends Command {
  static description = 'List all configured LLM providers';

  static examples = [
    '<%= config.bin %> provider list',
    '<%= config.bin %> provider ls',
  ];

  // Allow shorthand alias
  static aliases = ['ls'];

  async run(): Promise<void> {
    try {
      const config = await ConfigManager.load();
      const providers = config.providers || {};
      const providerNames = Object.keys(providers);

      // Check if any providers are configured
      if (providerNames.length === 0) {
        this.log('');
        this.log(chalk.yellow('No providers configured.'));
        this.log('');
        this.log('To add a provider, use:');
        this.log(chalk.cyan(`  ${this.config.bin} provider add <name>`));
        this.log('');
        this.log('Examples:');
        this.log(chalk.gray(`  ${this.config.bin} provider add openai`));
        this.log(chalk.gray(`  ${this.config.bin} provider add zhipu --api-key your-key`));
        this.log('');
        return;
      }

      // Display providers
      this.log('');
      this.log(chalk.bold('Configured Providers:'));
      this.log('');

      for (const name of providerNames) {
        const provider = providers[name];
        const isDefault = config.defaultProvider === name;
        const displayName = getProviderDisplayName(name);

        // Provider header
        const marker = isDefault ? chalk.green(' ✓ (default)') : '';
        this.log(`  ${chalk.bold.cyan(displayName)} (${name})${marker}`);

        // Provider details
        if (provider.baseURL) {
          this.log(`    ${chalk.gray('Base URL:')} ${provider.baseURL}`);
        } else {
          this.log(`    ${chalk.gray('Base URL:')} ${chalk.gray('not set')}`);
        }

        if (provider.defaultModel) {
          this.log(`    ${chalk.gray('Model:')} ${provider.defaultModel}`);
        } else {
          this.log(`    ${chalk.gray('Model:')} ${chalk.gray('not set')}`);
        }

        if (provider.apiKey) {
          const maskedKey = `***${provider.apiKey.slice(-4)}`;
          this.log(`    ${chalk.gray('API Key:')} ${maskedKey}`);
        } else {
          this.log(`    ${chalk.gray('API Key:')} ${chalk.gray('not set')}`);
        }

        if (provider.organization) {
          this.log(`    ${chalk.gray('Organization:')} ${provider.organization}`);
        }

        if (provider.timeout) {
          this.log(`    ${chalk.gray('Timeout:')} ${provider.timeout}ms`);
        }

        if (provider.maxRetries) {
          this.log(`    ${chalk.gray('Max Retries:')} ${provider.maxRetries}`);
        }

        this.log('');
      }

      // Display config file location
      this.log(chalk.gray('Configuration file: ' + ConfigManager.getConfigPath()));
      this.log('');

      // Show usage hints
      this.log(chalk.gray('Usage:'));
      this.log(chalk.gray(`  ${this.config.bin} chat --provider <name>`));
      this.log(chalk.gray(`  ${this.config.bin} run "task" --provider <name>`));
      this.log('');

      if (providerNames.length > 1) {
        this.log(chalk.gray('To change default provider:'));
        this.log(chalk.cyan(`  ${this.config.bin} provider set-default <name>`));
        this.log('');
      }

    } catch (error) {
      this.error(
        `Failed to list providers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
