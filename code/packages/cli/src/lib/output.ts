/**
 * Output Formatter
 * 
 * Provides formatted output for CLI with:
 * - Markdown rendering
 * - Colored output
 * - Tool call feedback
 * - Error formatting
 */

import chalk from 'chalk';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Configure marked to use terminal renderer
marked.setOptions({
  renderer: new TerminalRenderer({
    code: chalk.cyan,
    blockquote: chalk.gray.italic,
    table: chalk.gray,
    strong: chalk.bold,
    em: chalk.italic,
    heading: chalk.green.bold,
    firstHeading: chalk.green.bold,
    showSectionPrefix: false,
  } as any),
});

/**
 * Output Formatter class
 */
export class OutputFormatter {
  /**
   * Format and print markdown text
   */
  static formatMarkdown(text: string): void {
    console.log(marked(text) as string);
  }

  /**
   * Format tool call information
   */
  static formatToolCall(toolName: string, params: any): void {
    console.log(chalk.yellow('🔧 执行工具:'), chalk.bold(toolName));
    if (params && Object.keys(params).length > 0) {
      console.log(chalk.gray('   参数:'), JSON.stringify(params, null, 2));
    }
  }

  /**
   * Format tool execution result
   */
  static formatToolResult(result: any, success: boolean = true): void {
    if (success) {
      console.log(chalk.green('✓ 结果:'), this.formatResultValue(result));
    } else {
      console.log(chalk.red('✗ 失败:'), result);
    }
  }

  /**
   * Format error message
   */
  static formatError(error: Error | string, showStack: boolean = false): void {
    const message = error instanceof Error ? error.message : error;
    console.error(chalk.red('✗ 错误:'), message);
    
    if (showStack && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
  }

  /**
   * Format info message
   */
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Format success message
   */
  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  /**
   * Format warning message
   */
  static warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Format agent message
   */
  static agentMessage(message: string): void {
    console.log(chalk.blue.bold('\n🤖 Agent:'));
    this.formatMarkdown(message);
    console.log(); // Add blank line
  }

  /**
   * Format user message
   */
  static userMessage(message: string): void {
    console.log(chalk.gray(`\n> ${message}\n`));
  }

  /**
   * Format session start
   */
  static sessionStart(model: string, provider: string): void {
    console.log(chalk.green.bold('\n🚀 OpenAgent Chat'));
    console.log(chalk.gray(`   模型: ${model} | 提供商: ${provider}`));
    console.log(chalk.gray('   输入 "exit" 退出, "help" 查看帮助\n'));
  }

  /**
   * Format session end
   */
  static sessionEnd(): void {
    console.log(chalk.gray('\n👋 再见！感谢使用 OpenAgent\n'));
  }

  /**
   * Format help message
   */
  static helpMessage(): void {
    console.log(chalk.bold('\n可用命令:'));
    console.log(chalk.gray('  exit    - 退出对话'));
    console.log(chalk.gray('  help    - 显示帮助'));
    console.log(chalk.gray('  clear   - 清屏'));
    console.log(chalk.gray('  history - 显示对话历史'));
    console.log(chalk.gray('  tools   - 显示可用工具\n'));
  }

  /**
   * Format available tools list
   */
  static toolsList(tools: Array<{ name: string; description: string }>): void {
    console.log(chalk.bold('\n可用工具:'));
    tools.forEach((tool) => {
      console.log(`  ${chalk.cyan(tool.name.padEnd(20))} ${chalk.gray(tool.description)}`);
    });
    console.log();
  }

  /**
   * Format JSON output
   */
  static formatJSON(data: any): void {
    console.log(JSON.stringify(data, null, 2));
  }

  /**
   * Format table
   */
  static formatTable(headers: string[], rows: any[][]): void {
    // Calculate column widths
    const widths = headers.map((header, i) => {
      const columnValues = rows.map(row => String(row[i] || ''));
      return Math.max(header.length, ...columnValues.map(v => v.length)) + 2;
    });

    // Print header
    const headerRow = headers.map((h, i) => chalk.bold(h.padEnd(widths[i])));
    console.log(headerRow.join(''));

    // Print separator
    const separator = widths.map(w => chalk.gray('─'.repeat(w)));
    console.log(separator.join(''));

    // Print rows
    rows.forEach(row => {
      const formattedRow = row.map((cell, i) => 
        String(cell || '').padEnd(widths[i])
      );
      console.log(formattedRow.join(''));
    });
  }

  /**
   * Format result value based on type
   */
  private static formatResultValue(result: any): string {
    if (typeof result === 'string') {
      return result;
    }
    
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }
    
    return String(result);
  }

  /**
   * Clear console
   */
  static clear(): void {
    console.clear();
  }
}
