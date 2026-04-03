/**
 * Tests for Error classes
 */

import { describe, it, expect } from 'vitest';
import {
  OpenAgentError,
  ValidationError,
  InvalidParameterError,
  MissingParameterError,
  ExecutionError,
  ToolNotFoundError,
  ToolDisabledError,
  ToolTimeoutError,
  ConfigurationError,
  MissingConfigError,
  InvalidConfigError,
  PermissionError,
  PermissionDeniedError,
  SessionError,
  SessionNotFoundError,
  SessionExpiredError,
  LLMError,
  CacheError,
  ErrorCode,
  isOpenAgentError,
  toOpenAgentError,
} from '../src/errors';

describe('OpenAgentError', () => {
  it('should create error with message and code', () => {
    const error = new OpenAgentError('Test error', ErrorCode.UNKNOWN_ERROR);
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(error.name).toBe('OpenAgentError');
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('should create error with details', () => {
    const details = { key: 'value', count: 42 };
    const error = new OpenAgentError('Test error', ErrorCode.UNKNOWN_ERROR, details);
    
    expect(error.details).toEqual(details);
  });

  it('should convert to JSON', () => {
    const error = new OpenAgentError('Test error', ErrorCode.UNKNOWN_ERROR, { key: 'value' });
    const json = error.toJSON();
    
    expect(json.name).toBe('OpenAgentError');
    expect(json.message).toBe('Test error');
    expect(json.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(json.details).toEqual({ key: 'value' });
    expect(json.timestamp).toBeDefined();
  });

  it('should convert to string', () => {
    const error = new OpenAgentError('Test error', ErrorCode.UNKNOWN_ERROR, { key: 'value' });
    const str = error.toString();
    
    expect(str).toContain('OpenAgentError');
    expect(str).toContain('UNKNOWN_ERROR');
    expect(str).toContain('Test error');
    expect(str).toContain('key');
  });
});

describe('ValidationError', () => {
  it('should create validation error', () => {
    const error = new ValidationError('Invalid input');
    
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.name).toBe('ValidationError');
  });
});

describe('InvalidParameterError', () => {
  it('should create invalid parameter error', () => {
    const error = new InvalidParameterError('count', 'number', 'string');
    
    expect(error.message).toContain('count');
    expect(error.message).toContain('number');
    expect(error.code).toBe(ErrorCode.INVALID_PARAMETER);
    expect(error.details?.parameterName).toBe('count');
    expect(error.details?.expectedType).toBe('number');
  });
});

describe('MissingParameterError', () => {
  it('should create missing parameter error', () => {
    const error = new MissingParameterError('requiredField');
    
    expect(error.message).toContain('requiredField');
    expect(error.code).toBe(ErrorCode.MISSING_PARAMETER);
    expect(error.details?.parameterName).toBe('requiredField');
  });
});

describe('ExecutionError', () => {
  it('should create execution error', () => {
    const error = new ExecutionError('Execution failed');
    
    expect(error.message).toBe('Execution failed');
    expect(error.code).toBe(ErrorCode.EXECUTION_ERROR);
    expect(error.name).toBe('ExecutionError');
  });
});

describe('ToolNotFoundError', () => {
  it('should create tool not found error', () => {
    const error = new ToolNotFoundError('myTool');
    
    expect(error.message).toContain('myTool');
    expect(error.message).toContain('not found');
    expect(error.code).toBe(ErrorCode.TOOL_NOT_FOUND);
    expect(error.details?.toolName).toBe('myTool');
  });
});

describe('ToolDisabledError', () => {
  it('should create tool disabled error', () => {
    const error = new ToolDisabledError('myTool');
    
    expect(error.message).toContain('myTool');
    expect(error.message).toContain('disabled');
    expect(error.code).toBe(ErrorCode.TOOL_DISABLED);
    expect(error.details?.toolName).toBe('myTool');
  });
});

describe('ToolTimeoutError', () => {
  it('should create tool timeout error', () => {
    const error = new ToolTimeoutError('myTool', 5000);
    
    expect(error.message).toContain('myTool');
    expect(error.message).toContain('5000ms');
    expect(error.code).toBe(ErrorCode.TOOL_TIMEOUT);
    expect(error.details?.toolName).toBe('myTool');
    expect(error.details?.timeout).toBe(5000);
  });
});

describe('ConfigurationError', () => {
  it('should create configuration error', () => {
    const error = new ConfigurationError('Invalid config');
    
    expect(error.message).toBe('Invalid config');
    expect(error.code).toBe(ErrorCode.CONFIGURATION_ERROR);
    expect(error.name).toBe('ConfigurationError');
  });
});

describe('MissingConfigError', () => {
  it('should create missing config error', () => {
    const error = new MissingConfigError('API_KEY');
    
    expect(error.message).toContain('API_KEY');
    expect(error.code).toBe(ErrorCode.MISSING_CONFIG);
    expect(error.details?.configKey).toBe('API_KEY');
  });
});

describe('InvalidConfigError', () => {
  it('should create invalid config error', () => {
    const error = new InvalidConfigError('PORT', 'must be a number');
    
    expect(error.message).toContain('PORT');
    expect(error.message).toContain('must be a number');
    expect(error.code).toBe(ErrorCode.INVALID_CONFIG);
    expect(error.details?.configKey).toBe('PORT');
    expect(error.details?.reason).toBe('must be a number');
  });
});

describe('PermissionError', () => {
  it('should create permission error', () => {
    const error = new PermissionError('Access denied');
    
    expect(error.message).toBe('Access denied');
    expect(error.code).toBe(ErrorCode.PERMISSION_ERROR);
    expect(error.name).toBe('PermissionError');
  });
});

describe('PermissionDeniedError', () => {
  it('should create permission denied error', () => {
    const error = new PermissionDeniedError('user123', 'resource', 'read');
    
    expect(error.message).toContain('user123');
    expect(error.message).toContain('resource');
    expect(error.message).toContain('read');
    expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(error.details?.userId).toBe('user123');
  });
});

describe('SessionError', () => {
  it('should create session error', () => {
    const error = new SessionError('Session failed');
    
    expect(error.message).toBe('Session failed');
    expect(error.code).toBe(ErrorCode.SESSION_ERROR);
    expect(error.name).toBe('SessionError');
  });
});

describe('SessionNotFoundError', () => {
  it('should create session not found error', () => {
    const error = new SessionNotFoundError('session-123');
    
    expect(error.message).toContain('session-123');
    expect(error.code).toBe(ErrorCode.SESSION_NOT_FOUND);
    expect(error.details?.sessionId).toBe('session-123');
  });
});

describe('SessionExpiredError', () => {
  it('should create session expired error', () => {
    const error = new SessionExpiredError('session-123');
    
    expect(error.message).toContain('session-123');
    expect(error.code).toBe(ErrorCode.SESSION_EXPIRED);
    expect(error.details?.sessionId).toBe('session-123');
  });
});

describe('LLMError', () => {
  it('should create LLM error', () => {
    const error = new LLMError('LLM request failed');
    
    expect(error.message).toBe('LLM request failed');
    expect(error.code).toBe(ErrorCode.LLM_ERROR);
    expect(error.name).toBe('LLMError');
  });
});

describe('CacheError', () => {
  it('should create cache error', () => {
    const error = new CacheError('Cache operation failed');
    
    expect(error.message).toBe('Cache operation failed');
    expect(error.code).toBe(ErrorCode.CACHE_ERROR);
    expect(error.name).toBe('CacheError');
  });
});

describe('isOpenAgentError', () => {
  it('should return true for OpenAgentError', () => {
    const error = new OpenAgentError('Test', ErrorCode.UNKNOWN_ERROR);
    expect(isOpenAgentError(error)).toBe(true);
  });

  it('should return true for derived errors', () => {
    const error = new ValidationError('Invalid');
    expect(isOpenAgentError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Regular error');
    expect(isOpenAgentError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isOpenAgentError('string')).toBe(false);
    expect(isOpenAgentError(123)).toBe(false);
    expect(isOpenAgentError(null)).toBe(false);
  });
});

describe('toOpenAgentError', () => {
  it('should return same error if already OpenAgentError', () => {
    const original = new ValidationError('Invalid');
    const converted = toOpenAgentError(original);
    
    expect(converted).toBe(original);
  });

  it('should convert regular Error to OpenAgentError', () => {
    const original = new Error('Regular error');
    const converted = toOpenAgentError(original);
    
    expect(converted).toBeInstanceOf(OpenAgentError);
    expect(converted.message).toBe('Regular error');
    expect(converted.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it('should convert string to OpenAgentError', () => {
    const converted = toOpenAgentError('String error');
    
    expect(converted).toBeInstanceOf(OpenAgentError);
    expect(converted.message).toBe('String error');
    expect(converted.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });

  it('should convert other types to OpenAgentError', () => {
    const converted = toOpenAgentError({ custom: 'error' });
    
    expect(converted).toBeInstanceOf(OpenAgentError);
    expect(converted.code).toBe(ErrorCode.UNKNOWN_ERROR);
  });
});
