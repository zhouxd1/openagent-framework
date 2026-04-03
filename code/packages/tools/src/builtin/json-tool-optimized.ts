/**
 * JSON Parsing Tools - Optimized with Worker Pool Support
 * 
 * Provides JSON parsing and stringification with worker thread support
 * for improved performance on CPU-intensive operations.
 */

import { 
  ToolDefinition, 
  ToolExecutionResult, 
  ToolExecutionContext,
  Parameters,
  createLogger,
  getWorkerPool,
} from '@openagent/core';
import { z } from 'zod';
import { JSONPath } from 'jsonpath-plus';

const logger = createLogger('JSONTools');

/**
 * Performance threshold for using worker threads (in ms)
 * Operations expected to take longer than this will use workers
 */
const WORKER_THRESHOLD_MS = 50;

/**
 * Size threshold for using worker threads (in bytes)
 * JSON data larger than this will use workers
 */
const WORKER_SIZE_THRESHOLD = 100 * 1024; // 100KB

/**
 * JSON Parse Tool Parameter Schema
 */
export const jsonParseSchema = z.object({
  text: z.string()
    .min(1, 'JSON text cannot be empty')
    .max(10 * 1024 * 1024, 'JSON text too large (max 10MB)')
    .describe('JSON string to parse'),
  path: z.string()
    .optional()
    .describe('JSONPath expression to extract data (optional)'),
  useWorker: z.boolean()
    .optional()
    .default(true)
    .describe('Use worker thread for large JSON (auto-detected if not specified)'),
});

export type JSONParseParams = z.infer<typeof jsonParseSchema>;

/**
 * JSON Parse Tool Definition
 */
export const jsonParseToolDefinition: ToolDefinition = {
  name: 'json_parse',
  description: 'Parse JSON strings into JavaScript objects with optional JSONPath extraction. Automatically uses worker threads for large JSON for better performance.',
  category: 'data',
  parameters: {
    text: {
      type: 'string',
      description: 'JSON string to parse',
      required: true,
    },
    path: {
      type: 'string',
      description: 'JSONPath expression to extract specific data (optional)',
      required: false,
    },
    useWorker: {
      type: 'boolean',
      description: 'Use worker thread for large JSON (auto-detected if not specified)',
      required: false,
      default: true,
    },
  },
};

/**
 * Basic JSONPath syntax validation
 */
function isValidJSONPath(path: string): boolean {
  if (!path.startsWith('$')) {
    return false;
  }
  
  let bracketCount = 0;
  for (const char of path) {
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
    if (bracketCount < 0) return false;
  }
  if (bracketCount !== 0) return false;
  
  return true;
}

/**
 * Parse JSON directly (synchronous)
 */
function parseJsonDirect(text: string, jsonPath?: string): { success: boolean; data?: any; error?: string } {
  try {
    let data = JSON.parse(text);
    
    if (jsonPath) {
      if (!isValidJSONPath(jsonPath)) {
        return { success: false, error: `Invalid JSONPath syntax: ${jsonPath}` };
      }
      
      const results = JSONPath({ path: jsonPath, json: data });
      const finalData = Array.isArray(results) && results.length === 1
        ? results[0]
        : results;
      
      return { success: true, data: finalData };
    }
    
    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Invalid JSON: ${(error as Error).message}` };
  }
}

/**
 * JSON Parse Tool Handler - Optimized with Worker Pool
 */
export async function jsonParseHandler(
  parameters: Parameters,
  context?: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Validate parameters
    const validation = jsonParseSchema.safeParse(parameters);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      
      logger.warn('JSON parse validation failed', { errors: errorMessage });
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { text, path: jsonPath, useWorker } = validation.data;
    
    // Decide whether to use worker thread
    const shouldUseWorker = useWorker !== false && 
      (text.length > WORKER_SIZE_THRESHOLD || (jsonPath && text.length > 10 * 1024));
    
    logger.info('Parsing JSON', { 
      textSize: text.length,
      hasPath: !!jsonPath,
      useWorker: shouldUseWorker,
      sessionId: context?.sessionId 
    });

    let result: { success: boolean; data?: any; error?: string };
    let workerId: number | undefined;
    
    if (shouldUseWorker) {
      try {
        // Use worker pool for large JSON
        const workerPool = getWorkerPool();
        const workerResult = await workerPool.execute('json-parse', {
          text,
          path: jsonPath,
        });
        
        result = { success: true, data: workerResult };
        
        const stats = workerPool.getStats();
        workerId = stats.activeWorkers;
        
        logger.debug('JSON parsed in worker', {
          textSize: text.length,
          workerStats: stats,
        });
      } catch (workerError) {
        // Fallback to direct parsing if worker fails
        logger.warn('Worker parse failed, falling back to direct', {
          error: (workerError as Error).message,
        });
        result = parseJsonDirect(text, jsonPath);
      }
    } else {
      // Parse directly for small JSON
      result = parseJsonDirect(text, jsonPath);
    }

    const duration = Date.now() - startTime;
    
    if (!result.success) {
      logger.warn('JSON parse failed', { 
        error: result.error,
        textSize: text.length,
        duration 
      });
      
      return {
        success: false,
        error: result.error!,
        metadata: {
          textSize: text.length,
          duration,
          useWorker: shouldUseWorker,
        },
      };
    }
    
    const dataStr = JSON.stringify(result.data);
    
    logger.info('JSON parse successful', { 
      dataSize: dataStr.length,
      duration,
      useWorker: shouldUseWorker,
    });

    return {
      success: true,
      data: result.data,
      metadata: {
        textSize: text.length,
        dataSize: dataStr.length,
        duration,
        useWorker: shouldUseWorker,
        workerId,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Unexpected error in JSON parse', error as Error, { duration });
    
    return {
      success: false,
      error: 'Unexpected error occurred',
      metadata: { duration },
    };
  }
}

/**
 * JSON Stringify Tool Parameter Schema
 */
export const jsonStringifySchema = z.object({
  data: z.any()
    .describe('Data to serialize to JSON'),
  pretty: z.boolean()
    .optional()
    .default(true)
    .describe('Pretty print with indentation'),
  indent: z.number()
    .int()
    .min(0)
    .max(10)
    .optional()
    .default(2)
    .describe('Indentation size (default: 2)'),
  useWorker: z.boolean()
    .optional()
    .default(true)
    .describe('Use worker thread for large objects (auto-detected)'),
});

export type JSONStringifyParams = z.infer<typeof jsonStringifySchema>;

/**
 * JSON Stringify Tool Definition
 */
export const jsonStringifyToolDefinition: ToolDefinition = {
  name: 'json_stringify',
  description: 'Serialize JavaScript objects to JSON strings with formatting. Automatically uses worker threads for large objects.',
  category: 'data',
  parameters: {
    data: {
      type: 'object',
      description: 'Data to serialize to JSON',
      required: true,
    },
    pretty: {
      type: 'boolean',
      description: 'Pretty print with indentation',
      required: false,
      default: true,
    },
    indent: {
      type: 'number',
      description: 'Indentation size (default: 2, max: 10)',
      required: false,
      default: 2,
    },
    useWorker: {
      type: 'boolean',
      description: 'Use worker thread for large objects (auto-detected)',
      required: false,
      default: true,
    },
  },
};

/**
 * Circular reference detector
 */
function hasCircularReference(obj: any, seen = new WeakSet()): boolean {
  if (obj && typeof obj === 'object') {
    if (seen.has(obj)) {
      return true;
    }
    seen.add(obj);
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && hasCircularReference(obj[key], seen)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Safe stringify with circular reference handling
 */
function safeStringify(obj: any, indent?: number): string {
  const seen = new WeakSet();
  
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  }, indent);
}

/**
 * JSON Stringify Tool Handler - Optimized
 */
export async function jsonStringifyHandler(
  parameters: Parameters,
  context?: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Validate parameters
    const validation = jsonStringifySchema.safeParse(parameters);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      
      logger.warn('JSON stringify validation failed', { errors: errorMessage });
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { data, pretty, indent, useWorker } = validation.data;

    logger.info('Stringifying JSON', { 
      pretty,
      indent,
      sessionId: context?.sessionId 
    });

    // Check for circular references
    const hasCircular = hasCircularReference(data);
    
    if (hasCircular) {
      logger.warn('Circular reference detected in data');
    }

    // Decide whether to use worker thread
    const estimatedSize = hasCircular ? 10000 : JSON.stringify(data).length;
    const shouldUseWorker = useWorker !== false && 
      estimatedSize > WORKER_SIZE_THRESHOLD;
    
    const indentValue = pretty ? indent : undefined;
    let result: string;
    let workerId: number | undefined;
    
    try {
      if (shouldUseWorker && !hasCircular) {
        // Use worker pool for large objects
        const workerPool = getWorkerPool();
        result = await workerPool.execute('json-stringify', {
          obj: data,
          pretty,
          indent,
        });
        
        const stats = workerPool.getStats();
        workerId = stats.activeWorkers;
        
        logger.debug('JSON stringify in worker', {
          estimatedSize,
          workerStats: stats,
        });
      } else {
        // Stringify directly
        if (hasCircular) {
          result = safeStringify(data, indentValue);
        } else {
          result = JSON.stringify(data, null, indentValue);
        }
      }
    } catch (stringifyError) {
      const duration = Date.now() - startTime;
      
      logger.error('JSON stringify failed', stringifyError as Error, { duration });
      
      return {
        success: false,
        error: `Failed to stringify: ${(stringifyError as Error).message}`,
        metadata: {
          hasCircular,
          duration,
        },
      };
    }

    const duration = Date.now() - startTime;
    
    logger.info('JSON stringify successful', { 
      size: result.length,
      hasCircular,
      pretty,
      useWorker: shouldUseWorker,
      duration 
    });

    return {
      success: true,
      data: result,
      metadata: {
        size: result.length,
        hasCircular,
        pretty,
        indent,
        duration,
        useWorker: shouldUseWorker,
        workerId,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Unexpected error in JSON stringify', error as Error, { duration });
    
    return {
      success: false,
      error: 'Unexpected error occurred',
      metadata: { duration },
    };
  }
}
