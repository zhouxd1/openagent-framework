/**
 * Core interfaces for OpenAgent Framework
 */
export { LLMRequest, LLMResponse, LLMStreamChunk, ToolDefinition, ToolParameter, ToolExecutionContext, ToolExecutionResult, SessionConfig, SessionState, SessionMessage, PermissionCheck, PermissionResult, PermissionRule, Event, EventCallback, EventType, Metadata, Parameters, JSONObject, JSONValue, SessionManagerConfig, PermissionManagerConfig, } from './types';
import { LLMRequest, LLMResponse, LLMStreamChunk, ToolDefinition, ToolExecutionContext, ToolExecutionResult, SessionConfig, SessionState, SessionMessage, PermissionCheck, PermissionResult, PermissionRule, Event, EventCallback, EventType, Parameters, JSONObject } from './types';
export interface ILLMProvider {
    /**
     * Provider name (e.g., 'openai', 'anthropic', 'gemini')
     */
    readonly name: string;
    /**
     * Send a chat completion request
     */
    complete(request: LLMRequest): Promise<LLMResponse>;
    /**
     * Stream a chat completion response
     */
    stream?(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
    /**
     * Check if the provider is available
     */
    isAvailable(): Promise<boolean>;
    /**
     * Get available models
     */
    getModels?(): Promise<string[]>;
    /**
     * Estimate token count for a message
     */
    estimateTokens?(messages: SessionMessage[]): Promise<number>;
}
export interface IToolExecutor {
    /**
     * Register a tool
     */
    register(tool: ToolDefinition, handler: ToolHandler): void;
    /**
     * Unregister a tool
     */
    unregister(toolName: string): void;
    /**
     * Get all registered tools
     */
    getTools(): Promise<ToolDefinition[]>;
    /**
     * Get a specific tool
     */
    getTool(name: string): Promise<ToolDefinition | null>;
    /**
     * Execute a tool
     */
    execute(toolName: string, parameters: Parameters, context?: ToolExecutionContext): Promise<ToolExecutionResult>;
    /**
     * Validate tool parameters
     */
    validate(toolName: string, parameters: Parameters): Promise<boolean>;
    /**
     * Check if a tool is enabled
     */
    isEnabled?(toolName: string): Promise<boolean>;
}
export type ToolHandler = (parameters: Parameters, context?: ToolExecutionContext) => Promise<ToolExecutionResult>;
export interface ISessionManager {
    /**
     * Create a new session
     */
    create(config: SessionConfig): Promise<SessionState>;
    /**
     * Get session by ID
     */
    get(sessionId: string): Promise<SessionState | null>;
    /**
     * Update session
     */
    update(sessionId: string, updates: Partial<SessionState>): Promise<SessionState>;
    /**
     * Delete session
     */
    delete(sessionId: string): Promise<void>;
    /**
     * Add message to session
     */
    addMessage(sessionId: string, message: Omit<SessionMessage, 'id' | 'sessionId' | 'createdAt'>): Promise<SessionMessage>;
    /**
     * Get session messages
     */
    getMessages(sessionId: string, limit?: number): Promise<SessionMessage[]>;
    /**
     * Clear session messages
     */
    clearMessages(sessionId: string): Promise<void>;
    /**
     * List sessions
     */
    list?(userId?: string, status?: string): Promise<SessionState[]>;
    /**
     * Close session
     */
    close?(sessionId: string): Promise<void>;
}
export interface IPermissionManager {
    /**
     * Check if a user has permission
     */
    check(request: PermissionCheck): Promise<PermissionResult>;
    /**
     * Grant permission to a user
     */
    grant(userId: string, rule: PermissionRule): Promise<void>;
    /**
     * Revoke permission from a user
     */
    revoke(userId: string, resource: string, action: string): Promise<void>;
    /**
     * Get all permissions for a user
     */
    getPermissions(userId: string): Promise<PermissionRule[]>;
    /**
     * Create a role
     */
    createRole?(name: string, permissions: PermissionRule[]): Promise<void>;
    /**
     * Assign role to user
     */
    assignRole?(userId: string, roleName: string): Promise<void>;
    /**
     * Remove role from user
     */
    removeRole?(userId: string, roleName: string): Promise<void>;
}
export interface IEventEmitter {
    /**
     * Subscribe to events
     */
    on(eventType: EventType, callback: EventCallback): void;
    /**
     * Unsubscribe from events
     */
    off(eventType: EventType, callback: EventCallback): void;
    /**
     * Emit an event
     */
    emit(event: Event): Promise<void>;
    /**
     * Subscribe to all events
     */
    onAll?(callback: EventCallback): void;
}
export interface ICache {
    /**
     * Get a value from cache
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set a value in cache
     */
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    /**
     * Delete a value from cache
     */
    delete(key: string): Promise<void>;
    /**
     * Clear all cache
     */
    clear?(): Promise<void>;
    /**
     * Check if key exists
     */
    exists?(key: string): Promise<boolean>;
}
export interface ILogger {
    debug(message: string, meta?: JSONObject): void;
    info(message: string, meta?: JSONObject): void;
    warn(message: string, meta?: JSONObject): void;
    error(message: string, error?: Error, meta?: JSONObject): void;
}
