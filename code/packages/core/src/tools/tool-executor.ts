/**
 * Enhanced Tool Executor Implementation
 * 
 * Provides tool registration, validation, and execution with:
 * - Schema-based parameter validation (Zod)
 * - Execution timeout handling
 * - Result caching with TTL
 * - Retry logic with backoff
 * - Execution statistics tracking
 */

import { PrismaClient } from '@prisma/client';
import {
  IToolExecutor,
  ToolHandler,
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
  ToolConfig,
  ToolStats,
} from './interface';
import { Logger } from '../logger';
import { Parameters } from '../types';
import { Cache } from '../cache';
import { z } from 'zod';

/**
 * Internal tool entry with handler, schema, and statistics
 */
interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
  schema?: z.ZodType<any, any, any>;
  stats: InternalToolStats;
}

/**
 * Internal statistics tracking
 */
interface InternalToolStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalDuration: number;
  lastCalled?: Date;
}

/**
 * Default tool configuration
 */
const DEFAULT_CONFIG: Required<ToolConfig> = {
  timeout: 30000,
  maxConcurrent: 100,
  retryAttempts: 0,
  enableCache: false,
  cacheTTL: 60000,
};

/**
 * Parse schema string to parameters object
 */
function parseSchemaToParameters(schemaJson: string | null): Record<string, any> {
  if (!schemaJson) return {};
  try {
    const schema = JSON.parse(schemaJson);
    return schema.properties ?? schema ?? {};
  } catch {
    return {};
  }
}

/**
 * Enhanced Tool Executor with caching, retry, and statistics
 */
export class ToolExecutor implements IToolExecutor {
  private prisma: PrismaClient;
  private tools: Map<string, ToolEntry> = new Map();
  private logger: Logger;
  private config: Required<ToolConfig>;
  private resultCache?: Cache<ToolResult>;

  constructor(prisma?: PrismaClient, customLogger?: Logger, config?: ToolConfig) {
    this.prisma = prisma ?? new PrismaClient();
    this.logger = customLogger ?? new Logger();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize result cache if enabled
    if (this.config.enableCache) {
      this.resultCache = new Cache<ToolResult>({
        maxSize: 500,
        ttl: this.config.cacheTTL,
        cleanupInterval: 30000,
      });
    }
  }

  /**
   * Register a tool with its handler and optional schema
   */
  register(
    tool: ToolDefinition,
    handler: ToolHandler,
    schema?: z.ZodType<any, any, any>
  ): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool "${tool.name}" already registered, overwriting`);
    }

    this.tools.set(tool.name, {
      definition: tool,
      handler,
      schema,
      stats: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalDuration: 0,
      },
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
   * Get all registered tools (including from database)
   */
  async getTools(): Promise<ToolDefinition[]> {
    const localTools = Array.from(this.tools.values()).map((entry) => entry.definition);

    // Also fetch tools from database if available
    try {
      const dbTools = await this.prisma.tool.findMany({
        where: { enabled: true },
      });

      const allTools = [...localTools];

      for (const dbTool of dbTools) {
        if (!this.tools.has(dbTool.name)) {
          allTools.push({
            name: dbTool.name,
            description: dbTool.description,
            parameters: parseSchemaToParameters(dbTool.schema),
            enabled: dbTool.enabled,
          });
        }
      }

      return allTools;
    } catch (error) {
      this.logger.warn('Failed to fetch tools from database, returning local tools only');
      return localTools;
    }
  }

  /**
   * Get a specific tool by name
   */
  async getTool(name: string): Promise<ToolDefinition | null> {
    const entry = this.tools.get(name);
    if (entry) {
      return entry.definition;
    }

    // Try to get from database
    try {
      const dbTool = await this.prisma.tool.findUnique({
        where: { name },
      });

      if (dbTool) {
        return {
          name: dbTool.name,
          description: dbTool.description,
          parameters: parseSchemaToParameters(dbTool.schema),
          enabled: dbTool.enabled,
        };
      }
    } catch {
      // Ignore database errors
    }

    return null;
  }

  /**
   * Execute a tool with validation, timeout, and error handling
   */
  async execute(
    toolName: string,
    parameters: Parameters,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
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

    // Check if enabled
    if (entry.definition.enabled === false) {
      return {
        success: false,
        error: `Tool "${toolName}" is disabled`,
        duration: Date.now() - startTime,
      };
    }

    // Check cache first
    if (this.resultCache && this.config.enableCache) {
      const cacheKey = this.getCacheKey(toolName, parameters);
      const cachedResult = this.resultCache.get(cacheKey);
      if (cachedResult) {
        this.logger.debug(`Tool "${toolName}" cache hit`);
        return { ...cachedResult, duration: Date.now() - startTime };
      }
    }

    try {
      // Validate parameters
      const validatedParams = this.validateWithSchema(entry, parameters);

      // Get timeout from context or config (tool.definition.timeout may not exist)
      const timeout = context?.timeout ?? this.config.timeout;

      // Get retry attempts
      const retryAttempts = entry.definition.retryAttempts ?? this.config.retryAttempts;

      // Execute with retry
      const result = await this.executeWithRetry(
        entry.handler,
        validatedParams,
        context,
        timeout,
        retryAttempts
      );

      const duration = Date.now() - startTime;

      // Update statistics
      this.updateStats(entry, duration, result.success);

      // Cache successful results
      if (this.resultCache && this.config.enableCache && result.success) {
        const cacheKey = this.getCacheKey(toolName, parameters);
        this.resultCache.set(cacheKey, result);
      }

      return {
        ...result,
        duration,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;

      this.logger.error(`Tool "${toolName}" execution failed`, err);
      this.updateStats(entry, duration, false);

      return {
        success: false,
        error: err.message,
        duration,
      };
    }
  }

  /**
   * Validate tool parameters
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
   * Check if a tool is enabled
   */
  async isEnabled(toolName: string): Promise<boolean> {
    const entry = this.tools.get(toolName);
    return entry?.definition.enabled ?? false;
  }

  /**
   * Get tool statistics
   */
  async getStats(toolName: string): Promise<ToolStats | null> {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return null;
    }

    const stats = entry.stats;
    return {
      totalCalls: stats.totalCalls,
      successfulCalls: stats.successfulCalls,
      failedCalls: stats.failedCalls,
      averageDuration:
        stats.totalCalls > 0 ? Math.round(stats.totalDuration / stats.totalCalls) : 0,
      lastCalled: stats.lastCalled,
    };
  }

  /**
   * Enhanced validation using schema if available
   */
  private validateWithSchema(entry: ToolEntry, parameters: Parameters): Parameters {
    if (!entry.schema) {
      return parameters;
    }

    try {
      return entry.schema.parse(parameters) as Parameters;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        throw new Error(`Validation failed: ${messages.join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    handler: ToolHandler,
    parameters: Parameters,
    context: ToolExecutionContext | undefined,
    timeout: number,
    retryAttempts: number
  ): Promise<ToolResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        const result = await this.executeWithTimeout(handler, parameters, context, timeout);

        if (result.success) {
          return result;
        }

        // If result indicates failure, treat as error for retry
        if (attempt < retryAttempts) {
          lastError = new Error(result.error ?? 'Unknown error');
          await this.backoff(attempt);
        } else {
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retryAttempts) {
          this.logger.debug(`Retry attempt ${attempt + 1}/${retryAttempts} for tool`);
          await this.backoff(attempt);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message ?? 'All retry attempts failed',
    };
  }

  /**
   * Execute with timeout control
   */
  private async executeWithTimeout(
    handler: ToolHandler,
    parameters: Parameters,
    context: ToolExecutionContext | undefined,
    timeoutMs: number
  ): Promise<ToolResult> {
    return new Promise<ToolResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      handler(parameters, context)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Update tool statistics
   */
  private updateStats(entry: ToolEntry, duration: number, success: boolean): void {
    entry.stats.totalCalls++;
    entry.stats.totalDuration += duration;
    entry.stats.lastCalled = new Date();

    if (success) {
      entry.stats.successfulCalls++;
    } else {
      entry.stats.failedCalls++;
    }
  }

  /**
   * Generate cache key for tool execution
   */
  private getCacheKey(toolName: string, parameters: Parameters): string {
    const sortedParams = JSON.stringify(parameters, Object.keys(parameters).sort());
    return `${toolName}:${sortedParams}`;
  }

  /**
   * Backoff delay for retries
   */
  private backoff(attempt: number): Promise<void> {
    const delay = Math.min(100 * Math.pow(2, attempt), 5000);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.resultCache?.clear();
    this.logger.debug('Tool executor cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } | null {
    if (!this.resultCache) {
      return null;
    }

    const stats = this.resultCache.getStats();
    return {
      size: stats.size,
      maxSize: stats.maxSize,
    };
  }

  /**
   * Destroy the executor and cleanup resources
   */
  destroy(): void {
    this.resultCache?.destroy();
    this.tools.clear();
    this.logger.debug('Tool executor destroyed');
  }
}
