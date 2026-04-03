/**
 * Claude (Anthropic) LLM Provider Implementation
 * 
 * Implements the LLMProvider interface for Anthropic's Claude API with support for:
 * - Chat completions with system prompts
 * - Streaming responses
 * - Tool Use (Function Calling)
 * - Vision (Multimodal)
 * - Long context (up to 200K tokens)
 * 
 * @packageDocumentation
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  Logger,
  createLogger,
  OpenAgentError,
  ErrorCode,
  Validator,
} from '@openagent/core';
import { z } from 'zod';
import {
  ClaudeConfig,
  ClaudeModel,
  ClaudeMessage,
  ClaudeTool,
  ClaudeToolUse,
  ClaudeContentBlock,
  LLMRequest,
  LLMResponse,
  LLMChunk,
  RetryConfig,
  DEFAULT_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from './types';
import {
  extractTextContent,
  extractToolUses,
  sleep,
  validateClaudeMessages,
} from './utils';

const logger = createLogger('ClaudeProvider');

/**
 * Configuration validation schema
 */
const configSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  baseURL: z.string().url().optional(),
  model: z.string().optional(),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
  timeout: z.number().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
});

/**
 * Claude (Anthropic) LLM Provider
 * 
 * Provides integration with Anthropic's Claude API with full support
 * for streaming, tool use, vision, and long context windows.
 * 
 * @example
 * ```typescript
 * const provider = new ClaudeProvider({
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 *   model: 'claude-3-opus-20240229',
 * });
 * 
 * const response = await provider.complete({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class ClaudeProvider {
  readonly name = 'claude';
  private client: Anthropic;
  private config: Required<Pick<ClaudeConfig, 'apiKey' | 'model' | 'maxTokens' | 'temperature' | 'timeout' | 'maxRetries'>> & ClaudeConfig;
  private retryConfig: RetryConfig;

  /**
   * Create a new Claude provider instance
   * 
   * @param config - Claude configuration options
   * @throws OpenAgentError if configuration is invalid
   */
  constructor(config: ClaudeConfig) {
    // Validate configuration
    const validatedConfig = Validator.validate(configSchema, config, 'Claude provider configuration');

    // Merge with defaults - use type assertion for model
    this.config = {
      ...validatedConfig,
      model: (validatedConfig.model || DEFAULT_CONFIG.model) as ClaudeModel,
      maxTokens: validatedConfig.maxTokens || DEFAULT_CONFIG.maxTokens,
      temperature: validatedConfig.temperature ?? DEFAULT_CONFIG.temperature,
      timeout: validatedConfig.timeout || DEFAULT_CONFIG.timeout,
      maxRetries: validatedConfig.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.retryConfig = DEFAULT_RETRY_CONFIG;

    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    });

    logger.info('Claude provider initialized', {
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
    const model = (request.model || this.config.model) as ClaudeModel;

    logger.debug('Starting completion request', {
      model,
      messageCount: request.messages.length,
      hasTools: !!request.tools,
    });

    try {
      // Validate messages
      validateClaudeMessages(request.messages);

      // Build request for Anthropic SDK
      const anthropicRequest: Anthropic.Messages.MessageCreateParams = {
        model,
        messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })) as any,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
      };

      // Add system prompt if provided
      if (request.system) {
        anthropicRequest.system = request.system;
      }

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        anthropicRequest.tools = request.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.input_schema,
        }));
      }

      // Add temperature if specified
      if (request.temperature !== undefined) {
        anthropicRequest.temperature = request.temperature;
      }

      // Execute with retry
      const response = await this.executeWithRetry(() =>
        this.client.messages.create(anthropicRequest)
      );

      const duration = Date.now() - startTime;

      // Extract text content
      const text = extractTextContent(response.content);

      // Extract tool uses
      const toolUses = extractToolUses(response.content);

      logger.info('Completion request completed', {
        model,
        duration,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      });

      return {
        id: response.id,
        text,
        content: response.content as ClaudeContentBlock[],
        toolUses: toolUses.length > 0 ? toolUses : undefined,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        stopReason: response.stop_reason || 'end_turn',
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
  async *stream(request: LLMRequest): AsyncGenerator<LLMChunk> {
    const startTime = Date.now();
    const model = (request.model || this.config.model) as ClaudeModel;

    logger.debug('Starting stream request', {
      model,
      messageCount: request.messages.length,
    });

    try {
      // Validate messages
      validateClaudeMessages(request.messages);

      // Build request for Anthropic SDK
      const anthropicRequest: Anthropic.Messages.MessageCreateParams = {
        model,
        messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
        })) as any,
        max_tokens: request.maxTokens ?? this.config.maxTokens,
      };

      // add system prompt if provided
      if (request.system) {
        anthropicRequest.system = request.system;
      }

      // add tools if provided
      if (request.tools && request.tools.length > 0) {
        anthropicRequest.tools = request.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.input_schema,
        }));
      }

      // add temperature if specified
      if (request.temperature !== undefined) {
        anthropicRequest.temperature = request.temperature;
      }

      // execute with retry
      const stream = this.client.messages.stream(anthropicRequest);

      let totalChunks = 0;

      // Process stream events
      for await (const event of stream) {
        totalChunks++;

        if (event.type === 'content_block_delta') {
          const delta = event.delta as any;
          if (delta.type === 'text_delta' && delta.text) {
            yield {
              delta: {
                type: 'text_delta',
                text: delta.text,
              },
              contentBlockType: 'text',
            };
          } else if (delta.type === 'input_json_delta' && delta.partial_json) {
            yield {
              delta: {
                type: 'input_json_delta',
                partial_json: delta.partial_json,
              },
              contentBlockType: 'tool_use',
            };
          }
        } else if (event.type === 'content_block_start') {
          const contentBlock = event.content_block as any;
          if (contentBlock?.type === 'tool_use') {
            yield {
              delta: {
                type: 'text_delta',
                text: '',
              },
              contentBlockType: 'tool_use',
              toolUse: {
                id: contentBlock.id,
                name: contentBlock.name,
              },
            };
          }
        } else if (event.type === 'message_stop') {
          const finalMessage = await stream.finalMessage();
          yield {
            delta: {
              type: 'message_delta',
              stop_reason: finalMessage.stop_reason || 'end_turn',
            },
            finishReason: finalMessage.stop_reason || 'end_turn',
          };
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Stream request completed', {
        model,
        duration,
        totalChunks,
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
   * Execute with automatic retry on transient failures
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    let attempt = 0;
    let delay = this.retryConfig.initialDelay;

    while (attempt < this.config.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (!this.isRetryableError(error) || attempt >= this.config.maxRetries) {
          throw error;
        }

        logger.warn('Retrying request', {
          attempt,
          delay,
          error: lastError.message,
        });

        await sleep(delay);
        delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Check if APIError exists before using instanceof
    if (Anthropic.APIError && error instanceof Anthropic.APIError) {
      // Retry on rate limits and server errors
      return error.status === 429 || (error.status !== undefined && error.status >= 500);
    }
    return false;
  }

  /**
   * Handle and convert errors to OpenAgentError
   */
  private handleError(error: unknown): OpenAgentError {
    if (error instanceof OpenAgentError) {
      return error;
    }

    // Check if APIError exists before using instanceof
    if (Anthropic.APIError && error instanceof Anthropic.APIError) {
      return new OpenAgentError(
        `Claude API error: ${error.message}`,
        ErrorCode.LLM_ERROR,
        {
          status: error.status,
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

  /**
   * Execute a request with automatic tool handling
   * 
   * @param request - LLM request with messages and tools
   * @param toolExecutor - Function to execute tool calls
   * @param maxIterations - Maximum tool calling iterations (default: 10)
   * @returns Final LLM response
   */
  async executeWithTools(
    request: LLMRequest,
    toolExecutor: (toolUse: ClaudeToolUse) => Promise<string>,
    maxIterations: number = 10
  ): Promise<LLMResponse> {
    const messages: ClaudeMessage[] = [...request.messages];
    let iteration = 0;

    while (iteration < maxIterations) {
      const response = await this.complete({
        ...request,
        messages,
      });

      // If no tool uses, return the response
      if (!response.toolUses || response.toolUses.length === 0) {
        return response;
      }

      // Add assistant message with tool uses
      messages.push({
        role: 'assistant',
        content: [
          { type: 'text', text: response.text || '' },
          ...response.toolUses.map(tu => ({
            type: 'tool_use' as const,
            id: tu.id,
            name: tu.name,
            input: tu.input,
          })),
        ],
      });

      // Execute tools and add results
      const toolResults: ClaudeContentBlock[] = [];
      for (const toolUse of response.toolUses) {
        try {
          const result = await toolExecutor(toolUse);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result,
          });
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            is_error: true,
          });
        }
      }

      messages.push({
        role: 'user',
        content: toolResults,
      });

      iteration++;
    }

    // If we reach here, we exceeded max iterations - throw an error
    throw new OpenAgentError(
      `Maximum tool calling iterations (${maxIterations}) reached`,
      ErrorCode.LLM_ERROR,
      { iterations: iteration }
    );
  }
}
