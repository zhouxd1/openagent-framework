/**
 * HTTP Request Tool
 * 
 * Provides HTTP client capabilities with timeout control, error handling,
 * and automatic JSON parsing.
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

const logger = createLogger('HTTPTool');

/**
 * HTTP Request Tool Parameter Schema
 */
export const httpRequestSchema = z.object({
  url: z.string()
    .url('Invalid URL format')
    .describe('Request URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    .optional()
    .default('GET')
    .describe('HTTP method'),
  headers: z.record(z.string())
    .optional()
    .describe('Request headers'),
  body: z.any()
    .optional()
    .describe('Request body'),
  timeout: z.number()
    .int()
    .min(1000)
    .max(300000)
    .optional()
    .default(30000)
    .describe('Timeout in milliseconds'),
});

export type HTTPRequestParams = z.infer<typeof httpRequestSchema>;

/**
 * HTTP Response interface - needs to be JSON-serializable
 */
export interface HTTPResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  size: number;
  [key: string]: any; // Index signature for JSON serialization
}

/**
 * HTTP Request Tool Definition
 */
export const httpRequestToolDefinition: ToolDefinition = {
  name: 'http_request',
  description: 'Execute HTTP requests with timeout control and automatic JSON parsing',
  category: 'communication',
  parameters: {
    url: {
      type: 'string',
      description: 'Request URL (must be a valid URL)',
      required: true,
    },
    method: {
      type: 'string',
      description: 'HTTP method (GET, POST, PUT, DELETE, PATCH)',
      required: false,
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      default: 'GET',
    },
    headers: {
      type: 'object',
      description: 'Request headers as key-value pairs',
      required: false,
    },
    body: {
      type: 'object',
      description: 'Request body (for POST, PUT, PATCH)',
      required: false,
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds (1000-300000)',
      required: false,
      default: 30000,
    },
  },
};

/**
 * HTTP Request Tool handler
 */
export async function httpRequestHandler(
  parameters: Parameters,
  context?: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Validate parameters
    const validation = httpRequestSchema.safeParse(parameters);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      
      logger.warn('HTTP request validation failed', { 
        errors: errorMessage,
        context 
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const { url, method, headers, body, timeout } = validation.data;

    logger.info('Sending HTTP request', { 
      url, 
      method,
      hasBody: !!body,
      timeout,
      sessionId: context?.sessionId 
    });

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    };

    // Add body for methods that support it
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Make request
    const response = await fetch(url, requestOptions);
    
    clearTimeout(timeoutId);
    
    // Get response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Parse response
    const contentType = response.headers.get('content-type') || '';
    let data: any;
    let size = 0;

    if (contentType.includes('application/json')) {
      const text = await response.text();
      size = text.length;
      
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        logger.warn('Failed to parse JSON response', { 
          url,
          error: (parseError as Error).message
        });
        data = text;
      }
    } else {
      const text = await response.text();
      data = text;
      size = text.length;
    }

    const duration = Date.now() - startTime;

    logger.info('HTTP request completed', { 
      url, 
      method,
      status: response.status,
      size,
      duration
    });

    // Return result
    const result: HTTPResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      size,
    };

    // Determine success based on status code
    const isSuccess = response.status >= 200 && response.status < 300;

    return {
      success: isSuccess,
      data: result,
      metadata: {
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        size,
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    let errorMessage = 'Unknown error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle timeout
      if (error.name === 'AbortError') {
        errorMessage = `Request timeout after ${(parameters as any).timeout}ms`;
      } else if ((error as any).code === 'ENOENT') {
        errorMessage = 'DNS lookup failed - host not found';
        logger.warn('DNS lookup failed', { 
          url: (parameters as any).url,
          duration
        });
      } else if ((error as any).code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused';
        logger.warn('Connection refused', { 
          url: (parameters as any).url,
          duration
        });
      } else {
        logger.error('HTTP request failed', error, { 
          url: (parameters as any).url,
          duration
        });
      }
    }

    return {
      success: false,
      error: errorMessage,
      metadata: {
        duration,
      },
    };
  }
}
