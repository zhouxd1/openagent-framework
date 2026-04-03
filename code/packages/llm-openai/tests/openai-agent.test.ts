/**
 * Tests for OpenAI Agent
 * 
 * Tests cover:
 * - Agent initialization
 * - Message building
 * - Tool conversion
 * - Agent execution
 * - Tool calling
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIAgent } from '../src/openai-agent';
import { OpenAIAgentConfig } from '../src/types';
import { Tool } from '@openagent/core';

// Mock OpenAI Provider
vi.mock('../src/openai-provider', () => ({
  OpenAIProvider: vi.fn().mockImplementation(() => ({
    complete: vi.fn(),
    stream: vi.fn(),
    executeWithTools: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
    getModels: vi.fn().mockResolvedValue(['gpt-4', 'gpt-3.5-turbo']),
  })),
}));

describe('OpenAIAgent', () => {
  let agent: OpenAIAgent;
  const mockConfig: OpenAIAgentConfig = {
    id: 'test-agent',
    name: 'TestAgent',
    provider: 'openai',
    apiKey: 'test-api-key',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
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

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new OpenAIAgent(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(agent).toBeDefined();
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('TestAgent');
      expect(agent.provider).toBe('openai');
    });

    it('should generate ID if not provided', () => {
      const agentWithoutId = new OpenAIAgent({
        ...mockConfig,
        id: undefined as any,
      });
      expect(agentWithoutId.id).toBeDefined();
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

    it('should handle duplicate tool names', () => {
      agent.addTool(mockTool);
      agent.addTool(mockTool); // Add same tool again
      const tools = agent.getTools();
      expect(tools).toHaveLength(1);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await agent.initialize();
      expect(agent.state.status).toBe('idle');
    });
  });

  describe('run', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should execute simple request', async () => {
      const mockProvider = require('../src/openai-provider').OpenAIProvider;
      const instance = new mockProvider();
      
      instance.executeWithTools.mockResolvedValueOnce({
        content: 'Hello! How can I help you?',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      });

      const response = await agent.run('Hello!');

      expect(response.success).toBe(true);
      expect(response.message).toBe('Hello! How can I help you?');
      expect(response.metadata?.tokensUsed?.total).toBe(30);
    });

    it('should execute with tools', async () => {
      agent.addTool(mockTool);

      const mockProvider = require('../src/openai-provider').OpenAIProvider;
      const instance = new mockProvider();
      
      instance.executeWithTools.mockResolvedValueOnce({
        content: 'The weather in Tokyo is sunny with 25°C.',
        usage: { promptTokens: 20, completionTokens: 15, totalTokens: 35 },
        finishReason: 'stop',
      });

      const response = await agent.run('What is the weather in Tokyo?');

      expect(response.success).toBe(true);
      expect(response.message).toContain('weather');
    });

    it('should handle context', async () => {
      const mockProvider = require('../src/openai-provider').OpenAIProvider;
      const instance = new mockProvider();
      
      instance.executeWithTools.mockResolvedValueOnce({
        content: 'Response with context',
        usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
        finishReason: 'stop',
      });

      const response = await agent.run('Hello', {
        sessionId: 'session-123',
        userId: 'user-456',
      });

      expect(response.success).toBe(true);
    });

    it('should handle errors', async () => {
      const mockProvider = require('../src/openai-provider').OpenAIProvider;
      const instance = new mockProvider();
      
      instance.executeWithTools.mockRejectedValueOnce(new Error('API Error'));

      const response = await agent.run('Hello');

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('message history', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should maintain conversation history', async () => {
      const mockProvider = require('../src/openai-provider').OpenAIProvider;
      const instance = new mockProvider();
      
      instance.executeWithTools
        .mockResolvedValueOnce({
          content: 'Response 1',
          usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: 'Response 2',
          usage: { promptTokens: 15, completionTokens: 5, totalTokens: 20 },
          finishReason: 'stop',
        });

      await agent.run('Message 1');
      await agent.run('Message 2');

      // Second call should include first conversation
      const secondCall = instance.executeWithTools.mock.calls[1];
      const messages = secondCall[0].messages;
      
      expect(messages).toHaveLength(5); // system + user1 + assistant1 + user2
      expect(messages[1].content).toBe('Message 1');
      expect(messages[2].content).toBe('Response 1');
      expect(messages[3].content).toBe('Message 2');
    });
  });

  describe('state management', () => {
    it('should track agent state', async () => {
      await agent.initialize();
      expect(agent.state.status).toBe('idle');
    });

    it('should update state during execution', async () => {
      const mockProvider = require('../src/openai-provider').OpenAIProvider;
      const instance = new mockProvider();
      
      // Create a promise that we can resolve later
      let resolveComplete: any;
      const completePromise = new Promise(resolve => {
        resolveComplete = resolve;
      });
      
      instance.executeWithTools.mockReturnValueOnce(completePromise);

      const runPromise = agent.run('Hello');
      
      // Give time for state to update
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(agent.state.status).toBe('running');

      // Resolve the completion
      resolveComplete({
        content: 'Response',
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: 'stop',
      });

      await runPromise;
      expect(agent.state.status).toBe('idle');
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', async () => {
      await agent.initialize();
      agent.addTool(mockTool);
      await agent.destroy();

      expect(agent.getTools()).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should update config', () => {
      agent.updateConfig({ temperature: 0.5 });
      const config = agent.getConfig();
      expect(config.temperature).toBe(0.5);
    });

    it('should preserve other config when updating', () => {
      agent.updateConfig({ temperature: 0.5 });
      const config = agent.getConfig();
      expect(config.name).toBe('TestAgent');
    });
  });

  describe('events', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should emit events during execution', async () => {
      const mockProvider = require('../src/openai-provider').OpenAIProvider;
      const instance = new mockProvider();
      
      instance.executeWithTools.mockResolvedValueOnce({
        content: 'Response',
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: 'stop',
      });

      const eventHandler = vi.fn();
      agent.on('agent.started', eventHandler);
      agent.on('agent.completed', eventHandler);

      await agent.run('Hello');

      expect(eventHandler).toHaveBeenCalledTimes(2);
    });
  });
});
