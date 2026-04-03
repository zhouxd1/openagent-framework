/**
 * Config Get Command
 * 
 * Get a configuration value.
 */

import { Command, Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import { ConfigManager } from '../../lib/config-manager';
import { OutputFormatter } from '../../lib/output';

export default class ConfigGet extends Command {
  static description = 'Get a configuration value';

  static examples = [
    '<%= config.bin %> config get',
    '<%= config.bin %> config get defaultModel',
    '<%= config.bin %> config get apiKeys.openai',
    '<%= config.bin %> config get --json',
  ];

  static args = {
    key: Args.string({
      description: 'Configuration key (supports dot notation)',
      required: false,
    }),
  };

  static flags = {
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ConfigGet);

    try {
      // Load configuration
      const config = await ConfigManager.load();

      // If no key specified, show all config
      if (!args.key) {
        if (flags.json) {
          OutputFormatter.formatJSON(config);
        } else {
          console.log(chalk.bold('\nConfiguration:\n'));
          console.log(JSON.stringify(config, null, 2));
          console.log(chalk.gray(`\nConfig file: ${ConfigManager.getConfigPath()}\n`));
        }
        return;
      }

      // Get specific value
      const value = await ConfigManager.get(args.key);

      if (value === undefined) {
        this.error(`Configuration key '${args.key}' not found`, { exit: 1 });
      }

      // Output value
      if (flags.json) {
        OutputFormatter.formatJSON({ key: args.key, value });
      } else {
        console.log(`${chalk.cyan(args.key)} = ${JSON.stringify(value)}`);
      }

    } catch (error) {
      OutputFormatter.formatError(error as Error);
      this.exit(1);
    }
  }
}
