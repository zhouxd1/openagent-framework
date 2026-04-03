/**
 * Type definitions for DeepSeek LLM adapter
 * 
 * DeepSeek API is fully compatible with OpenAI API format
 * 
 * @packageDocumentation
 */

import { Metadata } from '@openagent/core';

/**
 * DeepSeek model types
 */
export type DeepSeekModel = 'deepseek-chat' | 'deepseek-coder';

/**
 * DeepSeek configuration options
 */
export interface DeepSeekConfig {
  /** DeepSeek API key (required) */
  apiKey: string;
  /** Base URL for DeepSeek API (default: 'https://api.deepseek.com/v1') */
  baseURL?: string;
  /** Default model to use (default: 'deepseek-chat') */
  model?: DeepSeekModel | string;
  /** Temperature for response generation (0-2, default: 1) */
  temperature?: number;
  /** Maximum tokens in response (default: 4096) */
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Maximum retry attempts on failure (default: 3) */
  maxRetries?: number;
}

/**
 * DeepSeek Agent configuration
 * Combines common agent config with DeepSeek-specific options
 */
export interface DeepSeekAgentConfig {
  // Agent identification
  /** Unique agent ID */
  id?: string;
  /** Agent name */
  name?: string;
  /** Provider type (should be 'deepseek') */
  provider?: 'deepseek';
  /** Agent description */
  description?: string;
  
  // DeepSeek-specific configuration
  /** DeepSeek API key (required) */
  apiKey: string;
  /** Base URL for DeepSeek API */
  baseURL?: string;
  /** Model to use */
  model?: DeepSeekModel | string;
  /** Temperature for response generation */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts on failure */
  maxRetries?: number;
  
  // Agent behavior
  /** System prompt for the agent */
  systemPrompt?: string;
  /** Agent mode */
  mode?: 'react' | 'function_calling' | 'hybrid';
  /** Maximum iterations for tool calling */
  maxIterations?: number;
  /** Additional metadata */
  metadata?: Metadata;
  
  // Additional options
  /** Enable automatic retries on rate limit errors */
  retryOnRateLimit?: boolean;
  /** Custom headers to include in API requests */
  customHeaders?: Record<string, string>;
}

/**
 * Message structure for DeepSeek API (OpenAI compatible)
 */
export interface Message {
  /** Message role */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Message content */
  content: string;
  /** Name of the author (for tool messages) */
  name?: string;
  /** Tool call ID (for tool response messages) */
  toolCallId?: string;
  /** Tool calls made by the assistant */
  toolCalls?: ToolCall[];
}

/**
 * Tool call from the LLM
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Type of tool call (always 'function' for now) */
  type: 'function';
  /** Function call details */
  function: {
    /** Name of the function to call */
    name: string;
    /** JSON-encoded arguments */
    arguments: string;
  };
}

/**
 * LLM request structure
 */
export interface LLMRequest {
  /** Conversation messages */
  messages: Message[];
  /** Model to use (optional, uses default if not specified) */
  model?: DeepSeekModel | string;
  /** Temperature (optional, uses default if not specified) */
  temperature?: number;
  /** Maximum tokens (optional, uses default if not specified) */
  maxTokens?: number;
  /** Tools available for the LLM to call */
  tools?: ToolDefinition[];
  /** Tool choice strategy */
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  /** Response format */
  responseFormat?: { type: 'text' | 'json_object' };
  /** Stop sequences */
  stop?: string[];
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * LLM response structure
 */
export interface LLMResponse {
  /** Response content */
  content: string;
  /** Tool calls made by the LLM */
  toolCalls?: ToolCall[];
  /** Token usage information */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Reason for finishing */
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | string;
  /** Response ID from DeepSeek */
  id?: string;
  /** Model used */
  model?: string;
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * LLM streaming chunk
 */
export interface LLMChunk {
  /** Content delta */
  delta: string;
  /** Tool calls delta (partial) */
  toolCalls?: Partial<ToolCall>[];
  /** Finish reason (only in final chunk) */
  finishReason?: string;
  /** Response ID */
  id?: string;
}

/**
 * Tool definition for DeepSeek Function Calling (OpenAI compatible)
 */
export interface ToolDefinition {
  /** Tool type (always 'function' for now) */
  type: 'function';
  /** Function definition */
  function: {
    /** Function name */
    name: string;
    /** Function description */
    description: string;
    /** Function parameters schema */
    parameters: {
      type: 'object';
      properties: Record<string, ParameterSchema>;
      required?: string[];
    };
  };
}

/**
 * JSON Schema for function parameters
 */
export interface ParameterSchema {
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  /** Parameter description */
  description?: string;
  /** Enum values (for strings) */
  enum?: string[];
  /** Default value */
  default?: string | number | boolean | null;
  /** Object properties (if type is 'object') */
  properties?: Record<string, ParameterSchema>;
  /** Array items schema (if type is 'array') */
  items?: ParameterSchema;
  /** Required properties (if type is 'object') */
  required?: string[];
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
}

/**
 * Default configuration values for DeepSeek
 */
export const DEFAULT_CONFIG = {
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat' as DeepSeekModel,
  temperature: 1,
  maxTokens: 4096,
  timeout: 60000,
  maxRetries: 3,
} as const;

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * DeepSeek model information
 */
export const DEEPSEEK_MODELS = {
  'deepseek-chat': {
    name: 'DeepSeek Chat',
    description: 'General-purpose conversational model',
    contextLength: 64000,
    supportsFunctionCalling: true,
  },
  'deepseek-coder': {
    name: 'DeepSeek Coder',
    description: 'Code-specialized model for programming tasks',
    contextLength: 64000,
    supportsFunctionCalling: true,
  },
} as const;
