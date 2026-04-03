/**
 * @openagent/llm-deepseek
 * 
 * DeepSeek LLM adapter for OpenAgent Framework
 * 
 * This package provides seamless integration with DeepSeek's chat completion API
 * with full support for:
 * - Streaming responses
 * - Function Calling (tool execution)
 * - Error handling and retries
 * - Multi-turn conversations
 * - Long context (64K tokens)
 * - Code-specialized model (deepseek-coder)
 * 
 * DeepSeek API is fully compatible with OpenAI API format.
 * 
 * @packageDocumentation
 */

// Core classes
export { DeepSeekProvider } from './deepseek-provider';
export { DeepSeekAgent } from './deepseek-agent';

// Type exports
export {
  DeepSeekConfig,
  DeepSeekAgentConfig,
  DeepSeekModel,
  Message,
  ToolCall,
  LLMRequest,
  LLMResponse,
  LLMChunk,
  ToolDefinition,
  ParameterSchema,
  RetryConfig,
  DEFAULT_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEEPSEEK_MODELS,
} from './types';
