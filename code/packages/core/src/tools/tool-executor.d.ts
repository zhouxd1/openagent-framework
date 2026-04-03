/**
 * Enhanced Tool Executor Implementation
 */
import { PrismaClient } from '@prisma/client';
import { IToolExecutor, ToolHandler, ToolDefinition, ToolExecutionContext, ToolResult, ToolConfig, ToolStats } from './interface';
import { Logger } from '../logger';
import { Parameters } from '../types';
import { z } from 'zod';
/**
 * Enhanced Tool Executor with caching, retry, and statistics
 */
export declare class ToolExecutor implements IToolExecutor {
    private prisma;
    private tools;
    private logger;
    private config;
    private resultCache?;
    constructor(prisma?: PrismaClient, customLogger?: Logger, config?: ToolConfig);
    /**
     * Register a tool with its handler and optional schema
     */
    register(tool: ToolDefinition, handler: ToolHandler, schema?: z.ZodType<any, any, any>): void;
    /**
     * Unregister a tool
     */
    unregister(toolName: string): void;
    /**
     * Get all registered tools (including from database)
     */
    getTools(): Promise<ToolDefinition[]>;
    /**
     * Get a specific tool by name
     */
    getTool(name: string): Promise<ToolDefinition | null>;
    /**
     * Execute a tool with validation, timeout, and error handling
     */
    execute(toolName: string, parameters: Parameters, context?: ToolExecutionContext): Promise<ToolResult>;
    /**
     * Validate tool parameters
     */
    validate(toolName: string, parameters: Parameters): Promise<boolean>;
    /**
     * Check if a tool is enabled
     */
    isEnabled(toolName: string): Promise<boolean>;
    /**
     * Get tool statistics
     */
    getStats(toolName: string): Promise<ToolStats | null>;
    /**
     * Enhanced validation using schema if available
     */
    private validateWithSchema;
    /**
     * Execute with retry logic
     */
    private executeWithRetry;
    /**
     * Execute with timeout control
     */
    private executeWithTimeout;
    /**
     * Update tool statistics
     */
    private updateStats;
    /**
     * Generate cache key for tool execution
     */
    private getCacheKey;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
    } | null;
    /**
     * Destroy the executor and cleanup resources
     */
    destroy(): void;
}
