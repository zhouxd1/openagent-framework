/**
 * @fileoverview Agent Orchestrator Type Definitions
 * @description Core types and interfaces for the agent orchestration system
 */

/**
 * Agent interface representing a single agent in the system
 */
export interface Agent {
  /** Unique identifier for the agent */
  id: string;
  /** Optional human-readable name */
  name?: string;
  /** Execute a task and return the result */
  execute(task: string, context?: WorkflowContext): Promise<AgentResult>;
}

/**
 * Result of an agent execution
 */
export interface AgentResult {
  /** Execution status */
  status: 'completed' | 'failed' | 'skipped' | 'partial';
  /** Output data from the execution */
  output?: any;
  /** Error message if execution failed */
  error?: string;
  /** Additional metadata about the execution */
  metadata?: Record<string, any>;
}

/**
 * Workflow definition
 */
export interface Workflow {
  /** Unique identifier for the workflow */
  id: string;
  /** Human-readable workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Array of workflow steps */
  steps: WorkflowStep[];
  /** Fallback step executed when the workflow fails */
  fallback?: WorkflowStep;
  /** Additional workflow metadata */
  metadata?: Record<string, any>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Unique identifier for the step */
  id: string;
  /** Optional human-readable step name */
  name?: string;
  /** ID of the agent to execute this step */
  agentId: string;
  /** Task description for the agent */
  task: string;
  /** IDs of steps that must complete before this step */
  dependencies?: string[];
  /** Conditional function to determine if step should execute */
  condition?: (context: WorkflowContext) => boolean;
  /** Retry policy for this step */
  retryPolicy?: RetryPolicy;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  /** Unique execution identifier */
  executionId: string;
  /** Input data for the workflow */
  input: unknown;
  /** Map of step ID to step result */
  results: Map<string, StepResult>;
  /** Additional context metadata */
  metadata?: Record<string, any>;
}

/**
 * Result of a workflow step execution
 */
export interface StepResult {
  /** Execution status */
  status: 'completed' | 'failed' | 'skipped' | 'partial';
  /** Output data from the step */
  output?: any;
  /** Error message if step failed */
  error?: string;
  /** Reason for skipping the step */
  reason?: string;
  /** Duration of execution in milliseconds */
  duration?: number;
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult {
  /** Unique execution identifier */
  executionId: string;
  /** Overall workflow status */
  status: 'completed' | 'failed' | 'partial';
  /** Map of step ID to step result */
  results: Map<string, StepResult>;
  /** Error message if workflow failed */
  error?: string;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Backoff strategy */
  backoff?: 'fixed' | 'exponential';
  /** Base delay in milliseconds */
  delay?: number;
}

/**
 * Workflow definition input (used when creating workflows)
 */
export interface WorkflowDefinition {
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Array of step definitions */
  steps: Omit<WorkflowStep, 'id'>[];
  /** Fallback step definition */
  fallback?: Omit<WorkflowStep, 'id'>;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Result of workflow validation
 */
export interface ValidationResult {
  /** Whether the workflow is valid */
  valid: boolean;
  /** Array of validation errors */
  errors: string[];
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Maximum number of concurrent agents */
  maxConcurrentAgents?: number;
  /** Default timeout for operations in milliseconds */
  timeout?: number;
  /** Default retry policy */
  retryPolicy?: RetryPolicy;
}

/**
 * Agent message for communication
 */
export interface AgentMessage {
  /** Unique message identifier */
  id: string;
  /** Sender agent ID */
  from: string;
  /** Recipient agent ID (optional for broadcast) */
  to?: string;
  /** Message type */
  type: 'task' | 'result' | 'query' | 'response' | 'error' | 'heartbeat';
  /** Message payload */
  payload: any;
  /** Message timestamp */
  timestamp: Date;
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: AgentMessage) => Promise<void>;

/**
 * Router configuration for routing pattern
 */
export interface RouterConfig {
  /** Condition function to determine if this router should handle the task */
  condition: (task: string, context?: WorkflowContext) => boolean;
  /** Agent to handle the task if condition is met */
  agent: Agent;
}

/**
 * Task definition for scheduling
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Task description */
  description: string;
  /** Agent ID to execute the task */
  agentId: string;
  /** Task priority (higher = more urgent) */
  priority: number;
  /** Task status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Scheduled execution time */
  scheduledAt?: Date;
  /** Task creation timestamp */
  createdAt: Date;
  /** Task metadata */
  metadata?: Record<string, any>;
}

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Error thrown when a workflow is not found
 */
export class WorkflowNotFoundError extends Error {
  constructor(workflowId: string) {
    super(`Workflow not found: ${workflowId}`);
    this.name = 'WorkflowNotFoundError';
  }
}

/**
 * Error thrown when an agent is not found
 */
export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = 'AgentNotFoundError';
  }
}

/**
 * Error thrown when a dependency is not met
 */
export class DependencyNotMetError extends Error {
  constructor(stepId: string, depId: string) {
    super(`Dependency ${depId} not met for step ${stepId}`);
    this.name = 'DependencyNotMetError';
  }
}

/**
 * Error thrown when cyclic dependencies are detected
 */
export class CyclicDependencyError extends Error {
  constructor(message: string = 'Cyclic dependency detected') {
    super(message);
    this.name = 'CyclicDependencyError';
  }
}

/**
 * Error thrown when a channel is not found
 */
export class ChannelNotFoundError extends Error {
  constructor(channelId: string) {
    super(`Channel not found: ${channelId}`);
    this.name = 'ChannelNotFoundError';
  }
}

/**
 * Error thrown when a task is not found
 */
export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}
