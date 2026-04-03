/**
 * Tests for DeepSeek Agent
 * 
 * Tests cover:
 * - Agent initialization
 * - Message building
 * - Tool conversion
 * - Agent execution with deepseek-chat
 * - Agent execution with deepseek-coder
 * - Tool calling
 * - Error handling
 * - Streaming
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeepSeekAgent } from '../src/deepseek-agent';
import { DeepSeekAgentConfig } from '../src/types';
import { Tool } from '@openagent/core';

// Mock DeepSeek Provider
vi.mock('../src/deepseek-provider', () => ({
  DeepSeekProvider: vi.fn().mockImplementation(() => ({
    complete: vi.fn(),
    stream: vi.fn(),
    executeWithTools: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
    getModels: vi.fn().mockResolvedValue(['deepseek-chat', 'deepseek-coder']),
  })),
}));

describe('DeepSeekAgent', () => {
  let agent: DeepSeekAgent;
  const mockConfig: DeepSeekAgentConfig = {
    id: 'test-agent',
    name: 'TestAgent',
    provider: 'deepseek',
    apiKey: 'test-api-key',
    model: 'deepseek-chat',
    temperature: 1,
    maxTokens: 4096,
  };

  const mockTool: Tool = {
    name: 'get_weather',
    description: 'Get weather information',
    parameters: {
      location: {
        type: 'string',
        description: 'City name',
        required: true,
      },
    },
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: { temp: 25, condition: 'sunny' },
    }),
  };

  const codeTool: Tool = {
    name: 'execute_code',
    description: 'Execute Python code',
    parameters: {
      code: {
        type: 'string',
        description: 'Python code to execute',
        required: true,
      },
    },
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: { output: 'Code executed successfully' },
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new DeepSeekAgent(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(agent).toBeDefined();
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('TestAgent');
      expect(agent.provider).toBe('deepseek');
    });

    it('should generate ID if not provided', () => {
      const agentWithoutId = new DeepSeekAgent({
        ...mockConfig,
        id: undefined as any,
      });
      expect(agentWithoutId.id).toBeDefined();
      expect(agentWithoutId.id).toMatch(/^agent-/);
    });

    it('should use default name if not provided', () => {
      const agentWithoutName = new DeepSeekAgent({
        ...mockConfig,
        name: undefined as any,
      });
      expect(agentWithoutName.name).toBe('DeepSeek Agent');
    });

    it('should initialize with deepseek-coder model', () => {
      const coderAgent = new DeepSeekAgent({
        ...mockConfig,
        model: 'deepseek-coder',
      });
      expect(coderAgent).toBeDefined();
    });
  });

  describe('tool management', () => {
    it('should add tools', () => {
      agent.addTool(mockTool);
      const tools = agent.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('get_weather');
    });

    it('should remove tools', () => {
      agent.addTool(mockTool);
      agent.removeTool('get_weather');
      const tools = agent.getTools();
      expect(tools).toHaveLength(0);
    });

    it('should handle multiple tools', () => {
      agent.addTool(mockTool);
      agent.addTool(codeTool);
      const tools = agent.getTools();
      expect(tools).toHaveLength(2);
    });

    it('should handle duplicate tool names', () => {
      agent.addTool(mockTool);
      agent.addTool(mockTool); // Add same tool again
      const tools = agent.getTools();
      expect(tools).toHaveLength(1);
    });
  });

  describe('run', () => {
    it('should execute successfully with deepseek-chat', async () => {
      const mockResponse = {
        content: 'Hello! How can I help you today?',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop',
      };

      const DeepSeekProvider = (await import('../src/deepseek-provider')).DeepSeekProvider;
      const mockProvider = new (DeepSeekProvider as any)();
      mockProvider.executeWithTools.mockResolvedValue(mockResponse);

      await agent.initialize();
      const response = await agent.run('Hello!');

      expect(response.success).toBe(true);
      expect(response.message).toBe('Hello! How can I help you today?');
      expect(response.metadata?.provider).toBe('deepseek');
    });

    it('should execute successfully with deepseek-coder', async () => {
      const coderAgent = new DeepSeekAgent({
        ...mockConfig,
        model: 'deepseek-coder',
      });

      const mockResponse = {
        content: 'Here is a Python function to sort an array:\n\n```python\ndef sort_array(arr):\n    return sorted(arr)\n```',
        usage: {
          promptTokens: 15,
          completionTokens: 30,
          totalTokens: 45,
        },
        finishReason: 'stop',
      };

      const DeepSeekProvider = (await import('../src/deepseek-provider')).DeepSeekProvider;
      const mockProvider = new (DeepSeekProvider as any)();
      mockProvider.executeWithTools.mockResolvedValue(mockResponse);

      await coderAgent.initialize();
      const response = await coderAgent.run('Write a function to sort an array');

      expect(response.success).toBe(true);
      expect(response.message).toContain('sort_array');
    });

    it('should handle tool calls', async () => {
      agent.addTool(mockTool);

      const mockResponse = {
        content: 'The weather in Tokyo is 25°C and sunny.',
        usage: {
          promptTokens: 20,
          completionTokens: 15,
          totalTokens: 35,
        },
        finishReason: 'stop',
      };

      const DeepSeekProvider = (await import('../src/deepseek-provider')).DeepSeekProvider;
      const mockProvider = new (DeepSeekProvider as any)();
      mockProvider.executeWithTools.mockResolvedValue(mockResponse);

      await agent.initialize();
      const response = await agent.run('What is the weather in Tokyo?');

      expect(response.success).toBe(true);
      expect(response.message).toContain('weather');
    });

    it('should handle errors gracefully', async () => {
      const DeepSeekProvider = (await import('../src/deepseek-provider')).DeepSeekProvider;
      const mockProvider = new (DeepSeekProvider as any)();
      mockProvider.executeWithTools.mockRejectedValue(new Error('API Error'));

      await agent.initialize();
      const response = await agent.run('Hello!');

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should include token usage in response', async () => {
      const mockResponse = {
        content: 'Response',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        finishReason: 'stop',
      };

      const DeepSeekProvider = (await import('../src/deepseek-provider')).DeepSeekProvider;
      const mockProvider = new (DeepSeekProvider as any)();
      mockProvider.executeWithTools.mockResolvedValue(mockResponse);

      await agent.initialize();
      const response = await agent.run('Hello!');

      expect(response.metadata?.tokensUsed).toBeDefined();
      expect(response.metadata?.tokensUsed?.total).toBe(150);
    });

    it('should include duration in response', async () => {
      const mockResponse = {
        content: 'Response',
        usage: {
          promptTokens: 10,
          completionTokens: 10,
          totalTokens: 20,
        },
        finishReason: 'stop',
      };

      const DeepSeekProvider = (await import('../src/deepseek-provider')).DeepSeekProvider;
      const mockProvider = new (DeepSeekProvider as any)();
      mockProvider.executeWithTools.mockResolvedValue(mockResponse);

      await agent.initialize();
      const response = await agent.run('Hello!');

      expect(response.metadata?.duration).toBeDefined();
      expect(response.metadata?.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stream', () => {
    it('should stream response chunks', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { delta: 'Hello' };
          yield { delta: ' from' };
          yield { delta: ' DeepSeek!' };
        },
      };

      const DeepSeekProvider = (await import('../src/deepseek-provider')).DeepSeekProvider;
      const mockProvider = new (DeepSeekProvider as any)();
      mockProvider.stream.mockReturnValue(mockStream);

      const chunks: string[] = [];
      for await (const chunk of agent.stream('Hello!')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' from', ' DeepSeek!']);
    });

    it('should handle streaming errors', async () => {
      const DeepSeekProvider = (await import('../src/deepseek-provider')).DeepSeekProvider;
      const mockProvider = new (DeepSeekProvider as any)();
      mockProvider.stream.mockImplementation(async function* () {
        yield { delta: 'Partial' };
        throw new Error('Stream error');
      });

      const chunks: string[] = [];
      try {
        for await (const chunk of agent.stream('Hello!')) {
          chunks.push(chunk);
        }
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Stream error');
      }
    });
  });

  describe('initialize and destroy', () => {
    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    it('should destroy successfully', async () => {
      await agent.initialize();
      await expect(agent.destroy()).resolves.not.toThrow();
    });

    it('should clear tools on destroy', async () => {
      agent.addTool(mockTool);
      await agent.initialize();
      await agent.destroy();
      
      const tools = agent.getTools();
      expect(tools).toHaveLength(0);
    });
  });

  describe('state management', () => {
    it('should track agent state', () => {
      expect(agent.state.status).toBe('idle');
    });

    it('should reset state', async () => {
      await agent.initialize();
      agent.reset();
      
      expect(agent.state.status).toBe('idle');
      expect(agent.state.currentIteration).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should get configuration', () => {
      const config = agent.getConfig();
      expect(config.id).toBe('test-agent');
      expect(config.provider).toBe('deepseek');
    });

    it('should update configuration', () => {
      agent.updateConfig({ temperature: 0.5 });
      const config = agent.getConfig();
      expect(config.temperature).toBe(0.5);
    });
  });

  describe('messages', () => {
    it('should build system prompt', async () => {
      const customAgent = new DeepSeekAgent({
        ...mockConfig,
        systemPrompt: 'You are a helpful coding assistant.',
      });

      const mockResponse = {
        content: 'Ready to help with code!',
        usage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
        },
        finishReason: 'stop',
      };

      const DeepSeekProvider = (await import('../src/deepseek-provider')).DeepSeekProvider;
      const mockProvider = new (DeepSeekProvider as any)();
      mockProvider.executeWithTools.mockResolvedValue(mockResponse);

      await customAgent.initialize();
      const response = await customAgent.run('Hello!');

      expect(response.success).toBe(true);
    });
  });
});
