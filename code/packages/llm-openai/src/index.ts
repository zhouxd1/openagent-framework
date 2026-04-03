/**
 * @openagent/llm-openai
 * 
 * OpenAI LLM adapter for OpenAgent Framework
 * 
 * This package provides seamless integration with OpenAI's chat completion API
 * with full support for:
 * - Streaming responses
 * - Function Calling (tool execution)
 * - Error handling and retries
 * - Multi-turn conversations
 * 
 * @packageDocumentation
 */

// Core classes
export { OpenAIProvider } from './openai-provider';
export { OpenAIAgent } from './openai-agent';

// Type exports
export {
  OpenAIConfig,
  OpenAIAgentConfig,
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
} from './types';
