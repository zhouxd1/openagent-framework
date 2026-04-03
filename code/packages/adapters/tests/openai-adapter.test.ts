/**
 * Tests for OpenAI Adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIAdapter } from '../src/openai-adapter';

// Mock OpenAI SDK
const mockCreate = vi.fn();
const mockList = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
      models: {
        list: mockList,
      },
    })),
  };
});

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenAIAdapter({
      apiKey: 'test-key',
      defaultModel: 'gpt-4-turbo-preview',
    });
  });

  describe('constructor', () => {
    it('should create adapter with config', () => {
      expect(adapter.name).toBe('openai');
    });

    it('should use default model if not specified', () => {
      const defaultAdapter = new OpenAIAdapter({ apiKey: 'test-key' });
      expect(defaultAdapter).toBeDefined();
    });
  });

  describe('complete', () => {
    it('should return LLMResponse for successful completion', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello, world!',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await adapter.complete({
        messages: [{ role: 'user', content: 'Say hello' }],
      });

      expect(result.id).toBe('chatcmpl-123');
      expect(result.message.role).toBe('assistant');
      expect(result.message.content).toBe('Hello, world!');
      expect(result.usage?.totalTokens).toBe(15);
    });

    it('should use custom model from request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        choices: [
          {
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await adapter.complete({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-3.5-turbo',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
        })
      );
    });

    it('should use temperature from request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        choices: [
          {
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      await adapter.complete({
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0.7,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        })
      );
    });

    it('should handle empty content', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        choices: [
          {
            message: { role: 'assistant', content: null },
            finish_reason: 'stop',
          },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await adapter.complete({
        messages: [{ role: 'user', content: 'Test' }],
      });

      expect(result.message.content).toBe('');
    });
  });

  describe('stream', () => {
    it('should yield stream chunks', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'chatcmpl-123',
            choices: [
              {
                delta: { content: 'Hello' },
                finish_reason: null,
              },
            ],
          };
          yield {
            id: 'chatcmpl-123',
            choices: [
              {
                delta: { content: ' world' },
                finish_reason: null,
              },
            ],
          };
          yield {
            id: 'chatcmpl-123',
            choices: [
              {
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockCreate.mockResolvedValueOnce(mockStream);

      const chunks: any[] = [];
      for await (const chunk of adapter.stream({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0].delta.content).toBe('Hello');
      expect(chunks[1].delta.content).toBe(' world');
      expect(chunks[2].finishReason).toBe('stop');
    });

    it('should handle empty deltas', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'chatcmpl-123',
            choices: [
              {
                delta: {},
                finish_reason: null,
              },
            ],
          };
        },
      };

      mockCreate.mockResolvedValueOnce(mockStream);

      const chunks: any[] = [];
      for await (const chunk of adapter.stream({
        messages: [{ role: 'user', content: 'Test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].delta.content).toBeUndefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is available', async () => {
      mockList.mockResolvedValueOnce({ data: [] });
      
      const available = await adapter.isAvailable();
      
      expect(available).toBe(true);
    });

    it('should return false when API is unavailable', async () => {
      mockList.mockRejectedValueOnce(new Error('API error'));
      
      const available = await adapter.isAvailable();
      
      expect(available).toBe(false);
    });
  });

  describe('getModels', () => {
    it('should return list of GPT models', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-4-turbo-preview' },
          { id: 'gpt-3.5-turbo' },
          { id: 'davinci-002' },
          { id: 'gpt-4' },
        ],
      };

      mockList.mockResolvedValueOnce(mockModels);

      const models = await adapter.getModels()!;

      expect(models).toContain('gpt-4-turbo-preview');
      expect(models).toContain('gpt-3.5-turbo');
      expect(models).toContain('gpt-4');
      expect(models).not.toContain('davinci-002');
    });

    it('should sort models alphabetically', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-4' },
          { id: 'gpt-3.5-turbo' },
          { id: 'gpt-4-turbo-preview' },
        ],
      };

      mockList.mockResolvedValueOnce(mockModels);

      const models = await adapter.getModels()!;

      expect(models).toEqual([
        'gpt-3.5-turbo',
        'gpt-4',
        'gpt-4-turbo-preview',
      ]);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for messages', async () => {
      const messages = [
        { id: '1', sessionId: 's1', role: 'user' as const, content: 'Hello world', createdAt: new Date() },
        { id: '2', sessionId: 's1', role: 'assistant' as const, content: 'Hi there!', createdAt: new Date() },
      ];

      const tokens = await adapter.estimateTokens!(messages);

      // ~4 characters per token
      // "Hello world" = 11 chars ≈ 3 tokens
      // "Hi there!" = 9 chars ≈ 3 tokens
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('should return 0 for empty messages', async () => {
      const tokens = await adapter.estimateTokens!([]);
      expect(tokens).toBe(0);
    });
  });
});
