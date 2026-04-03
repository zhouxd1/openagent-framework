/**
 * Tool List Command
 * 
 * List all available tools.
 */

import { Command, Flags } from '@oclif/core';
import { ToolExecutor } from '@openagent/core';

export default class ToolList extends Command {
  static description = 'List all available tools';

  static examples = [
    '<%= config.bin %> tool list',
    '<%= config.bin %> tool list --json',
  ];

  static flags = {
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ToolList);

    const toolExecutor = new ToolExecutor();

    try {
      const tools = await toolExecutor.getTools();

      if (flags.json) {
        this.log(JSON.stringify(tools, null, 2));
      } else {
        this.log('Available Tools:');
        this.log('');

        if (tools.length === 0) {
          this.log('  No tools registered');
        } else {
          tools.forEach((tool, index) => {
            this.log(`${index + 1}. ${tool.name}`);
            this.log(`   Category: ${tool.category}`);
            this.log(`   Description: ${tool.description}`);
            this.log(`   Enabled: ${tool.enabled !== false ? 'Yes' : 'No'}`);
            
            if (tool.parameters && Object.keys(tool.parameters).length > 0) {
              this.log('   Parameters:');
              Object.entries(tool.parameters).forEach(([key, param]) => {
                const required = param.required ? ' (required)' : '';
                this.log(`     - ${key}: ${param.type}${required}`);
                if (param.description) {
                  this.log(`       ${param.description}`);
                }
              });
            }
            this.log('');
          });
        }

        this.log(`Total: ${tools.length} tool(s)`);
      }
    } catch (error) {
      this.error(`Failed to list tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
