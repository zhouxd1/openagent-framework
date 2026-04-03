/**
 * Base Agent Implementation for OpenAgent Framework
 */
import { IAgent, Tool, ToolResult } from './interface';
import { AgentProvider, AgentContext, AgentResponse, AgentConfig, AgentState, AgentMessage } from './types';
import { ToolExecutor } from '../tools/tool-executor';
import { EventEmitter } from '../events/event-emitter';
import { Logger } from '../logger';
import { Parameters, Metadata } from '../types';
/**
 * Abstract base class for all agent implementations
 *
 * Provides common functionality:
 * - Tool management
 * - Event emission
 * - State management
 * - Error handling
 * - Logging
 */
export declare abstract class BaseAgent implements IAgent {
    protected tools: Map<string, Tool>;
    protected toolExecutor: ToolExecutor;
    protected eventEmitter: EventEmitter;
    protected config: AgentConfig;
    protected _state: AgentState;
    protected logger: Logger;
    protected messageHistory: AgentMessage[];
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly provider: AgentProvider;
    constructor(config: AgentConfig);
    /**
     * Get current agent state
     */
    get state(): AgentState;
    /**
     * Execute the agent - must be implemented by subclasses
     */
    abstract run(input: string, context?: AgentContext): Promise<AgentResponse>;
    /**
     * Initialize the agent
     */
    initialize(): Promise<void>;
    /**
     * Destroy the agent and cleanup resources
     */
    destroy(): Promise<void>;
    /**
     * Add a tool to the agent
     */
    addTool(tool: Tool): void;
    /**
     * Remove a tool from the agent
     */
    removeTool(toolName: string): void;
    /**
     * Get all registered tools
     */
    getTools(): Tool[];
    /**
     * Update agent configuration
     */
    updateConfig(config: Partial<AgentConfig>): void;
    /**
     * Get agent configuration
     */
    getConfig(): AgentConfig;
    /**
     * Pause agent execution
     */
    pause(): Promise<void>;
    /**
     * Resume agent execution
     */
    resume(): Promise<void>;
    /**
     * Reset agent state
     */
    reset(): void;
    /**
     * Protected helper to execute a tool
     */
    protected executeTool(toolName: string, parameters: Parameters, context?: AgentContext): Promise<ToolResult>;
    /**
     * Protected helper to emit events
     */
    protected emitEvent(type: string, data: Metadata): Promise<void>;
    /**
     * Protected helper to update state
     */
    protected updateState(updates: Partial<AgentState>): void;
    /**
     * Protected helper to add message to history
     */
    protected addMessage(message: AgentMessage): void;
    /**
     * Protected helper to get message history
     */
    protected getMessageHistory(): AgentMessage[];
    /**
     * Protected helper to clear message history
     */
    protected clearMessageHistory(): void;
    /**
     * Protected helper to build system prompt
     */
    protected buildSystemPrompt(): string;
    /**
     * Protected helper to create error response
     */
    protected createErrorResponse(error: Error | string, metadata?: Metadata): AgentResponse;
    /**
     * Subscribe to agent events
     */
    on(eventType: string, handler: (event: any) => void | Promise<void>): void;
    /**
     * Unsubscribe from agent events
     */
    off(eventType: string, handler: (event: any) => void | Promise<void>): void;
}
