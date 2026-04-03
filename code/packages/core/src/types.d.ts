/**
 * Core type definitions for OpenAgent Framework
 */
/**
 * Generic metadata type - allows primitive values and arrays of primitives
 */
export type MetadataValue = string | number | boolean | null | undefined;
/**
 * Metadata object - use interface for recursive type to avoid circular reference errors
 */
export interface MetadataObject {
    [key: string]: MetadataValue | MetadataValue[] | MetadataObject;
}
export type Metadata = MetadataObject;
/**
 * JSON-compatible value types
 */
export type JSONValue = string | number | boolean | null | JSONValue[] | JSONObject;
export type JSONObject = {
    [key: string]: JSONValue;
};
/**
 * Generic record type for parameters and configurations
 */
export type ParameterValue = string | number | boolean | JSONObject | JSONValue[];
export type Parameters = Record<string, ParameterValue>;
export interface LLMMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    name?: string;
    metadata?: Metadata;
}
export interface LLMRequest {
    messages: LLMMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    tools?: LLMToolDefinition[];
    metadata?: Metadata;
}
export interface LLMResponse {
    id: string;
    message: LLMMessage;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
    metadata?: Metadata;
}
export interface LLMStreamChunk {
    id: string;
    delta: {
        content?: string;
        role?: 'user' | 'assistant' | 'system';
    };
    finishReason?: string;
}
export interface LLMToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: JSONObject;
    };
}
export interface ToolParameter {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    required?: boolean;
    enum?: string[];
    default?: string | number | boolean | null;
    properties?: Record<string, ToolParameter>;
    items?: ToolParameter;
}
export interface ToolDefinition {
    name: string;
    description: string;
    category: 'utility' | 'data' | 'action' | 'communication' | 'custom';
    parameters: Record<string, ToolParameter>;
    returns?: {
        type: string;
        description?: string;
    };
    enabled?: boolean;
}
export interface ToolExecutionContext {
    sessionId?: string;
    userId?: string;
    timeout?: number;
    metadata?: Metadata;
}
export interface ToolExecutionResult {
    success: boolean;
    data?: JSONValue;
    error?: string;
    metadata?: Metadata;
}
export interface SessionConfig {
    userId: string;
    sessionId?: string;
    metadata?: Metadata;
    ttl?: number;
}
export interface SessionState {
    id: string;
    userId: string;
    status: 'active' | 'paused' | 'closed';
    metadata: Metadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface SessionMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokens?: number;
    metadata?: Metadata;
    createdAt: Date;
}
export interface PermissionRule {
    resource: string;
    action: 'read' | 'write' | 'execute' | 'delete' | 'admin';
    conditions?: Metadata;
}
export interface PermissionCheck {
    userId: string;
    resource: string;
    action: string;
    context?: Metadata;
}
export interface PermissionResult {
    allowed: boolean;
    reason?: string;
    conditions?: Metadata;
}
export type EventType = 'session.created' | 'session.updated' | 'session.closed' | 'message.created' | 'tool.called' | 'tool.completed' | 'tool.failed' | 'llm.requested' | 'llm.responded' | 'permission.checked';
export interface Event {
    type: EventType;
    timestamp: Date;
    data: Metadata;
    metadata?: Metadata;
}
export type EventCallback = (event: Event) => Promise<void> | void;
export interface LLMProviderConfig {
    provider: string;
    apiKey: string;
    baseUrl?: string;
    defaultModel?: string;
    defaultOptions?: {
        temperature?: number;
        maxTokens?: number;
    };
}
export interface SessionManagerConfig {
    ttl?: number;
    maxSessions?: number;
    persistMessages?: boolean;
    /** Maximum cache size for message cache */
    maxCacheSize?: number;
    /** TTL for cache entries in milliseconds */
    cacheTtl?: number;
}
export interface PermissionManagerConfig {
    cacheEnabled?: boolean;
    cacheTTL?: number;
    /** Maximum cache size */
    maxCacheSize?: number;
}
export interface ToolExecutorConfig {
    timeout?: number;
    maxConcurrent?: number;
    retryAttempts?: number;
}
export interface CacheConfig {
    /** Maximum number of items in cache */
    maxSize?: number;
    /** Time-to-live in milliseconds */
    ttl?: number;
    /** Automatic cleanup interval in milliseconds */
    cleanupInterval?: number;
}
