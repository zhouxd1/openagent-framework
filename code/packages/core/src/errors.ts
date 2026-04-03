/**
 * Unified Error Handling for OpenAgent Framework
 * 
 * This module provides a consistent error handling mechanism across all modules.
 */

/**
 * Error codes for OpenAgent Framework
 */
export enum ErrorCode {
  // Validation Errors (1xxx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_TYPE = 'INVALID_TYPE',

  // Execution Errors (2xxx)
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_DISABLED = 'TOOL_DISABLED',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  EXECUTION_FAILED = 'EXECUTION_FAILED',

  // Configuration Errors (3xxx)
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_CONFIG = 'INVALID_CONFIG',

  // Permission Errors (4xxx)
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PERMISSION_NOT_FOUND = 'PERMISSION_NOT_FOUND',

  // Session Errors (5xxx)
  SESSION_ERROR = 'SESSION_ERROR',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // LLM Errors (6xxx)
  LLM_ERROR = 'LLM_ERROR',
  LLM_REQUEST_FAILED = 'LLM_REQUEST_FAILED',
  LLM_RESPONSE_INVALID = 'LLM_RESPONSE_INVALID',

  // Cache Errors (7xxx)
  CACHE_ERROR = 'CACHE_ERROR',
  CACHE_FULL = 'CACHE_FULL',
  CACHE_EXPIRED = 'CACHE_EXPIRED',

  // General Errors (9xxx)
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

/**
 * Base error class for OpenAgent Framework
 */
export class OpenAgentError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OpenAgentError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Create a user-friendly string representation
   */
  toString(): string {
    let str = `${this.name} [${this.code}]: ${this.message}`;
    if (this.details) {
      str += ` | Details: ${JSON.stringify(this.details)}`;
    }
    return str;
  }
}

/**
 * Validation Error - for parameter validation failures
 */
export class ValidationError extends OpenAgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.VALIDATION_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = 'ValidationError';
  }
}

/**
 * Invalid Parameter Error - specific validation error for invalid parameters
 */
export class InvalidParameterError extends ValidationError {
  constructor(
    parameterName: string,
    expectedType: string,
    actualValue: unknown
  ) {
    super(
      `Invalid parameter '${parameterName}': expected ${expectedType}`,
      ErrorCode.INVALID_PARAMETER,
      { parameterName, expectedType, actualValue: String(actualValue) }
    );
    this.name = 'InvalidParameterError';
  }
}

/**
 * Missing Parameter Error - for required parameters that are missing
 */
export class MissingParameterError extends ValidationError {
  constructor(parameterName: string) {
    super(
      `Missing required parameter: '${parameterName}'`,
      ErrorCode.MISSING_PARAMETER,
      { parameterName }
    );
    this.name = 'MissingParameterError';
  }
}

/**
 * Execution Error - for tool execution failures
 */
export class ExecutionError extends OpenAgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.EXECUTION_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = 'ExecutionError';
  }
}

/**
 * Tool Not Found Error
 */
export class ToolNotFoundError extends ExecutionError {
  constructor(toolName: string) {
    super(
      `Tool not found: '${toolName}'`,
      ErrorCode.TOOL_NOT_FOUND,
      { toolName }
    );
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Tool Disabled Error
 */
export class ToolDisabledError extends ExecutionError {
  constructor(toolName: string) {
    super(
      `Tool is disabled: '${toolName}'`,
      ErrorCode.TOOL_DISABLED,
      { toolName }
    );
    this.name = 'ToolDisabledError';
  }
}

/**
 * Tool Timeout Error
 */
export class ToolTimeoutError extends ExecutionError {
  constructor(toolName: string, timeout: number) {
    super(
      `Tool '${toolName}' execution timed out after ${timeout}ms`,
      ErrorCode.TOOL_TIMEOUT,
      { toolName, timeout }
    );
    this.name = 'ToolTimeoutError';
  }
}

/**
 * Configuration Error - for configuration-related failures
 */
export class ConfigurationError extends OpenAgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CONFIGURATION_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Missing Configuration Error
 */
export class MissingConfigError extends ConfigurationError {
  constructor(configKey: string) {
    super(
      `Missing required configuration: '${configKey}'`,
      ErrorCode.MISSING_CONFIG,
      { configKey }
    );
    this.name = 'MissingConfigError';
  }
}

/**
 * Invalid Configuration Error
 */
export class InvalidConfigError extends ConfigurationError {
  constructor(
    configKey: string,
    reason: string
  ) {
    super(
      `Invalid configuration '${configKey}': ${reason}`,
      ErrorCode.INVALID_CONFIG,
      { configKey, reason }
    );
    this.name = 'InvalidConfigError';
  }
}

/**
 * Permission Error - for permission-related failures
 */
export class PermissionError extends OpenAgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PERMISSION_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = 'PermissionError';
  }
}

/**
 * Permission Denied Error
 */
export class PermissionDeniedError extends PermissionError {
  constructor(
    userId: string,
    resource: string,
    action: string
  ) {
    super(
      `Permission denied for user '${userId}' to ${action} on ${resource}`,
      ErrorCode.PERMISSION_DENIED,
      { userId, resource, action }
    );
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Session Error - for session-related failures
 */
export class SessionError extends OpenAgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.SESSION_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = 'SessionError';
  }
}

/**
 * Session Not Found Error
 */
export class SessionNotFoundError extends SessionError {
  constructor(sessionId: string) {
    super(
      `Session not found: '${sessionId}'`,
      ErrorCode.SESSION_NOT_FOUND,
      { sessionId }
    );
    this.name = 'SessionNotFoundError';
  }
}

/**
 * Session Expired Error
 */
export class SessionExpiredError extends SessionError {
  constructor(sessionId: string) {
    super(
      `Session expired: '${sessionId}'`,
      ErrorCode.SESSION_EXPIRED,
      { sessionId }
    );
    this.name = 'SessionExpiredError';
  }
}

/**
 * LLM Error - for LLM provider failures
 */
export class LLMError extends OpenAgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.LLM_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = 'LLMError';
  }
}

/**
 * Cache Error - for cache-related failures
 */
export class CacheError extends OpenAgentError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CACHE_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, code, details);
    this.name = 'CacheError';
  }
}

/**
 * Helper function to check if an error is an OpenAgentError
 */
export function isOpenAgentError(error: unknown): error is OpenAgentError {
  return error instanceof OpenAgentError;
}

/**
 * Helper function to convert unknown error to OpenAgentError
 */
export function toOpenAgentError(error: unknown): OpenAgentError {
  if (isOpenAgentError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new OpenAgentError(
      error.message,
      ErrorCode.UNKNOWN_ERROR,
      { originalError: error.name }
    );
  }

  return new OpenAgentError(
    String(error),
    ErrorCode.UNKNOWN_ERROR,
    { originalError: String(error) }
  );
}
