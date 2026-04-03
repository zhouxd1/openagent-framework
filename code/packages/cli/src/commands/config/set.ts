/**
 * Config Set Command
 * 
 * Set a configuration value.
 */

import { Command, Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import { ConfigManager } from '../../lib/config-manager';
import { OutputFormatter } from '../../lib/output';

export default class ConfigSet extends Command {
  static description = 'Set a configuration value';

  static examples = [
    '<%= config.bin %> config set defaultModel gpt-4-turbo',
    '<%= config.bin %> config set defaultProvider openai',
    '<%= config.bin %> config set apiKeys.openai sk-xxx',
    '<%= config.bin %> config set output.format json',
  ];

  static args = {
    key: Args.string({
      description: 'Configuration key (supports dot notation)',
      required: true,
    }),
    value: Args.string({
      description: 'Configuration value (will be parsed as JSON if valid)',
      required: true,
    }),
  };

  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Force overwrite without confirmation',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ConfigSet);

    try {
      // Parse value
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(args.value);
      } catch {
        // Treat as string if not valid JSON
        parsedValue = args.value;
      }

      // Get current value for confirmation
      const currentValue = await ConfigManager.get(args.key);
      
      // Confirm if value exists and not forced
      if (currentValue !== undefined && !flags.force) {
        this.log(`Current value: ${JSON.stringify(currentValue)}`);
        this.log(`New value: ${JSON.stringify(parsedValue)}`);
        // In non-interactive mode, we just proceed
      }

      // Set value
      await ConfigManager.set(args.key, parsedValue);

      // Show success message
      console.log(chalk.green('✓'), `Set ${chalk.cyan(args.key)} = ${JSON.stringify(parsedValue)}`);
      console.log(chalk.gray(`Config file: ${ConfigManager.getConfigPath()}`));

    } catch (error) {
      OutputFormatter.formatError(error as Error);
      this.exit(1);
    }
  }
}
