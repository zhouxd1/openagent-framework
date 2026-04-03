/**
 * Tests for OpenAI Provider
 * 
 * Tests cover:
 * - Initialization and configuration
 * - Completion requests
 * - Streaming responses
 * - Function calling
 * - Error handling
 * - Retry logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIProvider } from '../src/openai-provider';
import { LLMRequest, ToolDefinition } from '../src/types';

// Create mock functions that will be accessible in tests
const mockCreate = vi.fn();
const mockList = vi.fn();

// Mock OpenAI SDK
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      models = {
        list: mockList,
      };
    },
  };
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock behavior
    mockList.mockResolvedValue({
      data: [
        { id: 'gpt-4' },
        { id: 'gpt-3.5-turbo' },
      ],
    });
    
    provider = new OpenAIProvider({
      apiKey: mockApiKey,
      model: 'gpt-4',
    });
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai');
    });

    it('should use default values', () => {
      const defaultProvider = new OpenAIProvider({
        apiKey: mockApiKey,
      });
      expect(defaultProvider).toBeDefined();
    });

    it('should throw error with invalid config', () => {
      expect(() => {
        new OpenAIProvider({ apiKey: '' });
      }).toThrow();
    });

    it('should accept custom baseURL', () => {
      const customProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        baseURL: 'https://custom.api.com',
      });
      expect(customProvider).toBeDefined();
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

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      const response = await provider.complete(request);

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.finishReason).toBe('stop');
      expect(response.usage.totalTokens).toBe(30);
    });

    it('should handle tool calls', async () => {
      const mockResponse = {
        id: 'test-id',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call-123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather info',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
              },
            },
          },
        ],
      };

      const response = await provider.complete(request);

      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0].function.name).toBe('get_weather');
      expect(response.finishReason).toBe('tool_calls');
    });

    it('should respect custom model and options', async () => {
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
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 100,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          temperature: 0.5,
          max_tokens: 100,
        })
      );
    });
  });

  describe('stream', () => {
    it('should yield chunks', async () => {
      const mockChunks = [
        { id: 'test-id', choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
        { id: 'test-id', choices: [{ delta: { content: ' world' }, finish_reason: null }] },
        { id: 'test-id', choices: [{ delta: { content: '!' }, finish_reason: 'stop' }] },
      ];

      mockCreate.mockResolvedValueOnce(
        (async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        })()
      );

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const chunks: string[] = [];
      for await (const chunk of provider.stream(request)) {
        if (chunk.delta) {
          chunks.push(chunk.delta);
        }
      }

      expect(chunks).toEqual(['Hello', ' world', '!']);
    });
  });

  describe('executeWithTools', () => {
    it('should execute tool calls in a loop', async () => {
      const toolCallResponse = {
        id: 'test-id-1',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call-123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const finalResponse = {
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
        usage: { prompt_tokens: 25, completion_tokens: 10, total_tokens: 35 },
      };

      mockCreate
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(finalResponse);

      const toolExecutor = vi.fn().mockResolvedValue(JSON.stringify({ temp: 25, condition: 'sunny' }));

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
        toolExecutor
      );

      expect(toolExecutor).toHaveBeenCalled();
      expect(response.content).toBe('The weather in Tokyo is sunny.');
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is accessible', async () => {
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('getModels', () => {
    it('should return list of models', async () => {
      const models = await provider.getModels();
      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-3.5-turbo');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      const apiError = new Error('API Error');
      (apiError as any).status = 500;
      mockCreate.mockRejectedValue(apiError);

      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'Test' }] })
      ).rejects.toThrow();
    });
  });
});
