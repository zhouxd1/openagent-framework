/**
 * Utility functions for Claude adapter
 * 
 * @packageDocumentation
 */

import { LLMToolDefinition, JSONObject } from '@openagent/core';
import {
  ClaudeMessage,
  ClaudeTool,
  ClaudeToolUse,
  ClaudeContentBlock,
  Message,
  LLMRequest,
} from './types';

/**
 * Convert OpenAI-style messages to Claude format
 * 
 * @param messages - OpenAI-style messages
 * @returns Claude-formatted messages and system prompt
 */
export function convertOpenAIToClaudeMessages(
  messages: Message[]
): { system?: string; messages: ClaudeMessage[] } {
  let system: string | undefined;
  const claudeMessages: ClaudeMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Claude uses separate system parameter
      system = system ? `${system}\n\n${msg.content}` : msg.content;
      continue;
    }

    // Handle assistant messages with tool uses
    if (msg.role === 'assistant' && msg.toolUses && msg.toolUses.length > 0) {
      const content: ClaudeContentBlock[] = [];
      
      // Add text content if present
      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }
      
      // Add tool uses
      for (const toolUse of msg.toolUses) {
        content.push({
          type: 'tool_use',
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
        });
      }
      
      claudeMessages.push({
        role: 'assistant',
        content,
      });
      continue;
    }

    // Handle tool result messages
    if (msg.role === 'assistant' && msg.toolResult) {
      // Tool results should be in a user message in Claude
      const lastUserMsg = claudeMessages.find(
        (m, idx) => m.role === 'user' && idx === claudeMessages.length - 1
      );
      
      const toolResultBlock: ClaudeContentBlock = {
        type: 'tool_result',
        tool_use_id: msg.toolResult.toolUseId,
        content: msg.toolResult.content,
        is_error: msg.toolResult.isError,
      };
      
      if (lastUserMsg && typeof lastUserMsg.content !== 'string') {
        // Append to existing user message
        lastUserMsg.content.push(toolResultBlock);
      } else {
        // Create new user message with tool result
        claudeMessages.push({
          role: 'user',
          content: [toolResultBlock],
        });
      }
      continue;
    }

    // Regular user or assistant message
    claudeMessages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  return { system, messages: claudeMessages };
}

/**
 * Convert OpenAI tool definitions to Claude format
 * 
 * @param tools - OpenAI-style tool definitions
 * @returns Claude-formatted tools
 */
export function convertOpenAIToClaudeTools(
  tools: LLMToolDefinition[]
): ClaudeTool[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: {
      type: 'object' as const,
      properties: (tool.function.parameters as any)?.properties || {},
      required: (tool.function.parameters as any)?.required,
    },
  }));
}

/**
 * Extract text content from Claude response content blocks
 * 
 * @param content - Claude content blocks
 * @returns Combined text content
 */
export function extractTextContent(
  content: ClaudeContentBlock[]
): string {
  return content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/**
 * Extract tool uses from Claude response content blocks
 * 
 * @param content - Claude content blocks
 * @returns Array of tool uses
 */
export function extractToolUses(
  content: ClaudeContentBlock[]
): ClaudeToolUse[] {
  return content
    .filter((block): block is ClaudeToolUse => block.type === 'tool_use')
    .map((block) => ({
      id: block.id,
      type: 'tool_use' as const,
      name: block.name,
      input: block.input,
    }));
}

/**
 * Build a complete LLM request for Claude
 * 
 * @param messages - Internal messages
 * @param tools - Tool definitions
 * @param options - Additional options
 * @returns Claude LLM request
 */
export function buildClaudeRequest(
  messages: Message[],
  tools?: LLMToolDefinition[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
  }
): LLMRequest {
  const { system, messages: claudeMessages } = convertOpenAIToClaudeMessages(messages);
  
  const request: LLMRequest = {
    messages: claudeMessages,
    system,
    model: options?.model as any,
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
    stopSequences: options?.stopSequences,
  };

  if (tools && tools.length > 0) {
    request.tools = convertOpenAIToClaudeTools(tools);
  }

  return request;
}

/**
 * Convert Claude tool uses to OpenAI-compatible format for execution
 * 
 * @param toolUses - Claude tool uses
 * @returns OpenAI-compatible tool calls
 */
export function convertClaudeToolUsesToOpenAI(toolUses: ClaudeToolUse[]): any[] {
  return toolUses.map((toolUse) => ({
    id: toolUse.id,
    type: 'function' as const,
    function: {
      name: toolUse.name,
      arguments: JSON.stringify(toolUse.input),
    },
  }));
}

/**
 * Create tool result message for Claude
 * 
 * @param toolUseId - Tool use ID
 * @param content - Tool result content
 * @param isError - Whether the result is an error
 * @returns Claude-formatted tool result
 */
export function createToolResultMessage(
  toolUseId: string,
  content: string,
  isError: boolean = false
): ClaudeMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content,
        is_error: isError,
      },
    ],
  };
}

/**
 * Merge streaming tool use deltas into complete tool uses
 * 
 * @param toolUses - Map of partial tool uses by index
 * @param delta - Tool use delta from streaming
 * @param index - Content block index
 */
export function mergeToolUseDelta(
  toolUses: Map<number, Partial<ClaudeToolUse>>,
  delta: Partial<ClaudeToolUse>,
  index: number
): void {
  if (!toolUses.has(index)) {
    toolUses.set(index, {
      id: '',
      type: 'tool_use',
      name: '',
      input: {},
    });
  }

  const current = toolUses.get(index)!;
  
  if (delta.id) {
    current.id = delta.id;
  }
  
  if (delta.name) {
    current.name = delta.name;
  }
  
  if (delta.input) {
    // For streaming JSON, we need to accumulate the partial JSON
    // This is handled separately in the provider
    current.input = delta.input;
  }
}

/**
 * Validate Claude message format
 * 
 * @param messages - Messages to validate
 * @returns True if valid, throws error otherwise
 */
export function validateClaudeMessages(messages: ClaudeMessage[]): boolean {
  if (messages.length === 0) {
    throw new Error('Messages array cannot be empty');
  }

  // First message must be from user
  if (messages[0].role !== 'user') {
    throw new Error('First message must be from user');
  }

  // Messages must alternate between user and assistant
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === messages[i - 1].role) {
      throw new Error(
        `Messages must alternate between user and assistant. Consecutive ${messages[i].role} messages found at index ${i - 1} and ${i}`
      );
    }
  }

  return true;
}

/**
 * Ensure messages start with a user message
 * 
 * @param messages - Messages to check/fix
 * @returns Messages that start with user
 */
export function ensureStartsWithUser(messages: ClaudeMessage[]): ClaudeMessage[] {
  if (messages.length === 0 || messages[0].role !== 'user') {
    // Add a placeholder user message
    return [
      { role: 'user', content: 'Please continue.' },
      ...messages,
    ];
  }
  return messages;
}

/**
 * Sleep for specified milliseconds
 * 
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
