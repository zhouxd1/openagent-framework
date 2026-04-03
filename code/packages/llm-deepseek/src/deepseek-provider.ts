/**
 * DeepSeek LLM Provider Implementation
 * 
 * Implements the LLMProvider interface for DeepSeek API with support for:
 * - Chat completions (OpenAI compatible)
 * - Streaming responses
 * - Function Calling
 * - Error handling and retries
 * - Long context (64K tokens)
 * 
 * DeepSeek API is fully compatible with OpenAI API format.
 * 
 * @packageDocumentation
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { Logger, createLogger, OpenAgentError, ErrorCode } from '@openagent/core';
import {
  DeepSeekConfig,
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

const logger = createLogger('DeepSeekProvider');

/**
 * DeepSeek LLM Provider
 * 
 * Provides integration with DeepSeek's chat completion API with full support
 * for streaming, function calling, and error handling.
 * 
 * Uses OpenAI SDK because DeepSeek API is fully compatible.
 * 
 * @example
 * ```typescript
 * const provider = new DeepSeekProvider({
 *   apiKey: process.env.DEEPSEEK_API_KEY,
 *   model: 'deepseek-chat',
 * });
 * 
 * const response = await provider.complete({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class DeepSeekProvider {
  readonly name = 'deepseek';
  private client: OpenAI;
  private config: {
    apiKey: string;
    baseURL: string;
    model: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
    maxRetries: number;
  };
  private retryConfig: RetryConfig;

  /**
   * Create a new DeepSeek provider instance
   * 
   * @param config - DeepSeek configuration options
   * @throws OpenAgentError if configuration is invalid
   */
  constructor(config: DeepSeekConfig) {
    // Validate required fields
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new OpenAgentError(
        'API key is required',
        ErrorCode.VALIDATION_ERROR,
        { field: 'apiKey' }
      );
    }

    // Merge with defaults
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || DEFAULT_CONFIG.baseURL,
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxTokens: config.maxTokens || DEFAULT_CONFIG.maxTokens,
      timeout: config.timeout || DEFAULT_CONFIG.timeout,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.retryConfig = DEFAULT_RETRY_CONFIG;

    // Initialize OpenAI client with DeepSeek base URL
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      dangerouslyAllowBrowser: false,
    });

    logger.info('DeepSeek provider initialized', {
      model: this.config.model,
      baseURL: this.config.baseURL,
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
          'No response choice returned from DeepSeek',
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
          };

          // Only include finish reason in final chunk
          if (finishReason) {
            llmChunk.finishReason = finishReason;
          }

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
   * Check if the DeepSeek API is available
   * 
   * @returns True if API is accessible
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try a simple completion to check availability
      await this.complete({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 5,
      });
      logger.debug('DeepSeek API availability check: available');
      return true;
    } catch (error) {
      logger.warn('DeepSeek API availability check: unavailable', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get list of available DeepSeek models
   * 
   * @returns Array of model IDs
   */
  async getModels(): Promise<string[]> {
    logger.debug('Fetching available models');
    // Return known DeepSeek models
    return ['deepseek-chat', 'deepseek-coder'];
  }

  /**
   * Convert internal messages to OpenAI format (compatible with DeepSeek)
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
   * Convert internal tool definitions to OpenAI format (compatible with DeepSeek)
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
      return error.status === 429 || (error.status !== undefined && error.status >= 500);
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
        `DeepSeek API error: ${error.message}`,
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
