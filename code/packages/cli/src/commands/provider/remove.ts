/**
 * Provider Remove Command
 * 
 * Remove an LLM provider configuration
 */

import { Command, Args, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConfigManager } from '../../lib/config-manager';
import { getProviderDisplayName } from '../../lib/provider-templates';

export default class ProviderRemove extends Command {
  static description = 'Remove an LLM provider configuration';

  static examples = [
    '<%= config.bin %> provider remove openai',
    '<%= config.bin %> provider rm zhipu',
  ];

  static aliases = ['rm', 'delete'];

  static args = {
    name: Args.string({
      description: 'Provider name',
      required: false,
    }),
  };

  static flags = {
    force: Flags.boolean({
      description: 'Skip confirmation prompt',
      char: 'f',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ProviderRemove);

    try {
      let providerName = args.name;

      // If no provider name provided, show selection list
      if (!providerName) {
        const providerNames = await ConfigManager.getProviderNames();

        if (providerNames.length === 0) {
          this.log(chalk.yellow('No providers configured.'));
          return;
        }

        const answers = await inquirer.prompt<{
          provider: string;
        }>([
          {
            type: 'list',
            name: 'provider',
            message: 'Select provider to remove:',
            choices: providerNames.map(p => ({
              name: `${getProviderDisplayName(p)} (${p})`,
              value: p,
            })),
          },
        ]);

        providerName = answers.provider;
      }

      providerName = providerName!.toLowerCase();
      const displayName = getProviderDisplayName(providerName);

      // Check if provider exists
      if (!(await ConfigManager.hasProvider(providerName))) {
        this.error(`Provider "${providerName}" does not exist.`, { exit: 1 });
      }

      // Confirm deletion
      if (!flags.force) {
        const { confirm } = await inquirer.prompt<{
          confirm: boolean;
        }>([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Remove provider "${displayName}" (${providerName})?`,
            default: false,
          },
        ]);

        if (!confirm) {
          this.log(chalk.yellow('Operation cancelled.'));
          return;
        }
      }

      // Remove provider
      await ConfigManager.removeProvider(providerName);

      this.log('');
      this.log(chalk.green(`✓ Provider "${displayName}" (${providerName}) removed`));
      this.log('');

      // Show updated provider list
      const remainingProviders = await ConfigManager.getProviderNames();
      if (remainingProviders.length === 0) {
        this.log(chalk.yellow('No providers configured.'));
        this.log('');
        this.log('To add a provider:');
        this.log(chalk.cyan(`  ${this.config.bin} provider add <name>`));
      } else {
        this.log(chalk.gray('Remaining providers:'));
        remainingProviders.forEach(p => {
          this.log(chalk.gray(`  - ${getProviderDisplayName(p)} (${p})`));
        });
      }

    } catch (error) {
      this.error(
        `Failed to remove provider: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
