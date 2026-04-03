/**
 * Tool Interface for OpenAgent Framework
 */
import { z } from 'zod';
import { Parameters, Metadata, JSONValue } from '../types';
/**
 * Tool parameter definition
 */
export interface ToolParameter {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    required?: boolean;
    enum?: string[];
    default?: string | number | boolean | null;
    properties?: Record<string, ToolParameter>;
    items?: ToolParameter;
}
/**
 * Tool definition structure
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, ToolParameter>;
    category?: 'utility' | 'data' | 'action' | 'communication' | 'custom';
    enabled?: boolean;
    timeout?: number;
    retryAttempts?: number;
    metadata?: Metadata;
}
/**
 * Tool handler function type
 */
export type ToolHandler = (params: Parameters, context?: ToolExecutionContext) => Promise<ToolResult>;
/**
 * Tool execution context
 */
export interface ToolExecutionContext {
    sessionId?: string;
    userId?: string;
    agentId?: string;
    timeout?: number;
    metadata?: Metadata;
}
/**
 * Tool execution result
 */
export interface ToolResult {
    success: boolean;
    data?: JSONValue;
    error?: string;
    metadata?: Metadata;
    duration?: number;
}
/**
 * Validation result
 */
export interface ValidationResult {
    success: boolean;
    data?: Parameters;
    errors?: Array<{
        path: string;
        message: string;
        code: string;
    }>;
}
/**
 * Tool configuration
 */
export interface ToolConfig {
    timeout?: number;
    maxConcurrent?: number;
    retryAttempts?: number;
    enableCache?: boolean;
    cacheTTL?: number;
}
/**
 * Tool statistics
 */
export interface ToolStats {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
    lastCalled?: Date;
}
/**
 * Tool Interface
 *
 * Defines the contract for tool implementations
 */
export interface ITool {
    /**
     * Tool name
     */
    readonly name: string;
    /**
     * Tool description
     */
    readonly description: string;
    /**
     * Tool parameters schema
     */
    readonly parameters: Record<string, ToolParameter>;
    /**
     * Execute the tool
     */
    execute(params: Parameters, context?: ToolExecutionContext): Promise<ToolResult>;
}
/**
 * Tool Executor Interface
 *
 * Defines the contract for tool execution engines
 */
export interface IToolExecutor {
    /**
     * Register a tool with its handler
     */
    register(tool: ToolDefinition, handler: ToolHandler, schema?: z.ZodType<any, any, any>): void;
    /**
     * Unregister a tool
     */
    unregister(toolName: string): void;
    /**
     * Get all registered tools
     */
    getTools(): Promise<ToolDefinition[]>;
    /**
     * Get a specific tool by name
     */
    getTool(name: string): Promise<ToolDefinition | null>;
    /**
     * Execute a tool with parameters
     */
    execute(toolName: string, parameters: Parameters, context?: ToolExecutionContext): Promise<ToolResult>;
    /**
     * Validate tool parameters
     */
    validate(toolName: string, parameters: Parameters): Promise<boolean>;
    /**
     * Check if a tool is enabled
     */
    isEnabled?(toolName: string): Promise<boolean>;
    /**
     * Get tool statistics
     */
    getStats?(toolName: string): Promise<ToolStats | null>;
}
