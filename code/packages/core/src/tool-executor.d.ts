/**
 * Tool Executor Implementation
 */
import { PrismaClient } from '@prisma/client';
import { IToolExecutor, ToolHandler, ToolDefinition, ToolExecutionContext, ToolExecutionResult, Parameters } from './interfaces';
import { Logger } from './logger';
import { z } from 'zod';
export declare class ToolExecutor implements IToolExecutor {
    private prisma;
    private tools;
    private logger;
    constructor(prisma?: PrismaClient, customLogger?: Logger);
    register(tool: ToolDefinition, handler: ToolHandler, schema?: z.ZodType<any, any, any>): void;
    unregister(toolName: string): void;
    getTools(): Promise<ToolDefinition[]>;
    getTool(name: string): Promise<ToolDefinition | null>;
    execute(toolName: string, parameters: Parameters, context?: ToolExecutionContext): Promise<ToolExecutionResult>;
    /**
     * Enhanced validation using schema if available
     */
    private validateWithSchema;
    validate(toolName: string, parameters: Parameters): Promise<boolean>;
    isEnabled(toolName: string): Promise<boolean>;
    private executeWithTimeout;
}
