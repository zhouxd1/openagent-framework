/**
 * Tests for BaseAgent and ReActAgent
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReActAgent } from '../../src/agent/react-agent';
import { AgentConfig, AgentContext } from '../../src/agent/types';
import { Tool } from '../../src/agent/interface';

// Mock tool for testing
const mockTool: Tool = {
  name: 'test_tool',
  description: 'A test tool',
  parameters: {
    query: {
      type: 'string',
      description: 'Test query',
      required: true,
    },
  },
  execute: vi.fn().mockResolvedValue({
    success: true,
    data: { result: 'test result' },
  }),
};

describe('ReActAgent', () => {
  let agent: ReActAgent;
  const config: AgentConfig = {
    id: 'test-agent',
    name: 'Test Agent',
    provider: 'openai',
    mode: 'react',
    maxIterations: 5,
  };

  beforeEach(() => {
    agent = new ReActAgent(config);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await agent.destroy();
  });

  describe('constructor', () => {
    it('should create an agent with correct configuration', () => {
      expect(agent.id).toBe(config.id);
      expect(agent.name).toBe(config.name);
      expect(agent.provider).toBe(config.provider);
      expect(agent.state.status).toBe('idle');
    });
  });

  describe('initialize', () => {
    it('should initialize the agent successfully', async () => {
      await agent.initialize();
      expect(agent.state.status).toBe('idle');
    });

    it('should register tools during initialization', async () => {
      agent.addTool(mockTool);
      await agent.initialize();
      const tools = agent.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe(mockTool.name);
    });
  });

  describe('addTool', () => {
    it('should add a tool to the agent', () => {
      agent.addTool(mockTool);
      const tools = agent.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe(mockTool.name);
    });

    it('should overwrite existing tool with same name', () => {
      agent.addTool(mockTool);
      const newTool: Tool = {
        ...mockTool,
        description: 'Updated description',
      };
      agent.addTool(newTool);
      const tools = agent.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('Updated description');
    });
  });

  describe('removeTool', () => {
    it('should remove a tool from the agent', () => {
      agent.addTool(mockTool);
      agent.removeTool(mockTool.name);
      const tools = agent.getTools();
      expect(tools).toHaveLength(0);
    });

    it('should handle removing non-existent tool gracefully', () => {
      expect(() => agent.removeTool('non_existent')).not.toThrow();
    });
  });

  describe('run', () => {
    it('should execute successfully with valid input', async () => {
      await agent.initialize();
      const result = await agent.run('Hello, test');
      expect(result.success).toBe(true);
      expect(result.metadata?.provider).toBe(config.provider);
    });

    it('should respect maxIterations configuration', async () => {
      const customConfig = { ...config, maxIterations: 1 };
      const customAgent = new ReActAgent(customConfig);
      await customAgent.initialize();
      const result = await customAgent.run('Test input');
      expect(result.metadata?.iterations).toBeLessThanOrEqual(1);
      await customAgent.destroy();
    });

    it('should emit events during execution', async () => {
      await agent.initialize();
      const eventHandler = vi.fn();
      agent.on('agent:start', eventHandler);
      agent.on('agent:end', eventHandler);
      await agent.run('Test');
      expect(eventHandler).toHaveBeenCalled();
    });

    it('should update state during execution', async () => {
      await agent.initialize();
      expect(agent.state.status).toBe('idle');
      const runPromise = agent.run('Test');
      // State should be running during execution
      await runPromise;
      expect(agent.state.status).toBe('idle');
    });
  });

  describe('state management', () => {
    it('should track state correctly', async () => {
      await agent.initialize();
      expect(agent.state.status).toBe('idle');
      expect(agent.state.currentIteration).toBe(0);
      expect(agent.state.totalToolCalls).toBe(0);
    });

    it('should reset state correctly', async () => {
      await agent.initialize();
      await agent.run('Test');
      agent.reset();
      expect(agent.state.status).toBe('idle');
      expect(agent.state.currentIteration).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should get configuration', () => {
      const retrievedConfig = agent.getConfig();
      expect(retrievedConfig.id).toBe(config.id);
      expect(retrievedConfig.name).toBe(config.name);
    });

    it('should update configuration', () => {
      agent.updateConfig({ maxIterations: 10 });
      const updatedConfig = agent.getConfig();
      expect(updatedConfig.maxIterations).toBe(10);
    });
  });

  describe('pause and resume', () => {
    it('should pause and resume agent', async () => {
      await agent.initialize();
      expect(agent.state.status).toBe('idle');
      await agent.pause();
      expect(agent.state.status).toBe('paused');
      await agent.resume();
      expect(agent.state.status).toBe('running');
    });
  });

  describe('destroy', () => {
    it('should cleanup resources on destroy', async () => {
      agent.addTool(mockTool);
      await agent.initialize();
      await agent.destroy();
      expect(agent.getTools()).toHaveLength(0);
      expect(agent.state.status).toBe('idle');
    });
  });
});
