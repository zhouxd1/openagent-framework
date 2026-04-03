/**
 * Shell Command Tool
 * 
 * Provides shell command execution with security restrictions
 * timeout control, and resource limits
 */

import { 
  ToolDefinition, 
  ToolExecutionResult,
  ToolExecutionContext,
  Parameters,
  OpenAgentError,
  ErrorCode,
  createLogger
} from '@openagent/core';
import { z } from 'zod';
import { execa } from 'execa';

const logger = createLogger('ShellTool');

/**
 * Shell Tool parameter schema
 */
export const shellExecSchema = z.object({
  command: z.string()
    .min(1, 'Command cannot be empty')
    .max(10000, 'Command too long (max 10000 characters)')
    .describe('Shell command to execute'),
  cwd: z.string()
    .optional()
    .describe('Working directory'),
  timeout: z.number()
    .int()
    .min(1000)
    .max(300000)
    .optional()
    .default(60000)
    .describe('Timeout in milliseconds'),
  env: z.record(z.string())
    .optional()
    .describe('Environment variables as key-value pairs'),
});

export type ShellExecParams = z.infer<typeof shellExecSchema>;

/**
 * Shell Execution Result Type
 */
export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  command: string;
  duration: number;
  [key: string]: any; // Index signature for JSON serialization
}

/**
 * Shell Command Tool Definition
 */
export const shellExecToolDefinition: ToolDefinition = {
  name: 'shell_exec',
  description: 'Execute shell commands with security restrictions and timeout control',
  category: 'action',
  parameters: {
    command: {
      type: 'string',
      description: 'Shell command to execute (max 10000 characters)',
      required: true,
    },
    cwd: {
      type: 'string',
      description: 'Working directory for command execution',
      required: false,
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds (1000-300000)',
      required: false,
      default: 60000,
    },
    env: {
      type: 'object',
      description: 'Environment variables as key-value pairs',
      required: false,
    },
  },
};

/**
 * Security patterns that are blacklisted
 */
const BLACKLISTED_PATTERNS = [
  { pattern: /rm\s+-rf\s+\//i, name: 'rm -rf /' },
  { pattern: /^sudo\s/i, name: 'sudo' },
  { pattern: /curl.*\|\s*bash/i, name: 'curl | bash' },
  { pattern: /curl.*\|\s*sh/i, name: 'curl | sh' },
  { pattern: /wget.*\|\s*bash/i, name: 'wget | bash' },
  { pattern: /wget.*\|\s*sh/i, name: 'wget | sh' },
  { pattern: /^chmod\s+777/i, name: 'chmod 777' },
  { pattern: /\/etc\/shadow/i, name: '/etc/shadow' },
  { pattern: /\/etc\/passwd/i, name: '/etc/passwd' },
  { pattern: />\s*\/dev\/sda/i, name: 'disk overwrite' },
  { pattern: /mkfs/i, name: 'mkfs' },
  { pattern: /dd\s+if=/i, name: 'dd command' },
];

/**
 * Validate command for security issues
 * @returns Error message if validation fails, null if valid
 */
function validateCommand(command: string): string | null {
  // Check for blacklisted patterns
  for (const { pattern, name } of BLACKLISTED_PATTERNS) {
    if (pattern.test(command)) {
      return `Command contains blacklisted pattern: ${name}`;
    }
  }

  return null;
}

/**
 * Shell Command Tool handler
 */
export async function shellExecHandler(
  parameters: Parameters,
  context?: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Validate parameters
    const validation = shellExecSchema.safeParse(parameters);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      
      logger.warn('Shell exec validation failed', { 
        errors: errorMessage,
        context 
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { command, cwd, timeout, env } = validation.data;

    // Security validation
    const securityError = validateCommand(command);
    if (securityError) {
      logger.warn('Shell command blocked by security', { 
        command: command.substring(0, 100),
        reason: securityError 
      });
      
      return {
        success: false,
        error: securityError,
        metadata: {
          command: command.substring(0, 100),
          duration: Date.now() - startTime,
        },
      };
    }

    logger.info('Executing shell command', { 
      command: command.substring(0, 100),
      cwd,
      timeout,
      sessionId: context?.sessionId 
    });

    // Execute command with timeout
    const result = await execa(command, [], {
      shell: true,
      cwd,
      timeout,
      env: { ...process.env, ...env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      reject: false, // Don't throw on non-zero exit code
    });

    const duration = Date.now() - startTime;
    const outputSize = result.stdout.length + result.stderr.length;

    logger.info('Shell command completed', { 
      command: command.substring(0, 100),
      exitCode: result.exitCode,
      outputSize,
      duration
    });

    // Build result
    const shellResult: ShellResult = {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 1,
      command: command,
      duration,
    };

    // Check exit code
    if (result.exitCode !== 0) {
      return {
        success: false,
        data: shellResult,
        error: result.stderr || `Command exited with non-zero exit code: ${result.exitCode}`,
        metadata: {
          command: command.substring(0, 100),
          exitCode: result.exitCode,
          outputSize,
          duration
        },
      };
    }

    return {
      success: true,
      data: shellResult,
      metadata: {
        command: command.substring(0, 100),
        exitCode: result.exitCode,
        outputSize,
        duration
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    let errorMessage = 'Unexpected error in shell exec';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle timeout - check for timeout signals
      if (error.message.includes('timed out') || error.message.includes('timeout') || (error as any).timedOut) {
        errorMessage = `Command timed out after ${timeout || 60000}ms`;
        logger.warn('Shell command timed out', { 
          command: command.substring(0, 100),
          duration
        });
      } else {
        logger.error('Shell command failed', error, { 
          command: command.substring(0, 100),
          duration
        });
      }
    }

    return {
      success: false,
      error: errorMessage,
      metadata: { 
        command: command.substring(0, 100),
        duration 
      },
    };
  }
}
