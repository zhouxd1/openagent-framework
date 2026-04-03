/**
 * Tool Executor Implementation
 * 
 * Provides tool registration, validation, and execution with:
 * - Schema-based parameter validation (Zod)
 * - Execution timeout handling
 * - In-memory tool registry
 */

import { PrismaClient } from '@prisma/client';
import { IToolExecutor, ToolHandler, ToolDefinition, ToolExecutionContext, ToolExecutionResult, Parameters } from './interfaces';
import { Logger } from './logger';
import { z } from 'zod';

/**
 * Internal tool entry with handler and optional schema
 */
interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
  schema?: z.ZodType<any, any, any>;
}

/**
 * Tool Executor implementation
 */
export class ToolExecutor implements IToolExecutor {
  private prisma: PrismaClient;
  private tools: Map<string, ToolEntry> = new Map();
  private logger: Logger;

  constructor(prisma?: PrismaClient, customLogger?: Logger) {
    this.prisma = prisma ?? new PrismaClient();
    this.logger = customLogger ?? new Logger();
  }

  /**
   * Register a tool with optional Zod schema for validation
   */
  register(tool: ToolDefinition, handler: ToolHandler, schema?: z.ZodType<any, any, any>): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool "${tool.name}" already registered, overwriting`);
    }

    this.tools.set(tool.name, {
      definition: tool,
      handler,
      schema,
    });

    this.logger.debug(`Tool "${tool.name}" registered successfully`);
  }

  /**
   * Unregister a tool
   */
  unregister(toolName: string): void {
    if (this.tools.delete(toolName)) {
      this.logger.debug(`Tool "${toolName}" unregistered`);
    } else {
      this.logger.warn(`Tool "${toolName}" not found for unregistration`);
    }
  }

  /**
   * Get all registered tools
   */
  async getTools(): Promise<ToolDefinition[]> {
    return Array.from(this.tools.values()).map(entry => entry.definition);
  }

  /**
   * Get a specific tool by name
   */
  async getTool(name: string): Promise<ToolDefinition | null> {
    const entry = this.tools.get(name);
    return entry?.definition ?? null;
  }

  /**
   * Execute a tool with parameters
   */
  async execute(
    toolName: string,
    parameters: Parameters,
    context?: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Find tool
    const entry = this.tools.get(toolName);
    if (!entry) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
        duration: Date.now() - startTime,
      };
    }

    try {
      // Validate parameters
      const validatedParams = this.validateWithSchema(entry, parameters);

      // Execute with timeout
      const result = await this.executeWithTimeout(
        entry.handler,
        validatedParams,
        context,
        entry.definition.timeout ?? 30000
      );

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Tool "${toolName}" execution failed`, err);

      return {
        success: false,
        error: err.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Enhanced validation using Zod schema if available
   */
  private validateWithSchema(entry: ToolEntry, parameters: Parameters): Parameters {
    if (!entry.schema) {
      return parameters;
    }

    try {
      return entry.schema.parse(parameters) as Parameters;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        throw new Error(`Validation failed: ${messages.join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validate tool parameters without execution
   */
  async validate(toolName: string, parameters: Parameters): Promise<boolean> {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return false;
    }

    if (!entry.schema) {
      return true; // No schema = always valid
    }

    try {
      entry.schema.parse(parameters);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a tool is registered and enabled
   */
  async isEnabled(toolName: string): Promise<boolean> {
    const entry = this.tools.get(toolName);
    return entry?.definition.enabled ?? false;
  }

  /**
   * Execute handler with timeout
   */
  private async executeWithTimeout(
    handler: ToolHandler,
    parameters: Parameters,
    context: ToolExecutionContext | undefined,
    timeoutMs: number
  ): Promise<ToolExecutionResult> {
    return new Promise<ToolExecutionResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      handler(parameters, context)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}
