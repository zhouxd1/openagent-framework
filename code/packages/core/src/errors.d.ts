/**
 * Unified Error Handling for OpenAgent Framework
 *
 * This module provides a consistent error handling mechanism across all modules.
 */
/**
 * Error codes for OpenAgent Framework
 */
export declare enum ErrorCode {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INVALID_PARAMETER = "INVALID_PARAMETER",
    MISSING_PARAMETER = "MISSING_PARAMETER",
    INVALID_TYPE = "INVALID_TYPE",
    EXECUTION_ERROR = "EXECUTION_ERROR",
    TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
    TOOL_DISABLED = "TOOL_DISABLED",
    TOOL_TIMEOUT = "TOOL_TIMEOUT",
    EXECUTION_FAILED = "EXECUTION_FAILED",
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
    MISSING_CONFIG = "MISSING_CONFIG",
    INVALID_CONFIG = "INVALID_CONFIG",
    PERMISSION_ERROR = "PERMISSION_ERROR",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    PERMISSION_NOT_FOUND = "PERMISSION_NOT_FOUND",
    SESSION_ERROR = "SESSION_ERROR",
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
    SESSION_EXPIRED = "SESSION_EXPIRED",
    LLM_ERROR = "LLM_ERROR",
    LLM_REQUEST_FAILED = "LLM_REQUEST_FAILED",
    LLM_RESPONSE_INVALID = "LLM_RESPONSE_INVALID",
    CACHE_ERROR = "CACHE_ERROR",
    CACHE_FULL = "CACHE_FULL",
    CACHE_EXPIRED = "CACHE_EXPIRED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
}
/**
 * Base error class for OpenAgent Framework
 */
export declare class OpenAgentError extends Error {
    readonly code: ErrorCode;
    readonly details?: Record<string, unknown>;
    readonly timestamp: Date;
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    /**
     * Convert error to JSON for logging/serialization
     */
    toJSON(): Record<string, unknown>;
    /**
     * Create a user-friendly string representation
     */
    toString(): string;
}
/**
 * Validation Error - for parameter validation failures
 */
export declare class ValidationError extends OpenAgentError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
}
/**
 * Invalid Parameter Error - specific validation error for invalid parameters
 */
export declare class InvalidParameterError extends ValidationError {
    constructor(parameterName: string, expectedType: string, actualValue: unknown);
}
/**
 * Missing Parameter Error - for required parameters that are missing
 */
export declare class MissingParameterError extends ValidationError {
    constructor(parameterName: string);
}
/**
 * Execution Error - for tool execution failures
 */
export declare class ExecutionError extends OpenAgentError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
}
/**
 * Tool Not Found Error
 */
export declare class ToolNotFoundError extends ExecutionError {
    constructor(toolName: string);
}
/**
 * Tool Disabled Error
 */
export declare class ToolDisabledError extends ExecutionError {
    constructor(toolName: string);
}
/**
 * Tool Timeout Error
 */
export declare class ToolTimeoutError extends ExecutionError {
    constructor(toolName: string, timeout: number);
}
/**
 * Configuration Error - for configuration-related failures
 */
export declare class ConfigurationError extends OpenAgentError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
}
/**
 * Missing Configuration Error
 */
export declare class MissingConfigError extends ConfigurationError {
    constructor(configKey: string);
}
/**
 * Invalid Configuration Error
 */
export declare class InvalidConfigError extends ConfigurationError {
    constructor(configKey: string, reason: string);
}
/**
 * Permission Error - for permission-related failures
 */
export declare class PermissionError extends OpenAgentError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
}
/**
 * Permission Denied Error
 */
export declare class PermissionDeniedError extends PermissionError {
    constructor(userId: string, resource: string, action: string);
}
/**
 * Session Error - for session-related failures
 */
export declare class SessionError extends OpenAgentError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
}
/**
 * Session Not Found Error
 */
export declare class SessionNotFoundError extends SessionError {
    constructor(sessionId: string);
}
/**
 * Session Expired Error
 */
export declare class SessionExpiredError extends SessionError {
    constructor(sessionId: string);
}
/**
 * LLM Error - for LLM provider failures
 */
export declare class LLMError extends OpenAgentError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
}
/**
 * Cache Error - for cache-related failures
 */
export declare class CacheError extends OpenAgentError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
}
/**
 * Helper function to check if an error is an OpenAgentError
 */
export declare function isOpenAgentError(error: unknown): error is OpenAgentError;
/**
 * Helper function to convert unknown error to OpenAgentError
 */
export declare function toOpenAgentError(error: unknown): OpenAgentError;
