/**
 * Agent Type Definitions for OpenAgent Framework
 */

import { Metadata, JSONObject } from '../types';

/**
 * Supported LLM providers
 */
export type AgentProvider = 'openai' | 'claude' | 'deepseek' | 'anthropic' | 'gemini' | 'custom';

/**
 * Agent execution modes
 */
export type AgentMode = 'react' | 'function_calling' | 'hybrid';

/**
 * Agent execution context
 */
export interface AgentContext {
  sessionId?: string;
  userId?: string;
  conversationId?: string;
  parentMessageId?: string;
  metadata?: Metadata;
  timeout?: number;
  maxIterations?: number;
}

/**
 * Agent response structure
 */
export interface AgentResponse {
  success: boolean;
  message: string;
  data?: JSONObject;
  toolCalls?: ToolCallResult[];
  metadata?: AgentResponseMetadata;
  error?: string;
}

/**
 * Tool call result
 */
export interface ToolCallResult {
  toolName: string;
  parameters: JSONObject;
  result: JSONObject | null;
  success: boolean;
  error?: string;
  duration?: number;
}

/**
 * Agent response metadata
 */
export interface AgentResponseMetadata {
  provider: AgentProvider;
  model?: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration: number;
  iterations?: number;
  finishReason?: 'stop' | 'tool_call' | 'max_iterations' | 'error';
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: string;
  name: string;
  provider: AgentProvider;
  model?: string;
  mode?: AgentMode;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxIterations?: number;
  metadata?: Metadata;
}

/**
 * Agent state
 */
export interface AgentState {
  status: 'idle' | 'running' | 'paused' | 'error';
  currentIteration: number;
  lastActivity: Date;
  totalToolCalls: number;
  metadata?: Metadata;
}

/**
 * ReAct step structure
 */
export interface ReActStep {
  thought: string;
  action?: string;
  actionInput?: JSONObject;
  observation?: string;
}

/**
 * Message structure for agent conversations
 */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCallRequest[];
  metadata?: Metadata;
}

/**
 * Tool call request from LLM
 */
export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
