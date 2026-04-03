/**
 * Agent Interface for OpenAgent Framework
 */
import { AgentProvider, AgentContext, AgentResponse, AgentConfig, AgentState } from './types';
import { Parameters, ToolParameter } from '../types';
/**
 * Tool interface for agent tools
 */
export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, ToolParameter>;
    execute(params: Parameters): Promise<ToolResult>;
}
/**
 * Tool execution result
 */
export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}
/**
 * Agent Interface
 *
 * Defines the contract for all agent implementations
 */
export interface IAgent {
    /**
     * Unique identifier for the agent
     */
    readonly id: string;
    /**
     * Human-readable name for the agent
     */
    readonly name: string;
    /**
     * LLM provider (e.g., 'openai', 'claude', 'deepseek')
     */
    readonly provider: AgentProvider;
    /**
     * Current agent state
     */
    readonly state: AgentState;
    /**
     * Execute the agent with input and optional context
     * @param input - User input or task description
     * @param context - Execution context (session, user, etc.)
     * @returns Agent response
     */
    run(input: string, context?: AgentContext): Promise<AgentResponse>;
    /**
     * Add a tool to the agent
     * @param tool - Tool to add
     */
    addTool(tool: Tool): void;
    /**
     * Remove a tool from the agent
     * @param toolName - Name of the tool to remove
     */
    removeTool(toolName: string): void;
    /**
     * Get all registered tools
     */
    getTools(): Tool[];
    /**
     * Initialize the agent
     * Called before first use
     */
    initialize(): Promise<void>;
    /**
     * Destroy the agent and cleanup resources
     */
    destroy(): Promise<void>;
    /**
     * Update agent configuration
     * @param config - Partial configuration updates
     */
    updateConfig?(config: Partial<AgentConfig>): void;
    /**
     * Get agent configuration
     */
    getConfig?(): AgentConfig;
    /**
     * Pause agent execution
     */
    pause?(): Promise<void>;
    /**
     * Resume agent execution
     */
    resume?(): Promise<void>;
    /**
     * Reset agent state
     */
    reset?(): void;
}
/**
 * Agent factory function type
 */
export type AgentFactory = (config: AgentConfig) => IAgent;
