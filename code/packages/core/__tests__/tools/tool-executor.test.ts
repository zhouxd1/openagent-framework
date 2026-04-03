/**
 * Tests for ToolExecutor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToolExecutor } from '../../src/tools/tool-executor';
import { ToolDefinition, ToolHandler, ToolConfig } from '../../src/tools/types';
import { z } from 'zod';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;

  const testTool: ToolDefinition = {
    name: 'test_tool',
    description: 'A test tool',
    parameters: {
      query: {
        type: 'string',
        description: 'Test query',
        required: true,
      },
    },
    category: 'utility',
  };

  const testHandler: ToolHandler = vi.fn().mockResolvedValue({
    success: true,
    data: { result: 'test result' },
  });

  beforeEach(() => {
    executor = new ToolExecutor(undefined, undefined, {
      timeout: 5000,
      retryAttempts: 0,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    executor.destroy();
  });

  describe('register', () => {
    it('should register a tool successfully', () => {
      executor.register(testTool, testHandler);
      const tools = await executor.getTools();
      expect(tools.some(t => t.name === 'test_tool')).toBe(true);
    });

    it('should register a tool with schema', () => {
      const schema = z.object({
        query: z.string(),
      });
      executor.register(testTool, testHandler, schema);
      const tools = await executor.getTools();
      expect(tools.some(t => t.name === 'test_tool')).toBe(true);
    });
  });

  describe('unregister', () => {
    it('should unregister a tool successfully', () => {
      executor.register(testTool, testHandler);
      executor.unregister('test_tool');
      const tools = await executor.getTools();
      expect(tools.some(t => t.name === 'test_tool')).toBe(false);
    });
  });

  describe('getTools', () => {
    it('should return all registered tools', async () => {
      executor.register(testTool, testHandler);
      const anotherTool: ToolDefinition = {
        name: 'another_tool',
        description: 'Another test tool',
        parameters: {},
        category: 'utility',
      };
      executor.register(anotherTool, testHandler);
      const tools = await executor.getTools();
      expect(tools).toHaveLength(2);
    });
  });

  describe('getTool', () => {
    it('should return a specific tool by name', async () => {
      executor.register(testTool, testHandler);
      const tool = await executor.getTool('test_tool');
      expect(tool).not.toBeNull();
      expect(tool?.name).toBe('test_tool');
    });

    it('should return null for non-existent tool', async () => {
      const tool = await executor.getTool('non_existent');
      expect(tool).toBeNull();
    });
  });

  describe('execute', () => {
    it('should execute a tool successfully', async () => {
      executor.register(testTool, testHandler);
      const result = await executor.execute('test_tool', { query: 'test' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'test result' });
    });

    it('should fail for non-existent tool', async () => {
      const result = await executor.execute('non_existent', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail for disabled tool', async () => {
      const disabledTool: ToolDefinition = {
        ...testTool,
        name: 'disabled_tool',
        enabled: false,
      };
      executor.register(disabledTool, testHandler);
      const result = await executor.execute('disabled_tool', { query: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should validate parameters', async () => {
      executor.register(testTool, testHandler);
      const result = await executor.execute('test_tool', {}); // Missing required query
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should validate with schema', async () => {
      const schema = z.object({
        query: z.string().min(1),
        count: z.number().positive(),
      });
      const schemaTool: ToolDefinition = {
        name: 'schema_tool',
        description: 'Tool with schema',
        parameters: {},
        category: 'utility',
      };
      executor.register(schemaTool, testHandler, schema);

      const result = await executor.execute('schema_tool', {
        query: '',
        count: -1,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle timeout', async () => {
      const slowHandler: ToolHandler = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );
      const slowTool: ToolDefinition = {
        name: 'slow_tool',
        description: 'Slow tool',
        parameters: {},
        category: 'utility',
        timeout: 100,
      };
      executor.register(slowTool, slowHandler);

      const result = await executor.execute('slow_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should track statistics', async () => {
      executor.register(testTool, testHandler);
      await executor.execute('test_tool', { query: 'test1' });
      await executor.execute('test_tool', { query: 'test2' });

      const stats = await executor.getStats('test_tool');
      expect(stats).not.toBeNull();
      expect(stats?.totalCalls).toBe(2);
      expect(stats?.successfulCalls).toBe(2);
    });
  });

  describe('validate', () => {
    it('should validate correct parameters', async () => {
      executor.register(testTool, testHandler);
      const isValid = await executor.validate('test_tool', { query: 'test' });
      expect(isValid).toBe(true);
    });

    it('should reject invalid parameters', async () => {
      executor.register(testTool, testHandler);
      const isValid = await executor.validate('test_tool', {}); // Missing required
      expect(isValid).toBe(false);
    });

    it('should validate parameter types', async () => {
      const typedTool: ToolDefinition = {
        name: 'typed_tool',
        description: 'Typed tool',
        parameters: {
          num: { type: 'number', required: true },
          bool: { type: 'boolean', required: false },
        },
        category: 'utility',
      };
      executor.register(typedTool, testHandler);

      expect(await executor.validate('typed_tool', { num: 42 })).toBe(true);
      expect(await executor.validate('typed_tool', { num: 'not a number' })).toBe(false);
      expect(await executor.validate('typed_tool', { num: 42, bool: 'not a boolean' })).toBe(false);
    });

    it('should validate enum values', async () => {
      const enumTool: ToolDefinition = {
        name: 'enum_tool',
        description: 'Enum tool',
        parameters: {
          option: {
            type: 'string',
            required: true,
            enum: ['option1', 'option2'],
          },
        },
        category: 'utility',
      };
      executor.register(enumTool, testHandler);

      expect(await executor.validate('enum_tool', { option: 'option1' })).toBe(true);
      expect(await executor.validate('enum_tool', { option: 'invalid' })).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return true for enabled tool', async () => {
      executor.register(testTool, testHandler);
      expect(await executor.isEnabled('test_tool')).toBe(true);
    });

    it('should return false for disabled tool', async () => {
      const disabledTool: ToolDefinition = {
        ...testTool,
        name: 'disabled_tool',
        enabled: false,
      };
      executor.register(disabledTool, testHandler);
      expect(await executor.isEnabled('disabled_tool')).toBe(false);
    });

    it('should return false for non-existent tool', async () => {
      expect(await executor.isEnabled('non_existent')).toBe(false);
    });
  });

  describe('cache', () => {
    it('should cache results when enabled', async () => {
      const cachedExecutor = new ToolExecutor(undefined, undefined, {
        enableCache: true,
        cacheTTL: 60000,
      });

      cachedExecutor.register(testTool, testHandler);
      await cachedExecutor.execute('test_tool', { query: 'test' });
      await cachedExecutor.execute('test_tool', { query: 'test' });

      // Handler should be called only once due to cache
      expect(testHandler).toHaveBeenCalledTimes(1);

      cachedExecutor.destroy();
    });

    it('should clear cache', async () => {
      const cachedExecutor = new ToolExecutor(undefined, undefined, {
        enableCache: true,
      });

      cachedExecutor.register(testTool, testHandler);
      await cachedExecutor.execute('test_tool', { query: 'test' });
      cachedExecutor.clearCache();
      await cachedExecutor.execute('test_tool', { query: 'test' });

      // Handler should be called twice after cache clear
      expect(testHandler).toHaveBeenCalledTimes(2);

      cachedExecutor.destroy();
    });
  });

  describe('error handling', () => {
    it('should handle tool execution errors', async () => {
      const errorHandler: ToolHandler = vi.fn().mockRejectedValue(new Error('Tool error'));
      const errorTool: ToolDefinition = {
        name: 'error_tool',
        description: 'Error tool',
        parameters: {},
        category: 'utility',
      };
      executor.register(errorTool, errorHandler);

      const result = await executor.execute('error_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool error');
    });

    it('should handle missing handler', async () => {
      // Register without handler by directly adding to tools map
      const toolWithoutHandler: ToolDefinition = {
        name: 'no_handler',
        description: 'No handler',
        parameters: {},
        category: 'utility',
      };
      executor.register(toolWithoutHandler, testHandler);
      executor.unregister('no_handler');
      
      const result = await executor.execute('no_handler', {});
      expect(result.success).toBe(false);
    });
  });
});
