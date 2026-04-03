/**
 * Base Agent Implementation for OpenAgent Framework
 */

import { IAgent, Tool, ToolResult } from './interface';
import {
  AgentProvider,
  AgentContext,
  AgentResponse,
  AgentConfig,
  AgentState,
  AgentMode,
  AgentMessage,
  ReActStep,
  ToolCallRequest,
} from './types';
import { ToolExecutor } from '../tools/tool-executor';
import { ToolDefinition as CoreToolDefinition, ToolExecutionContext } from '../tools/interface';
import { EventEmitter } from '../events/event-emitter';
import { Logger, createLogger } from '../logger';
import { OpenAgentError, ErrorCode } from '../errors';
import { Parameters, Metadata, JSONValue } from '../types';
import { generateId } from '../utils';
import { z } from 'zod';

const logger = createLogger('BaseAgent');

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
export abstract class BaseAgent implements IAgent {
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

  constructor(config: AgentConfig) {
    this.tools = new Map();
    this.toolExecutor = new ToolExecutor(undefined, createLogger('AgentToolExecutor'));
    this.eventEmitter = new EventEmitter();
    this.config = config;
    this.messageHistory = [];
    this.logger = logger.child({ agentId: config.id, agentName: config.name });

    this._state = {
      status: 'idle',
      currentIteration: 0,
      lastActivity: new Date(),
      totalToolCalls: 0,
    };
  }

  /**
   * Get current agent state
   */
  get state(): AgentState {
    return { ...this._state };
  }

  /**
   * Execute the agent - must be implemented by subclasses
   */
  abstract run(input: string, context?: AgentContext): Promise<AgentResponse>;

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.logger.debug('Initializing agent', { id: this.id });
    
    // Register all tools with the executor
    for (const [name, tool] of this.tools) {
        const coreToolDef: CoreToolDefinition = {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        };
        
        this.toolExecutor.register(
          coreToolDef,
          async (params: Parameters, ctx?: ToolExecutionContext) => {
            const result = await tool.execute(params);
            // Convert ToolResult to the Core ToolResult format
            return {
              success: result.success,
              data: result.data as JSONValue | undefined,
              error: result.error,
            };
          }
        );
      }

    this._state.status = 'idle';
    this._state.lastActivity = new Date();

    this.logger.info('Agent initialized', { id: this.id, toolCount: this.tools.size });
  }

  /**
   * Destroy the agent and cleanup resources
   */
  async destroy(): Promise<void> {
    this.logger.debug('Destroying agent', { id: this.id });
    
    this.tools.clear();
    this.messageHistory = [];
    this._state.status = 'idle';
    this.eventEmitter.clear();

    this.logger.info('Agent destroyed', { id: this.id });
  }

  /**
   * Add a tool to the agent
   */
  addTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn('Tool already exists, overwriting', { toolName: tool.name });
    }

    this.tools.set(tool.name, tool);
    
    // Register with executor
    const coreToolDef: CoreToolDefinition = {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    };
    
    this.toolExecutor.register(
      coreToolDef,
      async (params: Parameters, ctx?: ToolExecutionContext) => {
        const result = await tool.execute(params);
        // Convert ToolResult to the Core ToolResult format
        return {
          success: result.success,
          data: result.data as JSONValue | undefined,
          error: result.error,
        };
      }
    );

    this.logger.debug('Tool added', { toolName: tool.name });
  }

  /**
   * Remove a tool from the agent
   */
  removeTool(toolName: string): void {
    if (!this.tools.has(toolName)) {
      this.logger.warn('Tool not found', { toolName });
      return;
    }

    this.tools.delete(toolName);
    this.toolExecutor.unregister(toolName);

    this.logger.debug('Tool removed', { toolName });
  }

  /**
   * Get all registered tools
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Update agent configuration
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Config updated', { config: this.config });
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Pause agent execution
   */
  async pause(): Promise<void> {
    if (this._state.status === 'running') {
      this._state.status = 'paused';
      this.logger.info('Agent paused');
    }
  }

  /**
   * Resume agent execution
   */
  async resume(): Promise<void> {
    if (this._state.status === 'paused') {
      this._state.status = 'running';
      this.logger.info('Agent resumed');
    }
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this._state = {
      status: 'idle',
      currentIteration: 0,
      lastActivity: new Date(),
      totalToolCalls: 0,
    };
    this.messageHistory = [];
    this.logger.info('Agent reset');
  }

  /**
   * Protected helper to execute a tool
   */
  protected async executeTool(
    toolName: string,
    parameters: Parameters,
    context?: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Emit tool start event
      await this.eventEmitter.emit({
        type: 'tool.called' as any,
        timestamp: new Date(),
        data: {
          agentId: this.id,
          toolName,
          parameters,
          sessionId: context?.sessionId,
        },
      });

      const execContext: ToolExecutionContext | undefined = context ? {
        sessionId: context.sessionId,
        userId: context.userId,
        timeout: context.timeout,
      } : undefined;

      const result = await this.toolExecutor.execute(toolName, parameters, execContext);

      const duration = Date.now() - startTime;
      this._state.totalToolCalls++;

      // Emit tool completion event
      await this.eventEmitter.emit({
        type: result.success ? 'tool.completed' as any : 'tool.failed' as any,
        timestamp: new Date(),
        data: {
          agentId: this.id,
          toolName,
          duration,
          success: result.success,
          sessionId: context?.sessionId,
        },
      });

      // Convert back to agent ToolResult format
      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Emit tool failure event
      await this.eventEmitter.emit({
        type: 'tool.failed' as any,
        timestamp: new Date(),
        data: {
          agentId: this.id,
          toolName,
          duration,
          error: errorMessage,
          sessionId: context?.sessionId,
        },
      });

      this.logger.error('Tool execution failed', error instanceof Error ? error : new Error(errorMessage), {
        toolName,
        duration,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Protected helper to emit events
   */
  protected async emitEvent(type: string, data: Metadata): Promise<void> {
    await this.eventEmitter.emit({
      type: type as any,
      timestamp: new Date(),
      data: {
        agentId: this.id,
        ...data,
      },
    });
  }

  /**
   * Protected helper to update state
   */
  protected updateState(updates: Partial<AgentState>): void {
    this._state = { ...this._state, ...updates, lastActivity: new Date() };
  }

  /**
   * Protected helper to add message to history
   */
  protected addMessage(message: AgentMessage): void {
    this.messageHistory.push(message);
  }

  /**
   * Protected helper to get message history
   */
  protected getMessageHistory(): AgentMessage[] {
    return [...this.messageHistory];
  }

  /**
   * Protected helper to clear message history
   */
  protected clearMessageHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Protected helper to build system prompt
   */
  protected buildSystemPrompt(): string {
    let systemPrompt = this.config.systemPrompt || 'You are a helpful AI assistant.';

    // Add tool descriptions if in ReAct mode
    if (this.config.mode === 'react' && this.tools.size > 0) {
      const toolDescriptions = Array.from(this.tools.values())
        .map(tool => `- ${tool.name}: ${tool.description}`)
        .join('\n');

      systemPrompt += `\n\nAvailable tools:\n${toolDescriptions}`;
    }

    return systemPrompt;
  }

  /**
   * Protected helper to create error response
   */
  protected createErrorResponse(error: Error | string, metadata?: Metadata): AgentResponse {
    const errorMessage = error instanceof Error ? error.message : error;
    
    this.logger.error('Creating error response', error instanceof Error ? error : new Error(errorMessage));

    return {
      success: false,
      message: errorMessage,
      error: errorMessage,
      metadata: {
        provider: this.provider,
        duration: 0,
        finishReason: 'error',
        ...metadata,
      },
    };
  }

  /**
   * Subscribe to agent events
   */
  on(eventType: string, handler: (event: any) => void | Promise<void>): void {
    this.eventEmitter.on(eventType as any, handler);
  }

  /**
   * Unsubscribe from agent events
   */
  off(eventType: string, handler: (event: any) => void | Promise<void>): void {
    this.eventEmitter.off(eventType as any, handler);
  }
}
