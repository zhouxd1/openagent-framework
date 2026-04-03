/**
 * @openagent/llm-claude
 * 
 * Claude (Anthropic) adapter for OpenAgent Framework
 * 
 * This package provides seamless integration with Anthropic's Claude API
 * with full support for:
 * - Streaming responses
 * - Tool Use (function calling)
 * - Vision (multimodal)
 * - Long context (up to 200K tokens)
 * - Multi-turn conversations
 * 
 * @packageDocumentation
 */

// Core classes
export { ClaudeProvider } from './claude-provider';
export { ClaudeAgent } from './claude-agent';

// Type exports
export {
  ClaudeConfig,
  ClaudeAgentConfig,
  ClaudeModel,
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeImageSource,
  ClaudeTool,
  ClaudeToolUse,
  LLMRequest,
  LLMResponse,
  LLMChunk,
  Message,
  RetryConfig,
  DEFAULT_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from './types';

// Utility exports
export {
  convertOpenAIToClaudeMessages,
  convertOpenAIToClaudeTools,
  extractTextContent,
  extractToolUses,
  buildClaudeRequest,
  convertClaudeToolUsesToOpenAI,
  createToolResultMessage,
  mergeToolUseDelta,
  validateClaudeMessages,
  ensureStartsWithUser,
} from './utils';
