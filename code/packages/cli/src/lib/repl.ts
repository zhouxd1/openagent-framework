/**
 * REPL (Read-Eval-Print Loop) Implementation
 * 
 * Provides an interactive command-line interface for chatting with agents.
 */

import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { IAgent, AgentResponse, Tool } from '@openagent/core';
import { OutputFormatter } from './output';

/**
 * REPL options
 */
export interface REPLOptions {
  prompt?: string;
  exitCommands?: string[];
  showSpinner?: boolean;
  onToolCall?: (toolName: string, params: any) => void;
  onToolResult?: (result: any) => void;
}

/**
 * REPL class for interactive agent sessions
 */
export class REPL {
  private rl: readline.Interface;
  private isRunning: boolean = false;
  private history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private spinner: ReturnType<typeof ora> | null = null;

  constructor(
    private agent: IAgent,
    private options: REPLOptions = {}
  ) {
    this.options = {
      prompt: '> ',
      exitCommands: ['exit', 'quit', 'q', '.exit'],
      showSpinner: true,
      ...options,
    };
  }

  /**
   * Start the REPL session
   */
  async start(): Promise<void> {
    this.isRunning = true;

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.options.prompt!,
      historySize: 100,
      removeHistoryDuplicates: true,
    });

    // Handle line input
    this.rl.on('line', async (input) => {
      await this.handleInput(input.trim());
      if (this.isRunning) {
        this.rl.prompt();
      }
    });

    // Handle close
    this.rl.on('close', () => {
      this.stop();
    });

    // Start prompting
    this.rl.prompt();
  }

  /**
   * Stop the REPL session
   */
  stop(): void {
    this.isRunning = false;
    if (this.rl) {
      this.rl.close();
    }
    if (this.spinner) {
      this.spinner.stop();
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.history];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Handle user input
   */
  private async handleInput(input: string): Promise<void> {
    // Check for empty input
    if (!input) {
      return;
    }

    // Check for exit commands
    if (this.options.exitCommands!.includes(input.toLowerCase())) {
      OutputFormatter.sessionEnd();
      this.stop();
      return;
    }

    // Handle built-in commands
    if (await this.handleBuiltinCommand(input)) {
      return;
    }

    // Process with agent
    await this.processWithAgent(input);
  }

  /**
   * Handle built-in commands
   */
  private async handleBuiltinCommand(input: string): Promise<boolean> {
    const parts = input.split(/\s+/);
    const command = parts[0].toLowerCase();

    switch (command) {
      case 'help':
      case '?':
        OutputFormatter.helpMessage();
        return true;

      case 'clear':
      case 'cls':
        OutputFormatter.clear();
        return true;

      case 'history':
        this.showHistory();
        return true;

      case 'tools':
        await this.showTools();
        return true;

      case 'reset':
        this.clearHistory();
        OutputFormatter.success('对话历史已清除');
        return true;

      default:
        return false;
    }
  }

  /**
   * Process input with agent
   */
  private async processWithAgent(input: string): Promise<void> {
    // Start spinner
    if (this.options.showSpinner) {
      this.spinner = ora({
        text: '思考中...',
        spinner: 'dots',
      }).start();
    }

    try {
      // Run agent
      const response = await this.agent.run(input);

      // Stop spinner
      if (this.spinner) {
        this.spinner.stop();
        this.spinner = null;
      }

      // Save to history
      this.history.push({ role: 'user', content: input });
      this.history.push({ role: 'assistant', content: response.message });

      // Display response
      OutputFormatter.agentMessage(response.message);

      // Display metadata if available
      if (response.metadata) {
        this.displayMetadata(response);
      }
    } catch (error) {
      // Stop spinner on error
      if (this.spinner) {
        this.spinner.stop();
        this.spinner = null;
      }

      OutputFormatter.formatError(error as Error);
    }
  }

  /**
   * Display response metadata
   */
  private displayMetadata(response: AgentResponse): void {
    const metadata = response.metadata;
    if (!metadata) return;
    
    const parts: string[] = [];

    if (metadata.duration) {
      parts.push(`耗时: ${metadata.duration}ms`);
    }

    if (metadata.tokensUsed) {
      parts.push(`Token: ${metadata.tokensUsed.total}`);
    }

    if (parts.length > 0) {
      console.log(chalk.gray(`   ${parts.join(' | ')}`));
    }
  }

  /**
   * Show conversation history
   */
  private showHistory(): void {
    if (this.history.length === 0) {
      OutputFormatter.info('暂无对话历史');
      return;
    }

    console.log(chalk.bold('\n对话历史:\n'));
    this.history.forEach((msg) => {
      const prefix = msg.role === 'user' ? chalk.cyan('用户:') : chalk.green('Agent:');
      console.log(`${prefix} ${msg.content}`);
    });
    console.log();
  }

  /**
   * Show available tools
   */
  private async showTools(): Promise<void> {
    const tools = this.agent.getTools();
    
    if (tools.length === 0) {
      OutputFormatter.info('没有可用的工具');
      return;
    }

    const toolList = tools.map((tool: Tool) => ({
      name: tool.name,
      description: tool.description,
    }));

    OutputFormatter.toolsList(toolList);
  }
}

/**
 * Create and start a REPL session
 */
export async function startREPL(
  agent: IAgent,
  options?: REPLOptions
): Promise<REPL> {
  const repl = new REPL(agent, options);
  await repl.start();
  return repl;
}
