/**
 * Type definitions for Claude (Anthropic) LLM adapter
 * 
 * @packageDocumentation
 */

import { AgentConfig, Metadata } from '@openagent/core';

/**
 * Supported Claude model versions
 */
export type ClaudeModel =
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | 'claude-3-5-sonnet-20241022';

/**
 * Claude configuration options
 */
export interface ClaudeConfig {
  /** Anthropic API key (required) */
  apiKey: string;
  /** Custom base URL for API requests (optional) */
  baseURL?: string;
  /** Default model to use (default: 'claude-3-5-sonnet-20241022') */
  model?: ClaudeModel | string;
  /** Maximum tokens in response (default: 4096) */
  maxTokens?: number;
  /** Temperature for response generation (default: 1, range: 0-1) */
  temperature?: number;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Maximum retry attempts on failure (default: 3) */
  maxRetries?: number;
}

/**
 * Claude Agent configuration
 * Extends AgentConfig with Claude-specific options
 */
export interface ClaudeAgentConfig extends Omit<AgentConfig, 'model' | 'provider'>, ClaudeConfig {
  // Force provider to be 'claude'
  provider?: 'claude';
  // Additional agent-specific config can be added here
  /** Enable automatic retries on rate limit errors */
  retryOnRateLimit?: boolean;
  /** Custom headers to include in API requests */
  customHeaders?: Record<string, string>;
}

/**
 * Claude message structure
 */
export interface ClaudeMessage {
  /** Message role (user or assistant only) */
  role: 'user' | 'assistant';
  /** Message content (can be string or content blocks) */
  content: string | ClaudeContentBlock[];
}

/**
 * Claude content block types
 */
export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ClaudeImageSource }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: string | ClaudeContentBlock[]; is_error?: boolean };

/**
 * Claude image source
 */
export interface ClaudeImageSource {
  type: 'base64' | 'url';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data?: string;  // for base64
  url?: string;   // for url type
}

/**
 * Claude tool definition
 */
export interface ClaudeTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema (JSON Schema format) */
  input_schema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
}

/**
 * Tool use from Claude
 */
export interface ClaudeToolUse {
  /** Unique identifier for this tool use */
  id: string;
  /** Type (always 'tool_use') */
  type: 'tool_use';
  /** Tool name */
  name: string;
  /** Tool input parameters */
  input: any;
}

/**
 * LLM request structure for Claude
 */
export interface LLMRequest {
  /** System prompt (Claude-specific) */
  system?: string;
  /** Conversation messages */
  messages: ClaudeMessage[];
  /** Model to use (optional) */
  model?: ClaudeModel | string;
  /** Maximum tokens (optional) */
  maxTokens?: number;
  /** Temperature (optional) */
  temperature?: number;
  /** Tools available for the LLM to call */
  tools?: ClaudeTool[];
  /** Stop sequences */
  stopSequences?: string[];
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * LLM response structure from Claude
 */
export interface LLMResponse {
  /** Response ID */
  id: string;
  /** Model used */
  model: string;
  /** Response content blocks */
  content: ClaudeContentBlock[];
  /** Text content (extracted from content blocks) */
  text?: string;
  /** Tool uses (if any) */
  toolUses?: ClaudeToolUse[];
  /** Token usage information */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Reason for stopping */
  stopReason: string;
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * LLM streaming chunk from Claude
 */
export interface LLMChunk {
  /** Response ID */
  id?: string;
  /** Model used */
  model?: string;
  /** Message delta */
  delta: {
    type: 'text_delta' | 'input_json_delta' | 'message_delta';
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  /** Content block index (for streaming) */
  index?: number;
  /** Content block type */
  contentBlockType?: 'text' | 'tool_use';
  /** Tool use delta (for streaming) */
  toolUse?: Partial<ClaudeToolUse>;
  /** Finish reason */
  finishReason?: string;
}

/**
 * Message structure for internal use (OpenAI-compatible)
 */
export interface Message {
  /** Message role */
  role: 'system' | 'user' | 'assistant';
  /** Message content */
  content: string;
  /** Tool uses (for assistant messages) */
  toolUses?: ClaudeToolUse[];
  /** Tool result (for tool response messages) */
  toolResult?: {
    toolUseId: string;
    content: string;
    isError?: boolean;
  };
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
  model: 'claude-3-5-sonnet-20241022' as ClaudeModel,
  maxTokens: 4096,
  temperature: 1,
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
