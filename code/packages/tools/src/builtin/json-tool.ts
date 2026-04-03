/**
 * JSON Parsing Tools
 * 
 * Provides JSON parsing and stringification with error handling,
 * JSONPath support, and circular reference detection.
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
import { JSONPath } from 'jsonpath-plus';

const logger = createLogger('JSONTools');

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
});

export type JSONParseParams = z.infer<typeof jsonParseSchema>;

/**
 * JSON Parse Tool Definition
 */
export const jsonParseToolDefinition: ToolDefinition = {
  name: 'json_parse',
  description: 'Parse JSON strings into JavaScript objects with optional JSONPath extraction',
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
  },
};

/**
 * Basic JSONPath syntax validation
 */
function isValidJSONPath(path: string): boolean {
  // Must start with $ for root
  if (!path.startsWith('$')) {
    return false;
  }
  
  // Check for common invalid patterns
  // Double dots are invalid (except in .. which is descendant operator)
  if (path.match(/[^.]\.\.[^.]/) || path.match(/\.\.\.\./)) {
    return false;
  }
  
  // Check for unbalanced brackets
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
 * JSON Parse Tool Handler
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
      
      logger.warn('JSON parse validation failed', { 
        errors: errorMessage,
        context 
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { text, path: jsonPath } = validation.data;

    logger.info('Parsing JSON', { 
      textSize: text.length,
      hasPath: !!jsonPath,
      sessionId: context?.sessionId 
    });

    // Parse JSON
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      const duration = Date.now() - startTime;
      
      logger.warn('JSON parse failed', { 
        error: (parseError as Error).message,
        textSize: text.length,
        duration 
      });
      
      return {
        success: false,
        error: `Invalid JSON: ${(parseError as Error).message}`,
        metadata: {
          textSize: text.length,
          duration,
        },
      };
    }

    // Apply JSONPath if provided
    if (jsonPath) {
      // Validate JSONPath syntax
      if (!isValidJSONPath(jsonPath)) {
        const duration = Date.now() - startTime;
        
        logger.warn('Invalid JSONPath syntax', { 
          path: jsonPath,
          duration 
        });
        
        return {
          success: false,
          error: `Invalid JSONPath syntax: ${jsonPath}`,
          metadata: {
            path: jsonPath,
            duration,
          },
        };
      }
      
      try {
        const results = JSONPath({
          path: jsonPath,
          json: data,
        });
        
        const duration = Date.now() - startTime;
        
        // Unwrap single-element arrays for cleaner API
        const finalData = Array.isArray(results) && results.length === 1
          ? results[0]
          : results;
        
        logger.info('JSONPath extraction successful', { 
          path: jsonPath,
          resultCount: Array.isArray(results) ? results.length : 1,
          duration 
        });
        
        return {
          success: true,
          data: finalData,
          metadata: {
            path: jsonPath,
            resultCount: Array.isArray(results) ? results.length : 1,
            duration,
          },
        };
      } catch (pathError) {
        const duration = Date.now() - startTime;
        
        logger.warn('JSONPath extraction failed', { 
          path: jsonPath,
          error: (pathError as Error).message,
          duration 
        });
        
        return {
          success: false,
          error: `Invalid JSONPath expression: ${(pathError as Error).message}`,
          metadata: {
            path: jsonPath,
            duration,
          },
        };
      }
    }

    const duration = Date.now() - startTime;
    
    // Warn if data is large
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 1024 * 1024) {
      logger.warn('Large parsed JSON', { 
        size: dataStr.length,
        duration 
      });
    }
    
    logger.info('JSON parse successful', { 
      dataSize: dataStr.length,
      duration 
    });

    return {
      success: true,
      data,
      metadata: {
        textSize: text.length,
        dataSize: dataStr.length,
        duration,
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
});

export type JSONStringifyParams = z.infer<typeof jsonStringifySchema>;

/**
 * JSON Stringify Tool Definition
 */
export const jsonStringifyToolDefinition: ToolDefinition = {
  name: 'json_stringify',
  description: 'Serialize JavaScript objects to JSON strings with formatting',
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
 * JSON Stringify Tool Handler
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
      
      logger.warn('JSON stringify validation failed', { 
        errors: errorMessage,
        context 
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { data, pretty, indent } = validation.data;

    logger.info('Stringifying JSON', { 
      pretty,
      indent,
      sessionId: context?.sessionId 
    });

    // Check for circular references
    const hasCircular = hasCircularReference(data);
    
    if (hasCircular) {
      logger.warn('Circular reference detected in data', { 
        pretty,
        indent 
      });
    }

    // Stringify
    const indentValue = pretty ? indent : undefined;
    let result: string;
    
    try {
      if (hasCircular) {
        result = safeStringify(data, indentValue);
      } else {
        result = JSON.stringify(data, null, indentValue);
      }
    } catch (stringifyError) {
      const duration = Date.now() - startTime;
      
      logger.error('JSON stringify failed', stringifyError as Error, { 
        duration 
      });
      
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
    
    // Warn if result is large
    if (result.length > 1024 * 1024) {
      logger.warn('Large JSON string result', { 
        size: result.length,
        duration 
      });
    }
    
    logger.info('JSON stringify successful', { 
      size: result.length,
      hasCircular,
      pretty,
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
