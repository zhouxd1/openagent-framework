/**
 * File Operation Tools
 * 
 * Provides file read and write capabilities with comprehensive error handling,
 * security checks, and logging.
 */

import { 
  ToolDefinition, 
  ToolExecutionResult, 
  ToolExecutionContext,
  Parameters,
  OpenAgentError,
  ErrorCode,
  createLogger,
} from '@openagent/core';
import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';

const logger = createLogger('FileTools');

/**
 * File Read Tool Parameter Schema
 */
export const fileReadSchema = z.object({
  path: z.string()
    .min(1, 'File path cannot be empty')
    .describe('File path to read'),
  encoding: z.enum(['utf-8', 'utf8', 'ascii', 'base64'])
    .optional()
    .default('utf-8')
    .describe('Character encoding'),
});

export type FileReadParams = z.infer<typeof fileReadSchema>;

/**
 * File Read Tool Definition
 */
export const fileReadToolDefinition: ToolDefinition = {
  name: 'file_read',
  description: 'Read file content from the filesystem',
  category: 'data',
  parameters: {
    path: {
      type: 'string',
      description: 'Absolute or relative path to the file',
      required: true,
    },
    encoding: {
      type: 'string',
      description: 'Character encoding (utf-8, utf8, ascii, base64)',
      required: false,
      enum: ['utf-8', 'utf8', 'ascii', 'base64'],
      default: 'utf-8',
    },
  },
};

/**
 * Security check for file path - returns error message or null if valid
 */
function validateFilePath(filePath: string): string | null {
  // Prevent directory traversal attacks
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.includes('..')) {
    return 'Directory traversal detected in file path';
  }
  
  // Prevent access to sensitive files (basic check)
  const sensitivePatterns = [
    { pattern: /^\/etc\/passwd/i, name: '/etc/passwd' },
    { pattern: /^\/etc\/shadow/i, name: '/etc/shadow' },
    { pattern: /\.env$/i, name: '.env file' },
    { pattern: /\.pem$/i, name: '.pem file' },
    { pattern: /\.key$/i, name: '.key file' },
    { pattern: /id_rsa/i, name: 'SSH private key' },
  ];
  
  for (const { pattern, name } of sensitivePatterns) {
    if (pattern.test(normalizedPath)) {
    return `Access to sensitive files (${name}) is not allowed`;
    }
  }
  
  return null;
}

/**
 * File Read Tool Handler
 */
export async function fileReadHandler(
  parameters: Parameters,
  context?: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Validate parameters
    const validation = fileReadSchema.safeParse(parameters);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
    
    logger.warn('File read validation failed', { 
      errors: errorMessage,
      context 
    });
    
    return {
      success: false,
      error: errorMessage,
    };
  }

    const { path: filePath, encoding } = validation.data;

    // Security check
    const securityError = validateFilePath(filePath);
    if (securityError) {
      logger.warn('File write blocked by security', { 
        path: filePath,
        reason: securityError 
      });
      
      return {
        success: false,
        error: securityError,
        metadata: {
          path: filePath,
          duration: Date.now() - startTime,
        },
      };
    }

    logger.info('Reading file', { 
      path: filePath, 
      encoding,
      sessionId: context?.sessionId 
    });

    // Read file
    const content = await fs.readFile(filePath, encoding);
    
    const duration = Date.now() - startTime;
    
    logger.info('File read successful', { 
      path: filePath, 
      size: content.length,
      duration 
    });

    return {
      success: true,
      data: content,
      metadata: {
        path: filePath,
        encoding,
        size: content.length,
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof Error) {
      // Handle specific file system errors
    const nodeError = error as NodeJS.ErrnoException;
    
    let message = error.message;
    
    if (nodeError.code === 'ENOENT') {
      message = `File not found: ${parameters.path}`;
    } else if (nodeError.code === 'EACCES') {
      message = `Permission denied: ${parameters.path}`;
    } else if (nodeError.code === 'EISDIR') {
      message = `Path is a directory, not a file: ${parameters.path}`;
    }
    
    logger.error('File read failed', error, { 
      path: (parameters as any).path,
      duration,
      errorCode: nodeError.code 
    });
    
    return {
      success: false,
      error: message,
      metadata: {
        duration,
        errorCode: nodeError.code,
      },
    };
  }
    
    logger.error('Unexpected error in file read', error as Error, { duration });
    
    return {
      success: false,
      error: 'Unexpected error occurred',
      metadata: { duration },
    };
  }
}

/**
 * File Write Tool Parameter Schema
 */
export const fileWriteSchema = z.object({
  path: z.string()
    .min(1, 'File path cannot be empty')
    .describe('File path to write'),
  content: z.string()
    .min(0, 'Content cannot be null')
    .describe('Content to write to the file'),
  encoding: z.enum(['utf-8', 'utf8', 'ascii', 'base64'])
    .optional()
    .default('utf-8')
    .describe('Character encoding'),
  mode: z.enum(['overwrite', 'append'])
    .optional()
    .default('overwrite')
    .describe('Write mode: overwrite or append'),
});

export type FileWriteParams = z.infer<typeof fileWriteSchema>;

/**
 * File Write Tool Definition
 */
export const fileWriteToolDefinition: ToolDefinition = {
  name: 'file_write',
  description: 'Write content to a file on the filesystem',
  category: 'action',
  parameters: {
    path: {
      type: 'string',
      description: 'Absolute or relative path to the file',
      required: true,
    },
    content: {
      type: 'string',
      description: 'Content to write to the file',
      required: true,
    },
    encoding: {
      type: 'string',
      description: 'Character encoding (utf-8, utf8, ascii, base64)',
      required: false,
      enum: ['utf-8', 'utf8', 'ascii', 'base64'],
      default: 'utf-8',
    },
    mode: {
      type: 'string',
      description: 'Write mode (overwrite or append)',
      required: false,
      enum: ['overwrite', 'append'],
      default: 'overwrite',
    },
  },
};

/**
 * File Write Tool Handler
 */
export async function fileWriteHandler(
  parameters: Parameters,
  context?: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Validate parameters
    const validation = fileWriteSchema.safeParse(parameters);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
    
      logger.warn('File write validation failed', { 
        errors: errorMessage,
        context 
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { path: filePath, content, encoding, mode } = validation.data;

    // Security check
    const securityError = validateFilePath(filePath);
    if (securityError) {
      logger.warn('File write blocked by security', { 
        path: filePath,
        reason: securityError 
      });
      
      return {
        success: false,
        error: securityError,
        metadata: {
          path: filePath,
          duration: Date.now() - startTime,
        },
      };
    }

    logger.info('Writing file', { 
      path: filePath, 
      encoding,
      mode,
      size: content.length,
      sessionId: context?.sessionId 
    });
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    if (mode === 'append') {
      await fs.appendFile(filePath, content, encoding);
    } else {
      await fs.writeFile(filePath, content, encoding);
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('File write successful', { 
      path: filePath, 
      size: content.length,
      mode,
      duration 
    });

    return {
      success: true,
      data: {
        path: filePath,
        bytesWritten: content.length,
        mode,
      },
      metadata: {
        path: filePath,
        size: content.length,  // 添加 size 字段
        bytesWritten: content.length,
        mode,
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof Error) {
    const nodeError = error as NodeJS.ErrnoException;
    
    let message = error.message;
    
    if (nodeError.code === 'EACCES') {
      message = `Permission denied: ${parameters.path}`;
    } else if (nodeError.code === 'ENOSPC') {
      message = 'No space left on device';
    } else if (nodeError.code === 'EROFS') {
      message = 'Read-only file system';
    }
    
    logger.error('File write failed', error, { 
      path: (parameters as any).path,
      duration,
      errorCode: nodeError.code 
    });
    
    return {
      success: false,
      error: message,
      metadata: {
        duration,
        errorCode: nodeError.code,
      },
    };
  }
    
    logger.error('Unexpected error in file write', error as Error, { duration });
    
    return {
      success: false,
      error: 'Unexpected error occurred',
      metadata: { duration },
    };
  }
}
