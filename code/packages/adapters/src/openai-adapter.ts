/**
 * OpenAI Adapter Implementation
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  SessionMessage,
  LLMMessage,
  Validator,
  Logger,
  createLogger,
} from '@openagent/core';
import { z } from 'zod';

const logger = createLogger('OpenAIAdapter');

/**
 * OpenAI adapter configuration schema
 */
export const openAIConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url('Invalid base URL').optional(),
  defaultModel: z.string().optional(),
  defaultOptions: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
  }).optional(),
});

export type OpenAIConfig = z.infer<typeof openAIConfigSchema>;

/**
 * OpenAI API model response
 */
interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export class OpenAIAdapter implements ILLMProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private defaultModel: string;
  private defaultOptions: {
    temperature?: number;
    maxTokens?: number;
  };

  constructor(config: OpenAIConfig) {
    // Validate configuration
    const validatedConfig: OpenAIConfig = Validator.validate(openAIConfigSchema, config, 'OpenAI adapter configuration');
    
    logger.info('Initializing OpenAI adapter', {
      defaultModel: validatedConfig.defaultModel,
      hasBaseUrl: !!validatedConfig.baseUrl,
    });

    this.client = new OpenAI({
      apiKey: validatedConfig.apiKey,
      baseURL: validatedConfig.baseUrl,
    });
    this.defaultModel = validatedConfig.defaultModel || 'gpt-4-turbo-preview';
    this.defaultOptions = validatedConfig.defaultOptions || {};
  }

  /**
   * Convert LLMMessage to OpenAI message format
   */
  private toOpenAIMessages(messages: LLMMessage[]): ChatCompletionMessageParam[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
    })) as ChatCompletionMessageParam[];
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    
    logger.debug('Starting completion request', {
      model,
      messageCount: request.messages.length,
      temperature: request.temperature ?? this.defaultOptions.temperature,
    });

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: this.toOpenAIMessages(request.messages),
        temperature: request.temperature ?? this.defaultOptions.temperature,
        max_tokens: request.maxTokens ?? this.defaultOptions.maxTokens,
        stream: false,
      });

      const choice = response.choices[0];
      const duration = Date.now() - startTime;

      logger.info('Completion request completed', {
        model,
        duration,
        tokensUsed: response.usage?.total_tokens,
        finishReason: choice.finish_reason,
      });

      return {
        id: response.id,
        message: {
          role: choice.message.role as 'user' | 'assistant' | 'system',
          content: choice.message.content || '',
        },
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        finishReason: choice.finish_reason || undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Completion request failed', error instanceof Error ? error : new Error('Unknown error'), {
        model,
        duration,
      });
      throw error;
    }
  }

  async *stream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    
    logger.debug('Starting stream request', {
      model,
      messageCount: request.messages.length,
    });

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: this.toOpenAIMessages(request.messages),
        temperature: request.temperature ?? this.defaultOptions.temperature,
        max_tokens: request.maxTokens ?? this.defaultOptions.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta) {
          yield {
            id: chunk.id,
            delta: {
              content: delta.content || undefined,
              role: delta.role as 'user' | 'assistant' | 'system',
            },
            finishReason: chunk.choices[0]?.finish_reason || undefined,
          };
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Stream request completed', { model, duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Stream request failed', error instanceof Error ? error : new Error('Unknown error'), {
        model,
        duration,
      });
      throw error;
    }
  }

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

  async getModels(): Promise<string[]> {
    logger.debug('Fetching available models');
    
    try {
      const models = await this.client.models.list();
      const modelIds = models.data
        .filter((model: OpenAIModel) => model.id.includes('gpt'))
        .map((model: OpenAIModel) => model.id)
        .sort();

      logger.debug('Available models fetched', { count: modelIds.length });
      return modelIds;
    } catch (error) {
      logger.error('Failed to fetch models', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  async estimateTokens(messages: SessionMessage[]): Promise<number> {
    // Simple estimation: ~4 characters per token for English
    // This is a rough estimate; use tiktoken for accurate counts
    const totalChars = messages.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    );
    const estimate = Math.ceil(totalChars / 4);
    
    logger.debug('Token estimation', {
      messageCount: messages.length,
      totalChars,
      estimatedTokens: estimate,
    });
    
    return estimate;
  }
}
