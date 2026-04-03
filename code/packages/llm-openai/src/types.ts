/**
 * Type definitions for OpenAI LLM adapter
 * 
 * @packageDocumentation
 */

import { AgentConfig, ToolParameter, Metadata } from '@openagent/core';

/**
 * OpenAI configuration options
 */
export interface OpenAIConfig {
  /** OpenAI API key (required) */
  apiKey: string;
  /** Custom base URL for API requests (optional, for proxies or Azure) */
  baseURL?: string;
  /** Default model to use (default: 'gpt-4') */
  model?: string;
  /** Temperature for response generation (default: 0.7) */
  temperature?: number;
  /** Maximum tokens in response (default: 2000) */
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Maximum retry attempts on failure (default: 3) */
  maxRetries?: number;
  /** Organization ID for OpenAI (optional) */
  organization?: string;
}

/**
 * OpenAI Agent configuration
 * Extends AgentConfig with OpenAI-specific options
 */
export interface OpenAIAgentConfig extends AgentConfig, OpenAIConfig {
  // Additional agent-specific config can be added here
  /** Enable automatic retries on rate limit errors */
  retryOnRateLimit?: boolean;
  /** Custom headers to include in API requests */
  customHeaders?: Record<string, string>;
}

/**
 * Message structure for OpenAI API
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
  model?: string;
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
  /** Response ID from OpenAI */
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
 * Tool definition for OpenAI Function Calling
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
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
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
