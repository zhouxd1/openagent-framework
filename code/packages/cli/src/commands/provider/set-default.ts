/**
 * Provider Set-Default Command
 * 
 * Set the default LLM provider
 */

import { Command, Args } from '@oclif/core';
import chalk from 'chalk';
import { ConfigManager } from '../../lib/config-manager';
import { getProviderDisplayName } from '../../lib/provider-templates';

export default class ProviderSetDefault extends Command {
  static description = 'Set the default LLM provider';

  static examples = [
    '<%= config.bin %> provider set-default openai',
    '<%= config.bin %> provider set-default zhipu',
  ];

  static args = {
    name: Args.string({
      description: 'Provider name',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ProviderSetDefault);

    try {
      const providerName = args.name.toLowerCase();
      const displayName = getProviderDisplayName(providerName);

      // Check if provider exists
      if (!(await ConfigManager.hasProvider(providerName))) {
        const providerNames = await ConfigManager.getProviderNames();
        
        this.error(
          `Provider "${providerName}" does not exist.\n\n` +
          `Available providers: ${providerNames.length > 0 ? providerNames.join(', ') : 'none'}\n\n` +
          `To add a new provider:\n` +
          `  ${this.config.bin} provider add ${providerName}`,
          { exit: 1 }
        );
      }

      // Set default provider
      await ConfigManager.setDefaultProvider(providerName);

      this.log('');
      this.log(chalk.green(`✓ Default provider set to ${displayName} (${providerName})`));
      this.log('');
      this.log(chalk.gray('All future commands will use this provider by default.'));
      this.log(chalk.gray('You can override with --provider flag:'));
      this.log(chalk.cyan(`  ${this.config.bin} chat --provider ${providerName}`));
      this.log('');

    } catch (error) {
      this.error(
        `Failed to set default provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
