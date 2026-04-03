/**
 * Tool Exec Command
 * 
 * Execute a tool with given parameters.
 */

import { Command, Args, Flags } from '@oclif/core';
import { ToolExecutor } from '@openagent/core';

export default class ToolExec extends Command {
  static description = 'Execute a tool with given parameters';

  static examples = [
    '<%= config.bin %> tool exec calculator \'{"expression":"2+2"}\'',
    '<%= config.bin %> tool exec weather \'{"location":"Beijing"}\'',
    '<%= config.bin %> tool exec weather \'{"location":"Beijing","unit":"fahrenheit"}\' --json',
  ];

  static args = {
    name: Args.string({
      description: 'Tool name to execute',
      required: true,
    }),
    params: Args.string({
      description: 'JSON string of parameters',
      required: true,
    }),
  };

  static flags = {
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
    timeout: Flags.integer({
      char: 't',
      description: 'Execution timeout in milliseconds',
      default: 30000,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ToolExec);

    const toolExecutor = new ToolExecutor();

    try {
      // Parse parameters
      let parameters: any;
      try {
        parameters = JSON.parse(args.params);
      } catch {
        this.error('Invalid JSON in parameters');
        return;
      }

      this.log(`Executing tool: ${args.name}`);
      this.log(`Parameters: ${args.params}`);
      this.log('');

      const startTime = Date.now();
      const result = await toolExecutor.execute(
        args.name,
        parameters,
        {
          timeout: flags.timeout,
        }
      );
      const duration = Date.now() - startTime;

      if (flags.json) {
        this.log(JSON.stringify(result, null, 2));
      } else {
        if (result.success) {
          this.log('✓ Success');
          this.log('');
          this.log('Result:');
          this.log(JSON.stringify(result.data, null, 2));
          
          if (result.metadata) {
            this.log('');
            this.log('Metadata:');
            this.log(JSON.stringify(result.metadata, null, 2));
          }
        } else {
          this.log('✗ Failed');
          this.log('');
          this.log(`Error: ${result.error}`);
        }

        this.log('');
        this.log(`Duration: ${duration}ms`);
      }
    } catch (error) {
      this.error(`Failed to execute tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
