/**
 * @openagent/core
 * Core interfaces and utilities for OpenAgent Framework
 */

// ============================================================================
// Types - Primary source of truth
// ============================================================================

export type {
  MetadataValue,
  MetadataObject,
  Metadata,
  JSONValue,
  JSONObject,
  ParameterValue,
  Parameters,
  LLMMessage,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMToolDefinition,
  ToolParameter,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  SessionConfig,
  SessionState,
  SessionMessage,
  PermissionRule,
  PermissionCheck,
  PermissionResult,
  EventType,
  Event,
  EventCallback,
  LLMProviderConfig,
  SessionManagerConfig,
  PermissionManagerConfig,
  ToolExecutorConfig,
  CacheConfig,
} from './types';

// ============================================================================
// Interfaces
// ============================================================================

export type {
  ILLMProvider,
  IToolExecutor,
  ISessionManager,
  IPermissionManager,
  IEventEmitter,
  ICache,
  ILogger,
  ToolHandler,
} from './interfaces';

// ============================================================================
// Agent Types & Interfaces
// ============================================================================

export type {
  AgentProvider,
  AgentMode,
  AgentContext,
  AgentResponse,
  ToolCallResult,
  AgentResponseMetadata,
  AgentConfig,
  AgentState,
  ReActStep,
  AgentMessage,
  ToolCallRequest,
} from './agent/types';

export type {
  Tool,
  ToolResult,
  IAgent,
  AgentFactory,
} from './agent/interface';

// ============================================================================
// Routing Types
// ============================================================================

export {
  TaskType,
} from './routing/types';

export type {
  ProviderStats,
  ProviderInfo,
  Message,
  RoutingTool,
  Constraints,
  RoutingContext,
  RoutingResult,
  HealthCheckConfig,
  PoolConfig,
  RouterConfig,
  HealthStatus,
} from './routing/types';

// ============================================================================
// Tool Types (from tools module)
// ============================================================================

export type {
  ToolConfig,
  ToolStats,
  ITool,
} from './tools/interface';

// ============================================================================
// Implementations
// ============================================================================

// Event & Cache
export { EventEmitter } from './event-emitter';
export { Cache } from './cache';

// Errors
export {
  ErrorCode,
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
  isOpenAgentError,
  toOpenAgentError,
} from './errors';

// Validator
export {
  SchemaValidationError,
  Validator,
  CommonSchemas,
  ToolSchemaBuilder,
} from './validator';

// Logger
export { Logger, LogLevel, logger, createLogger, type LogEntry, type LogContext, type LogTransport } from './logger';

// Utils
export {
  generateId,
  delay,
  retry,
  deepMerge,
  deepClone,
  safeJsonParse,
  safeJsonStringify,
  isValidJson,
  formatTimestamp,
  parseTimestamp,
  calculateExpiration,
  isExpired,
  truncate,
  removeNullish,
  isString,
  isNumber,
  isBoolean,
  isPlainObject,
  isArray,
  getNestedValue,
} from './utils';

// ============================================================================
// Agent Implementations
// ============================================================================

export { BaseAgent } from './agent/base-agent';
export { ReActAgent } from './agent/react-agent';

// ============================================================================
// Routing Implementations
// ============================================================================

export { LLMRouter } from './routing/router';
export { ProviderPool } from './routing/provider-pool';
export { HealthChecker } from './routing/health-check';

// Strategies
export { RoutingStrategy } from './routing/strategies/base';
export { CostOptimizedStrategy } from './routing/strategies/cost-optimized';
export { PerformanceStrategy } from './routing/strategies/performance';
export { RoundRobinStrategy } from './routing/strategies/round-robin';
export { SmartRoutingStrategy, WeightedStrategy } from './routing/strategies/smart';

// Rules
export { TaskBasedStrategy, TASK_PROVIDER_MAPPING } from './routing/rules/task-based';
export { CapabilityStrategy } from './routing/rules/capability';
export { FallbackRule } from './routing/rules/fallback';

// ============================================================================
// Tool Executor (from tools module - primary)
// ============================================================================

export { ToolExecutor } from './tools/tool-executor';

// ============================================================================
// Session Manager
// ============================================================================

export { SessionManager } from './session-manager';

// ============================================================================
// Permission Manager
// ============================================================================

export { PermissionManager } from './permission-manager';

// ============================================================================
// Worker Pool (Performance Optimization)
// ============================================================================

export {
  WorkerPool,
  getWorkerPool,
  terminateWorkerPool,
} from './workers';

export type {
  Task,
  TaskResult,
  WorkerStats,
  WorkerPoolConfig,
} from './workers';
