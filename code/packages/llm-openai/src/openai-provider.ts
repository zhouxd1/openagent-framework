/**
 * OpenAI LLM Provider Implementation
 * 
 * Implements the LLMProvider interface for OpenAI API with support for:
 * - Chat completions
 * - Streaming responses
 * - Function Calling
 * - Error handling and retries
 * 
 * @packageDocumentation
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { Logger, createLogger, OpenAgentError, ErrorCode, Validator } from '@openagent/core';
import { z } from 'zod';
import {
  OpenAIConfig,
  LLMRequest,
  LLMResponse,
  LLMChunk,
  ToolDefinition,
  ToolCall,
  Message,
  RetryConfig,
  DEFAULT_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from './types';

const logger = createLogger('OpenAIProvider');

/**
 * Configuration validation schema
 */
const configSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  baseURL: z.string().url().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  timeout: z.number().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
  organization: z.string().optional(),
});

/**
 * OpenAI LLM Provider
 * 
 * Provides integration with OpenAI's chat completion API with full support
 * for streaming, function calling, and error handling.
 * 
 * @example
 * ```typescript
 * const provider = new OpenAIProvider({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4',
 * });
 * 
 * const response = await provider.complete({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class OpenAIProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private config: Required<Pick<OpenAIConfig, 'apiKey' | 'model' | 'temperature' | 'maxTokens' | 'timeout' | 'maxRetries'>> & OpenAIConfig;
  private retryConfig: RetryConfig;

  /**
   * Create a new OpenAI provider instance
   * 
   * @param config - OpenAI configuration options
   * @throws OpenAgentError if configuration is invalid
   */
  constructor(config: OpenAIConfig) {
    // Validate configuration
    const validatedConfig = Validator.validate(configSchema, config, 'OpenAI provider configuration');

    // Merge with defaults
    this.config = {
      ...validatedConfig,
      model: validatedConfig.model || DEFAULT_CONFIG.model,
      temperature: validatedConfig.temperature ?? DEFAULT_CONFIG.temperature,
      maxTokens: validatedConfig.maxTokens || DEFAULT_CONFIG.maxTokens,
      timeout: validatedConfig.timeout || DEFAULT_CONFIG.timeout,
      maxRetries: validatedConfig.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.retryConfig = DEFAULT_RETRY_CONFIG;

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      organization: this.config.organization,
      dangerouslyAllowBrowser: false,
    });

    logger.info('OpenAI provider initialized', {
      model: this.config.model,
      hasBaseURL: !!this.config.baseURL,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Execute a chat completion request
   * 
   * @param request - LLM request with messages and options
   * @returns LLM response with content and metadata
   * @throws OpenAgentError on API errors
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = request.model || this.config.model;

    logger.debug('Starting completion request', {
      model,
      messageCount: request.messages.length,
      hasTools: !!request.tools,
    });

    try {
      const messages = this.convertMessages(request.messages);
      const tools = request.tools ? this.convertTools(request.tools) : undefined;

      const response = await this.executeWithRetry(() =>
        this.client.chat.completions.create({
          model,
          messages,
          temperature: request.temperature ?? this.config.temperature,
          max_tokens: request.maxTokens ?? this.config.maxTokens,
          tools,
          tool_choice: request.toolChoice,
          stop: request.stop,
          response_format: request.responseFormat,
          stream: false,
        })
      );

      const choice = response.choices[0];
      const duration = Date.now() - startTime;

      if (!choice) {
        throw new OpenAgentError(
          'No response choice returned from OpenAI',
          ErrorCode.LLM_ERROR,
          { model, duration }
        );
      }

      logger.info('Completion request completed', {
        model,
        duration,
        tokensUsed: response.usage?.total_tokens,
        finishReason: choice.finish_reason,
        hasToolCalls: !!choice.message.tool_calls,
      });

      return {
        content: choice.message.content || '',
        toolCalls: choice.message.tool_calls ? this.convertToolCalls(choice.message.tool_calls) : undefined,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: choice.finish_reason || 'stop',
        id: response.id,
        model: response.model,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Completion request failed', error instanceof Error ? error : new Error(String(error)), {
        model,
        duration,
      });
      throw this.handleError(error);
    }
  }

  /**
   * Execute a streaming chat completion request
   * 
   * @param request - LLM request with messages and options
   * @yields LLM chunks as they arrive
   * @throws OpenAgentError on API errors
   */
  async *stream(request: LLMRequest): AsyncIterable<LLMChunk> {
    const startTime = Date.now();
    const model = request.model || this.config.model;

    logger.debug('Starting stream request', {
      model,
      messageCount: request.messages.length,
    });

    try {
      const messages = this.convertMessages(request.messages);
      const tools = request.tools ? this.convertTools(request.tools) : undefined;

      const stream = await this.executeWithRetry(() =>
        this.client.chat.completions.create({
          model,
          messages,
          temperature: request.temperature ?? this.config.temperature,
          max_tokens: request.maxTokens ?? this.config.maxTokens,
          tools,
          tool_choice: request.toolChoice,
          stop: request.stop,
          stream: true,
        })
      );

      let totalChunks = 0;
      let currentToolCalls: Map<number, Partial<ToolCall>> = new Map();

      for await (const chunk of stream) {
        totalChunks++;
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        if (delta) {
          // Handle tool calls in streaming
          if (delta.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const index = toolCallDelta.index;
              
              if (!currentToolCalls.has(index)) {
                currentToolCalls.set(index, {
                  id: toolCallDelta.id || '',
                  type: 'function',
                  function: {
                    name: '',
                    arguments: '',
                  },
                });
              }

              const current = currentToolCalls.get(index)!;
              
              if (toolCallDelta.id) {
                current.id = toolCallDelta.id;
              }
              
              if (toolCallDelta.function?.name) {
                current.function!.name += toolCallDelta.function.name;
              }
              
              if (toolCallDelta.function?.arguments) {
                current.function!.arguments += toolCallDelta.function.arguments;
              }
            }
          }

          const llmChunk: LLMChunk = {
            delta: delta.content || '',
            id: chunk.id,
            finishReason: finishReason || undefined,
          };

          // Only include tool calls in final chunk
          if (finishReason === 'tool_calls' && currentToolCalls.size > 0) {
            llmChunk.toolCalls = Array.from(currentToolCalls.values());
          }

          yield llmChunk;
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Stream request completed', {
        model,
        duration,
        totalChunks,
        toolCallsCount: currentToolCalls.size,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Stream request failed', error instanceof Error ? error : new Error(String(error)), {
        model,
        duration,
      });
      throw this.handleError(error);
    }
  }

  /**
   * Execute a completion request with tools and handle tool calling loop
   * 
   * This method implements the full tool calling loop where the LLM can
   * call tools, get results, and continue the conversation until completion.
   * 
   * @param request - LLM request with messages and tools
   * @param toolExecutor - Function to execute tool calls
   * @param maxIterations - Maximum tool calling iterations (default: 5)
   * @returns Final LLM response
   * @throws OpenAgentError on API errors or max iterations exceeded
   */
  async executeWithTools(
    request: LLMRequest,
    toolExecutor: (toolCall: ToolCall) => Promise<string>,
    maxIterations: number = 5
  ): Promise<LLMResponse> {
    const messages: Message[] = [...request.messages];
    let iteration = 0;

    logger.debug('Starting tool execution loop', {
      maxIterations,
      toolCount: request.tools?.length || 0,
    });

    while (iteration < maxIterations) {
      iteration++;

      // Make completion request
      const response = await this.complete({
        ...request,
        messages,
      });

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        logger.debug('Tool execution complete', { iterations: iteration });
        return response;
      }

      logger.debug('Processing tool calls', {
        iteration,
        toolCallCount: response.toolCalls.length,
      });

      // Add assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });

      // Execute each tool and add results to messages
      for (const toolCall of response.toolCalls) {
        try {
          const result = await toolExecutor(toolCall);

          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            content: result,
          });

          logger.debug('Tool executed successfully', {
            toolName: toolCall.function.name,
            toolCallId: toolCall.id,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            content: `Error: ${errorMessage}`,
          });

          logger.warn('Tool execution failed', {
            toolName: toolCall.function.name,
            toolCallId: toolCall.id,
            error: errorMessage,
          });
        }
      }
    }

    throw new OpenAgentError(
      `Maximum tool calling iterations (${maxIterations}) exceeded`,
      ErrorCode.EXECUTION_ERROR,
      { iterations: iteration }
    );
  }

  /**
   * Check if the OpenAI API is available
   * 
   * @returns True if API is accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      logger.debug('OpenAI API availability check: available');
      return true;
    } catch (error) {
      logger.warn('OpenAI API availability check: unavailable', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get list of available models
   * 
   * @returns Array of model IDs
   */
  async getModels(): Promise<string[]> {
    logger.debug('Fetching available models');

    try {
      const models = await this.client.models.list();
      const modelIds = models.data
        .filter((model) => model.id.includes('gpt'))
        .map((model) => model.id)
        .sort();

      logger.debug('Available models fetched', { count: modelIds.length });
      return modelIds;
    } catch (error) {
      logger.error('Failed to fetch models', error instanceof Error ? error : new Error('Unknown error'));
      throw this.handleError(error);
    }
  }

  /**
   * Convert internal messages to OpenAI format
   */
  private convertMessages(messages: Message[]): ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.toolCallId!,
          content: msg.content,
        } as ChatCompletionMessageParam;
      }

      if (msg.role === 'assistant' && msg.toolCalls) {
        return {
          role: 'assistant',
          content: msg.content,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        } as ChatCompletionMessageParam;
      }

      return {
        role: msg.role,
        content: msg.content,
        name: msg.name,
      } as ChatCompletionMessageParam;
    });
  }

  /**
   * Convert internal tool definitions to OpenAI format
   */
  private convertTools(tools: ToolDefinition[]): ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: tool.type,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * Convert OpenAI tool calls to internal format
   */
  private convertToolCalls(toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]): ToolCall[] {
    return toolCalls.map((tc) => ({
      id: tc.id,
      type: tc.type,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));
  }

  /**
   * Execute a function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelay;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        logger.warn('Retrying request', {
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          delay,
          error: lastError.message,
        });

        await this.sleep(delay);
        delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof OpenAI.APIError) {
      // Retry on rate limits and server errors
      return error.status === 429 || (error.status && error.status >= 500);
    }
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Handle and convert errors to OpenAgentError
   */
  private handleError(error: unknown): OpenAgentError {
    if (error instanceof OpenAgentError) {
      return error;
    }

    if (error instanceof OpenAI.APIError) {
      return new OpenAgentError(
        `OpenAI API error: ${error.message}`,
        ErrorCode.LLM_ERROR,
        {
          status: error.status,
          code: error.code,
          type: error.type,
        }
      );
    }

    if (error instanceof Error) {
      return new OpenAgentError(
        error.message,
        ErrorCode.UNKNOWN_ERROR,
        { stack: error.stack }
      );
    }

    return new OpenAgentError(
      'Unknown error occurred',
      ErrorCode.UNKNOWN_ERROR,
      { error: String(error) }
    );
  }
}
