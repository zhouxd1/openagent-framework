/**
 * Config List Command
 * 
 * List all configuration values.
 */

import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { ConfigManager } from '../../lib/config-manager';
import { OutputFormatter } from '../../lib/output';

export default class ConfigList extends Command {
  static description = 'List all configuration values';

  static examples = [
    '<%= config.bin %> config list',
    '<%= config.bin %> config list --json',
  ];

  static flags = {
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ConfigList);

    try {
      // Load configuration
      const config = await ConfigManager.load();

      if (flags.json) {
        OutputFormatter.formatJSON(config);
      } else {
        console.log(chalk.bold('\nConfiguration:\n'));
        this.printConfig(config, '');
        console.log(chalk.gray(`\nConfig file: ${ConfigManager.getConfigPath()}\n`));
      }

    } catch (error) {
      OutputFormatter.formatError(error as Error);
      this.exit(1);
    }
  }

  /**
   * Print configuration with indentation
   */
  private printConfig(obj: any, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        console.log(chalk.cyan(fullKey) + ':');
        this.printConfig(value, fullKey);
      } else {
        console.log(`  ${chalk.cyan(fullKey.padEnd(25))} ${JSON.stringify(value)}`);
      }
    }
  }
}
