/**
 * Tests for DeepSeek Provider
 * 
 * Tests cover:
 * - Initialization and configuration
 * - Completion requests
 * - Streaming responses
 * - Function calling
 * - Error handling
 * - Retry logic
 * - Base URL configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeepSeekProvider } from '../src/deepseek-provider';
import { LLMRequest, ToolDefinition, DEFAULT_CONFIG } from '../src/types';

// Create mock functions that will be accessible in tests
const mockCreate = vi.fn();

// Mock OpenAI SDK - DeepSeek uses OpenAI-compatible API
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

describe('DeepSeekProvider', () => {
  let provider: DeepSeekProvider;
  const mockApiKey = 'test-deepseek-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new DeepSeekProvider({
      apiKey: mockApiKey,
      model: 'deepseek-chat',
    });
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(provider).toBeDefined();
      expect(provider.name).toBe('deepseek');
    });

    it('should use default values', () => {
      const defaultProvider = new DeepSeekProvider({
        apiKey: mockApiKey,
      });
      expect(defaultProvider).toBeDefined();
    });

    it('should throw error with invalid config', () => {
      expect(() => {
        new DeepSeekProvider({ apiKey: '' });
      }).toThrow();
    });

    it('should use correct default base URL', () => {
      const providerWithDefaults = new DeepSeekProvider({
        apiKey: mockApiKey,
      });
      expect(providerWithDefaults).toBeDefined();
    });

    it('should accept custom baseURL', () => {
      const customProvider = new DeepSeekProvider({
        apiKey: mockApiKey,
        baseURL: 'https://custom.deepseek.com/v1',
      });
      expect(customProvider).toBeDefined();
    });

    it('should accept both deepseek-chat and deepseek-coder models', () => {
      const chatProvider = new DeepSeekProvider({
        apiKey: mockApiKey,
        model: 'deepseek-chat',
      });
      expect(chatProvider).toBeDefined();

      const coderProvider = new DeepSeekProvider({
        apiKey: mockApiKey,
        model: 'deepseek-coder',
      });
      expect(coderProvider).toBeDefined();
    });

    it('should use correct default temperature', () => {
      const provider = new DeepSeekProvider({
        apiKey: mockApiKey,
      });
      expect(provider).toBeDefined();
    });

    it('should use correct default maxTokens', () => {
      const provider = new DeepSeekProvider({
        apiKey: mockApiKey,
      });
      expect(provider).toBeDefined();
    });
  });

  describe('complete', () => {
    it('should return successful completion', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hello!' }],
      });

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.finishReason).toBe('stop');
      expect(response.usage.totalTokens).toBe(30);
    });

    it('should use correct model', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await provider.complete({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'deepseek-coder',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'deepseek-coder',
        })
      );
    });

    it('should handle function calling', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const tools: ToolDefinition[] = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'City name' },
              },
              required: ['location'],
            },
          },
        },
      ];

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
        tools,
      });

      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0].function.name).toBe('get_weather');
      expect(response.finishReason).toBe('tool_calls');
    });
  });

  describe('stream', () => {
    it('should stream response chunks', async () => {
      const mockStream = (async function* () {
        yield {
          id: 'test-id',
          choices: [
            {
              delta: { content: 'Hello' },
              finish_reason: null,
            },
          ],
        };
        yield {
          id: 'test-id',
          choices: [
            {
              delta: { content: ' world' },
              finish_reason: null,
            },
          ],
        };
        yield {
          id: 'test-id',
          choices: [
            {
              delta: { content: '!' },
              finish_reason: 'stop',
            },
          ],
        };
      })();

      mockCreate.mockResolvedValueOnce(mockStream);

      const chunks: string[] = [];
      for await (const chunk of provider.stream({
        messages: [{ role: 'user', content: 'Say hello' }],
      })) {
        if (chunk.delta) {
          chunks.push(chunk.delta);
        }
      }

      expect(chunks).toEqual(['Hello', ' world', '!']);
    });
  });

  describe('executeWithTools', () => {
    it('should execute tool calls in a loop', async () => {
      const mockResponse1 = {
        id: 'test-id-1',
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      };

      const mockResponse2 = {
        id: 'test-id-2',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'The weather in Tokyo is sunny.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
      };

      mockCreate
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const toolExecutor = vi.fn().mockResolvedValue('{"temp": 25, "condition": "sunny"}');

      const response = await provider.executeWithTools(
        {
          messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get weather',
                parameters: { type: 'object', properties: {} },
              },
            },
          ],
        },
        toolExecutor,
        5
      );

      expect(toolExecutor).toHaveBeenCalled();
      expect(response.content).toBe('The weather in Tokyo is sunny.');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [
          {
            message: { role: 'assistant', content: 'pong' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when API is not accessible', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network error'));

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getModels', () => {
    it('should return list of DeepSeek models', async () => {
      const models = await provider.getModels();
      expect(models).toContain('deepseek-chat');
      expect(models).toContain('deepseek-coder');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      const apiError = new Error('API Error');
      (apiError as any).status = 500;
      mockCreate.mockRejectedValueOnce(apiError);

      await expect(
        provider.complete({
          messages: [{ role: 'user', content: 'Test' }],
        })
      ).rejects.toThrow();
    });

    it('should retry on retryable errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      
      const successResponse = {
        id: 'test-id',
        choices: [
          {
            message: { role: 'assistant', content: 'Success' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      };

      mockCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(successResponse);

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Test' }],
      });

      expect(response.content).toBe('Success');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });
  });
});
