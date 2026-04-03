/**
 * Tests for ClaudeProvider
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ClaudeProvider } from '../src/claude-provider';
import {
  ClaudeMessage,
  ClaudeTool,
  DEFAULT_CONFIG,
} from '../src/types';

// Create mock functions that will be accessible in tests
const mockCreate = vi.fn();
const mockStream = vi.fn();

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreate,
        stream: mockStream,
      };
    },
  };
});

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClaudeProvider({
      apiKey: mockApiKey,
      model: DEFAULT_CONFIG.model,
    });
  });

  describe('constructor', () => {
    test('should create provider with default config', () => {
      expect(provider.name).toBe('claude');
    });

    test('should accept custom config', () => {
      const customProvider = new ClaudeProvider({
        apiKey: mockApiKey,
        model: 'claude-3-opus-20240229',
        maxTokens: 2000,
        temperature: 0.5,
      });
      expect(customProvider.name).toBe('claude');
    });

    test('should throw error without API key', () => {
      expect(() => new ClaudeProvider({ apiKey: '' })).toThrow();
    });
  });

  describe('complete', () => {
    test('should complete basic text request', async () => {
      const mockResponse = {
        id: 'msg-123',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          { type: 'text', text: 'Hello! How can I help you?' },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
        stop_reason: 'end_turn',
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const response = await provider.complete({
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      });

      expect(response.id).toBe('msg-123');
      expect(response.text).toBe('Hello! How can I help you?');
      expect(response.usage.inputTokens).toBe(10);
      expect(response.usage.outputTokens).toBe(20);
      expect(response.stopReason).toBe('end_turn');
    });

    test('should handle tool use response', async () => {
      const mockResponse = {
        id: 'msg-456',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          { type: 'text', text: 'Let me check the weather.' },
          {
            type: 'tool_use',
            id: 'toolu-123',
            name: 'get_weather',
            input: { location: 'San Francisco' },
          },
        ],
        usage: {
          input_tokens: 15,
          output_tokens: 30,
        },
        stop_reason: 'tool_use',
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const response = await provider.complete({
        messages: [
          { role: 'user', content: "What's the weather in SF?" },
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        ],
      });

      expect(response.toolUses).toBeDefined();
      expect(response.toolUses).toHaveLength(1);
      expect(response.toolUses![0].name).toBe('get_weather');
      expect(response.toolUses![0].input.location).toBe('San Francisco');
    });

    test('should handle system prompt', async () => {
      const mockResponse = {
        id: 'msg-789',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          { type: 'text', text: 'I am a helpful assistant.' },
        ],
        usage: {
          input_tokens: 20,
          output_tokens: 10,
        },
        stop_reason: 'end_turn',
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const response = await provider.complete({
        messages: [
          { role: 'user', content: 'Who are you?' },
        ],
        system: 'You are a helpful assistant.',
      });

      expect(response.text).toBe('I am a helpful assistant.');
    });

    test('should validate message format', async () => {
      await expect(
        provider.complete({
          messages: [],
        })
      ).rejects.toThrow('Messages array cannot be empty');
    });

    test('should require first message to be from user', async () => {
      await expect(
        provider.complete({
          messages: [
            { role: 'assistant', content: 'Hello!' },
          ],
        })
      ).rejects.toThrow('First message must be from user');
    });

    test('should require alternating messages', async () => {
      await expect(
        provider.complete({
          messages: [
            { role: 'user', content: 'Hi!' },
            { role: 'user', content: 'Hello!' },
          ],
        })
      ).rejects.toThrow('Messages must alternate');
    });
  });

  describe('stream', () => {
    test('should stream text response', async () => {
      // Create a mock stream that matches the expected interface
      const mockStreamIterator = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hello' },
          };
          yield {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: ' world' },
          };
          yield {
            type: 'message_stop',
          };
        },
        finalMessage: () => Promise.resolve({
          id: 'msg-stream-123',
          content: [{ type: 'text', text: 'Hello world' }],
          stop_reason: 'end_turn',
        }),
      };

      mockStream.mockResolvedValueOnce(mockStreamIterator);

      const chunks: string[] = [];
      for await (const chunk of provider.stream({
        messages: [{ role: 'user', content: 'Say hello' }],
      })) {
        // delta is a string for text content
        if (typeof chunk.delta === 'string') {
          chunks.push(chunk.delta);
        }
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });

    test('should stream tool use', async () => {
      const mockStreamIterator = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_start',
            index: 0,
            content_block: {
              type: 'tool_use',
              id: 'toolu-123',
              name: 'get_weather',
            },
          };
          yield {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '{"location":"' },
          };
          yield {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: 'SF"}' },
          };
          yield {
            type: 'message_stop',
          };
        },
        finalMessage: () => Promise.resolve({
          id: 'msg-stream-456',
          content: [{
            type: 'tool_use',
            id: 'toolu-123',
            name: 'get_weather',
            input: { location: 'SF' },
          }],
          stop_reason: 'tool_use',
        }),
      };

      mockStream.mockResolvedValueOnce(mockStreamIterator);

      const chunks: any[] = [];
      for await (const chunk of provider.stream({
        messages: [{ role: 'user', content: 'Get weather' }],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.some(c => c.contentBlockType === 'tool_use')).toBe(true);
    });
  });

  describe('executeWithTools', () => {
    test('should execute tools and continue conversation', async () => {
      const toolUseResponse = {
        id: 'msg-1',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          {
            type: 'tool_use',
            id: 'toolu-1',
            name: 'test_tool',
            input: { param: 'value' },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'tool_use',
      };

      const finalResponse = {
        id: 'msg-2',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          { type: 'text', text: 'Tool executed successfully' },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: 'end_turn',
      };

      mockCreate
        .mockResolvedValueOnce(toolUseResponse)
        .mockResolvedValueOnce(finalResponse);

      const toolExecutor = vi.fn().mockResolvedValue('Tool result');

      const response = await provider.executeWithTools(
        {
          messages: [{ role: 'user', content: 'Use the tool' }],
          tools: [
            {
              name: 'test_tool',
              description: 'Test tool',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        },
        toolExecutor
      );

      expect(toolExecutor).toHaveBeenCalled();
      expect(response.text).toBe('Tool executed successfully');
    });

    test('should respect maxIterations', async () => {
      const toolUseResponse = {
        id: 'msg-1',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          {
            type: 'tool_use',
            id: 'toolu-1',
            name: 'test_tool',
            input: {},
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'tool_use',
      };

      mockCreate.mockResolvedValue(toolUseResponse);

      const toolExecutor = vi.fn().mockResolvedValue('Result');

      await expect(
        provider.executeWithTools(
          {
            messages: [{ role: 'user', content: 'Use tool' }],
            tools: [
              {
                name: 'test_tool',
                description: 'Test',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
          },
          toolExecutor,
          2
        )
      ).rejects.toThrow('Maximum tool calling iterations');
    });
  });

  describe('isAvailable', () => {
    test('should return true when API is accessible', async () => {
      const mockResponse = {
        id: 'msg-123',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 'pong' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    test('should return false when API is not accessible', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API error'));

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getModels', () => {
    test('should return list of supported models', async () => {
      const models = await provider.getModels();
      expect(models).toContain('claude-3-opus-20240229');
      expect(models).toContain('claude-3-sonnet-20240229');
      expect(models).toContain('claude-3-haiku-20240307');
      expect(models).toContain('claude-3-5-sonnet-20241022');
    });
  });
});
