/**
 * Tests for Tool Executor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolExecutor } from '../src/tool-executor';
import { ToolDefinition, ToolExecutionResult } from '../src/types';

// Mock PrismaClient
const mockPrisma = {
  tool: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  toolCall: {
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

describe('ToolExecutor', () => {
  let executor: ToolExecutor;

  const testToolDefinition: ToolDefinition = {
    name: 'test-tool',
    description: 'A test tool',
    category: 'utility',
    parameters: {
      input: {
        type: 'string',
        description: 'Test input',
        required: true,
      },
    },
    returns: {
      type: 'string',
      description: 'Test output',
    },
  };

  const testToolHandler = async (
    parameters: Record<string, unknown>
  ): Promise<ToolExecutionResult> => {
    const input = parameters.input as string;
    return {
      success: true,
      data: `processed: ${input}`,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new ToolExecutor();
    
    // Setup default mock behavior
    mockPrisma.tool.findMany.mockResolvedValue([]);
    mockPrisma.toolCall.create.mockResolvedValue({ id: 'call-123' });
    mockPrisma.toolCall.update.mockResolvedValue({});
  });

  describe('register', () => {
    it('should register a tool with handler', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const tool = await executor.getTool('test-tool');
      expect(tool).toEqual(testToolDefinition);
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', async () => {
      executor.register(testToolDefinition, testToolHandler);
      executor.unregister('test-tool');
      
      mockPrisma.tool.findUnique.mockResolvedValue(null);
      const tool = await executor.getTool('test-tool');
      expect(tool).toBeNull();
    });
  });

  describe('getTools', () => {
    it('should return registered tools', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const tools = await executor.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
    });

    it('should merge registered and database tools', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const dbTool = {
        name: 'db-tool',
        description: 'Database tool',
        category: 'data',
        schema: JSON.stringify({ input: { type: 'string' } }),
        enabled: true,
      };
      
      mockPrisma.tool.findMany.mockResolvedValue([dbTool]);
      
      const tools = await executor.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('test-tool');
      expect(tools.map(t => t.name)).toContain('db-tool');
    });
  });

  describe('getTool', () => {
    it('should return registered tool', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const tool = await executor.getTool('test-tool');
      expect(tool).toEqual(testToolDefinition);
    });

    it('should return database tool', async () => {
      const dbTool = {
        name: 'db-tool',
        description: 'Database tool',
        category: 'data',
        schema: JSON.stringify({ input: { type: 'string' } }),
        enabled: true,
      };
      
      mockPrisma.tool.findUnique.mockResolvedValue(dbTool);
      
      const tool = await executor.getTool('db-tool');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('db-tool');
    });

    it('should return null for non-existent tool', async () => {
      mockPrisma.tool.findUnique.mockResolvedValue(null);
      
      const tool = await executor.getTool('non-existent');
      expect(tool).toBeNull();
    });
  });

  describe('validate', () => {
    it('should validate correct parameters', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const isValid = await executor.validate('test-tool', { input: 'test' });
      expect(isValid).toBe(true);
    });

    it('should reject missing required parameters', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const isValid = await executor.validate('test-tool', {});
      expect(isValid).toBe(false);
    });

    it('should reject wrong parameter type', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const isValid = await executor.validate('test-tool', { input: 123 });
      expect(isValid).toBe(false);
    });

    it('should validate enum values', async () => {
      const enumTool: ToolDefinition = {
        name: 'enum-tool',
        description: 'Tool with enum',
        category: 'utility',
        parameters: {
          option: {
            type: 'string',
            description: 'Enum option',
            required: true,
            enum: ['a', 'b', 'c'],
          },
        },
      };
      
      executor.register(enumTool, testToolHandler);
      
      expect(await executor.validate('enum-tool', { option: 'a' })).toBe(true);
      expect(await executor.validate('enum-tool', { option: 'd' })).toBe(false);
    });

    it('should return false for non-existent tool', async () => {
      mockPrisma.tool.findUnique.mockResolvedValue(null);
      
      const isValid = await executor.validate('non-existent', { input: 'test' });
      expect(isValid).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute tool successfully', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const result = await executor.execute('test-tool', { input: 'test' });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('processed: test');
    });

    it('should return error for non-existent tool', async () => {
      mockPrisma.tool.findUnique.mockResolvedValue(null);
      
      const result = await executor.execute('non-existent', { input: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for invalid parameters', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const result = await executor.execute('test-tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });

    it('should create tool call record', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      await executor.execute('test-tool', { input: 'test' });
      
      expect(mockPrisma.toolCall.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          toolName: 'test-tool',
          status: 'running',
        }),
      });
    });

    it('should update tool call record on completion', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      await executor.execute('test-tool', { input: 'test' });
      
      expect(mockPrisma.toolCall.update).toHaveBeenCalledWith({
        where: { id: 'call-123' },
        data: expect.objectContaining({
          status: 'completed',
        }),
      });
    });

    it('should handle execution errors', async () => {
      const errorHandler = async (): Promise<ToolExecutionResult> => {
        throw new Error('Execution failed');
      };
      
      executor.register(testToolDefinition, errorHandler);
      
      const result = await executor.execute('test-tool', { input: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });
  });

  describe('isEnabled', () => {
    it('should return true for enabled tool', async () => {
      executor.register(testToolDefinition, testToolHandler);
      
      const enabled = await executor.isEnabled('test-tool');
      expect(enabled).toBe(true);
    });

    it('should return false for disabled tool', async () => {
      const disabledTool: ToolDefinition = {
        ...testToolDefinition,
        enabled: false,
      };
      
      executor.register(disabledTool, testToolHandler);
      
      const enabled = await executor.isEnabled('test-tool');
      expect(enabled).toBe(false);
    });

    it('should return false for non-existent tool', async () => {
      mockPrisma.tool.findUnique.mockResolvedValue(null);
      
      const enabled = await executor.isEnabled('non-existent');
      expect(enabled).toBe(false);
    });
  });
});
