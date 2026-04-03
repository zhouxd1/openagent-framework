/**
 * Claude Agent Implementation for OpenAgent Framework
 * 
 * Implements the BaseAgent for Claude (Anthropic) with support for:
 * - Multi-turn conversations
 * - Tool use (function calling)
 * - Vision (multimodal)
 * - Streaming responses
 * 
 * @packageDocumentation
 */

import { BaseAgent, Tool, AgentContext, AgentResponse } from '@openagent/core';
import { Logger, createLogger } from '@openagent/core';
import { ClaudeProvider } from './claude-provider';
import {
  ClaudeAgentConfig,
  ClaudeModel,
  ClaudeMessage,
  ClaudeTool,
  ClaudeContentBlock,
  DEFAULT_CONFIG,
} from './types';
import {
  ensureStartsWithUser,
} from './utils';

const logger = createLogger('ClaudeAgent');

/**
 * Claude Agent - Anthropic Claude implementation
 * 
 * Provides a high-level agent interface for Claude with automatic
 * tool calling, conversation management, and error handling.
 * 
 * @example
 * ```typescript
 * const agent = new ClaudeAgent({
 *   id: 'my-agent',
 *   name: 'Claude Assistant',
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 *   model: 'claude-3-opus-20240229',
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 * 
 * const response = await agent.run('Hello!');
 * ```
 */
export class ClaudeAgent extends BaseAgent {
  readonly id: string;
  readonly name: string;
  readonly provider = 'claude' as const;

  private claudeProvider: ClaudeProvider;
  private agentConfig: ClaudeAgentConfig;
  private conversationHistory: ClaudeMessage[];

  /**
   * Create a new Claude agent instance
   * 
   * @param config - Claude agent configuration
   */
  constructor(config: ClaudeAgentConfig) {
    super({
      id: config.id,
      name: config.name,
      provider: 'claude',
      systemPrompt: config.systemPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      maxIterations: config.maxIterations,
    });
    
    this.id = config.id;
    this.name = config.name;
    this.agentConfig = config;
    
    // Initialize Claude provider
    this.claudeProvider = new ClaudeProvider({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model || DEFAULT_CONFIG.model,
      maxTokens: config.maxTokens || DEFAULT_CONFIG.maxTokens,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      timeout: config.timeout || DEFAULT_CONFIG.timeout,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    });

    this.conversationHistory = [];

    this.logger.info('Claude agent created', {
      id: this.id,
      name: this.name,
      model: this.agentConfig.model,
    });
  }

  /**
   * Execute the agent with input
   * 
   * @param input - User input
   * @param context - Execution context
   * @returns Agent response
   */
  async run(input: string, context?: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();

    this.logger.debug('Starting agent execution', {
      input: input.substring(0, 100),
      sessionId: context?.sessionId,
    });

    try {
      this.updateState({ status: 'running', currentIteration: 0 });

      // Add user message to conversation
      const userMessage: ClaudeMessage = {
        role: 'user',
        content: input,
      };
      this.conversationHistory.push(userMessage);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt();

      // Convert tools if any
      const tools = this.getTools();
      const claudeTools: ClaudeTool[] | undefined = tools.length > 0
        ? tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: {
              type: 'object' as const,
              properties: t.parameters as Record<string, any>,
              required: Object.keys(t.parameters).filter(
                k => t.parameters[k].required
              ),
            },
          }))
        : undefined;

      // Ensure messages start with user
      let messages = ensureStartsWithUser(this.conversationHistory);

      // Make request with tools if available
      const response = await this.claudeProvider.executeWithTools(
        {
          messages,
          system: systemPrompt,
          tools: claudeTools,
          model: this.agentConfig.model as ClaudeModel,
          maxTokens: this.agentConfig.maxTokens,
          temperature: this.agentConfig.temperature,
        },
        async (toolUse) => {
          // Execute tool
          const result = await this.executeTool(
            toolUse.name,
            toolUse.input,
            context
          );

          if (result.success) {
            return JSON.stringify(result.data);
          } else {
            throw new Error(result.error || 'Tool execution failed');
          }
        },
        context?.maxIterations || this.agentConfig.maxIterations || 5
      );

      const duration = Date.now() - startTime;
      this.updateState({ status: 'idle', lastActivity: new Date() });

      // Extract text content
      const textContent = response.text || '';

      this.logger.info('Agent execution completed', {
        duration,
        tokensUsed: response.usage,
      });

      return {
        success: true,
        message: textContent,
        metadata: {
          provider: this.provider,
          model: response.model,
          tokensUsed: response.usage
            ? {
                prompt: response.usage.inputTokens,
                completion: response.usage.outputTokens,
                total: response.usage.inputTokens + response.usage.outputTokens,
              }
            : undefined,
          duration,
          finishReason: response.stopReason === 'tool_use' ? 'tool_call' : 'stop',
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateState({ status: 'error', lastActivity: new Date() });

      this.logger.error('Agent execution failed', error instanceof Error ? error : new Error(String(error)), {
        duration,
      });

      return this.createErrorResponse(error as Error, {
        provider: this.provider,
        duration,
      });
    }
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversationHistory = [];
    this.logger.debug('Conversation history cleared');
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ClaudeMessage[] {
    return [...this.conversationHistory];
  }
  
  /**
   * Set conversation history
   */
  setConversationHistory(messages: ClaudeMessage[]): void {
    this.conversationHistory = messages;
    this.logger.debug('Conversation history set', { messageCount: messages.length });
  }
  
  /**
   * Add message to conversation history
   */
  addToConversation(message: ClaudeMessage): void {
    this.conversationHistory.push(message);
  }
  
  /**
   * Stream agent execution
   * 
   * @param input - User input
   * @param context - Execution context
   * @yields Response chunks
   */
  async *stream(
    input: string,
    context?: AgentContext
  ): AsyncGenerator<string> {
    this.logger.debug('Starting streaming agent execution');
    try {
      this.updateState({ status: 'running' });
      
      // Add user message
      const userMessage: ClaudeMessage = {
        role: 'user',
        content: input,
      };
      const messages = ensureStartsWithUser([...this.conversationHistory, userMessage]);
      
      // Build system prompt
      const systemPrompt = this.buildSystemPrompt();
      
      // Convert tools if any
      const tools = this.getTools();
      const claudeTools: ClaudeTool[] | undefined = tools.length > 0
        ? tools.map(t => ({
            name: t.name,
            description: t.description,
            input_schema: {
              type: 'object' as const,
              properties: t.parameters as Record<string, any>,
              required: Object.keys(t.parameters).filter(
                k => t.parameters[k].required
              )
            },
          }))
        : undefined;

      // Stream response
      for await (const chunk of this.claudeProvider.stream({
        messages,
        system: systemPrompt,
        tools: claudeTools,
        model: this.agentConfig.model as ClaudeModel,
        maxTokens: this.agentConfig.maxTokens,
        temperature: this.agentConfig.temperature,
      })) {
        if (chunk.delta.type === 'text_delta' && chunk.delta.text) {
          yield chunk.delta.text;
        }
      }
      this.updateState({ status: 'idle' });
    } catch (error) {
      this.updateState({ status: 'error' });
      throw error;
    }
  }

  /**
   * Execute agent with vision (multimodal)
   * 
   * @param input - User input
   * @param imageData - Base64 encoded image data
   * @param mediaType - Image media type
   * @param context - Execution context
   * @returns Agent response
   */
  async runWithVision(
    input: string,
    imageData: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
    context?: AgentContext
  ): Promise<AgentResponse> {
    this.logger.debug('Starting vision agent execution');
    try {
      this.updateState({ status: 'running' });
      
      // Create multimodal message
      const userMessage: ClaudeMessage = {
        role: 'user',
        content: [
          { type: 'text', text: input },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageData,
            },
          },
        ],
      };
      
      // Build system prompt
      const systemPrompt = this.buildSystemPrompt();
      
      // Make request
      const response = await this.claudeProvider.complete({
        messages: [userMessage],
        system: systemPrompt,
        model: this.agentConfig.model as ClaudeModel,
        maxTokens: this.agentConfig.maxTokens,
        temperature: this.agentConfig.temperature,
      });
      
      this.updateState({ status: 'idle' });
      
      const textContent = response.text || '';
      return {
        success: true,
        message: textContent,
        metadata: {
          provider: this.provider,
          model: response.model,
          tokensUsed: response.usage
            ? {
                prompt: response.usage.inputTokens,
                completion: response.usage.outputTokens,
                total: response.usage.inputTokens + response.usage.outputTokens,
              }
            : undefined,
          duration: 0,
          finishReason: response.stopReason === 'tool_use' ? 'tool_call' : 'stop',
        },
      };
    } catch (error) {
      this.updateState({ status: 'error' });
      return this.createErrorResponse(error as Error);
    }
  }
}
