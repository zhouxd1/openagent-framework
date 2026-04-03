/**
 * @fileoverview Agent Orchestrator
 * @description Main orchestrator class for coordinating agent workflows
 */

import {
  Agent,
  Workflow,
  WorkflowStep,
  WorkflowContext,
  WorkflowResult,
  StepResult,
  AgentResult,
  OrchestratorConfig,
  RetryPolicy,
  WorkflowNotFoundError,
  AgentNotFoundError,
  DependencyNotMetError,
  CyclicDependencyError,
} from './types';
import { AgentCoordinator } from './agent-coordinator';
import { TaskScheduler } from './task-scheduler';
import { WorkflowEngine } from './workflow-engine';
import { MessageBus } from './communication/message-bus';
import { ContextManager } from './workflow/context';

/**
 * Orchestrator statistics
 */
export interface OrchestratorStats {
  /** Registered agents */
  totalAgents: number;
  /** Registered workflows */
  totalWorkflows: number;
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
}

/**
 * Agent Orchestrator - Main class for orchestrating agent workflows
 * 
 * @example
 * ```typescript
 * const orchestrator = new AgentOrchestrator({
 *   maxConcurrentAgents: 10,
 *   timeout: 30000,
 * });
 * 
 * // Register agents
 * orchestrator.registerAgent(agent1);
 * orchestrator.registerAgent(agent2);
 * 
 * // Register workflow
 * orchestrator.registerWorkflow(myWorkflow);
 * 
 * // Execute workflow
 * const result = await orchestrator.executeWorkflow('workflow-id', input);
 * ```
 */
export class AgentOrchestrator {
  private agents: Map<string, Agent>;
  private workflows: Map<string, Workflow>;
  private coordinator: AgentCoordinator;
  private scheduler: TaskScheduler;
  private workflowEngine: WorkflowEngine;
  private messageBus: MessageBus;
  private config: OrchestratorConfig;
  private stats: OrchestratorStats;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      maxConcurrentAgents: 10,
      timeout: 30000,
      retryPolicy: {
        maxAttempts: 3,
        backoff: 'exponential',
        delay: 1000,
      },
      ...config,
    };

    this.agents = new Map();
    this.workflows = new Map();
    this.messageBus = new MessageBus();
    this.coordinator = new AgentCoordinator(this.config, this.messageBus);
    this.scheduler = new TaskScheduler({
      maxConcurrent: this.config.maxConcurrentAgents,
      taskTimeout: this.config.timeout,
    });
    this.workflowEngine = new WorkflowEngine();

    this.stats = {
      totalAgents: 0,
      totalWorkflows: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
    };
  }

  /**
   * Register an agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.coordinator.registerAgent(agent);
    this.stats.totalAgents = this.agents.size;
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): boolean {
    const deleted = this.agents.delete(agentId);
    this.coordinator.unregisterAgent(agentId);
    this.stats.totalAgents = this.agents.size;
    return deleted;
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: Workflow): void {
    // Validate workflow
    const validation = this.workflowEngine.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
    }

    this.workflows.set(workflow.id, workflow);
    this.stats.totalWorkflows = this.workflows.size;
  }

  /**
   * Create and register a workflow from definition
   */
  createWorkflow(definition: {
    name: string;
    description?: string;
    steps: Omit<WorkflowStep, 'id'>[];
    fallback?: Omit<WorkflowStep, 'id'>;
    metadata?: Record<string, any>;
  }): Workflow {
    const workflow = this.workflowEngine.createWorkflow(definition);
    this.registerWorkflow(workflow);
    return workflow;
  }

  /**
   * Get a workflow by ID
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflow IDs
   */
  getWorkflowIds(): string[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    input: unknown,
    context?: Partial<WorkflowContext>
  ): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }

    const executionId = this.generateExecutionId();
    this.stats.totalExecutions++;

    // Prepare context
    const contextManager = new ContextManager(
      executionId,
      input,
      context?.metadata
    );

    // Topological sort steps
    const sortedSteps = this.topologicalSort(workflow.steps);

    try {
      // Execute steps
      for (const step of sortedSteps) {
        const result = await this.executeStep(step, contextManager.getContext());
        contextManager.setStepResult(step.id, result);

        // If step failed and no fallback, throw error
        if (result.status === 'failed') {
          throw new Error(`Step ${step.id} failed: ${result.error}`);
        }
      }

      this.stats.successfulExecutions++;

      return {
        executionId,
        status: 'completed',
        results: contextManager.getAllResults(),
      };
    } catch (error) {
      // Execute fallback if available
      if (workflow.fallback) {
        try {
          const fallbackResult = await this.executeStep(
            workflow.fallback,
            contextManager.getContext()
          );
          contextManager.setStepResult('fallback', fallbackResult);
        } catch (fallbackError) {
          console.error('Fallback execution failed:', fallbackError);
        }
      }

      this.stats.failedExecutions++;

      return {
        executionId,
        status: 'failed',
        results: contextManager.getAllResults(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeParallel(
    agentIds: string[],
    task: string,
    context?: WorkflowContext
  ): Promise<Map<string, AgentResult>> {
    const promises = agentIds.map(async agentId => {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new AgentNotFoundError(agentId);
      }

      try {
        const result = await agent.execute(task, context);
        return [agentId, result] as const;
      } catch (error) {
        return [
          agentId,
          {
            status: 'failed' as const,
            error: error instanceof Error ? error.message : String(error),
          },
        ] as const;
      }
    });

    const results = await Promise.allSettled(promises);

    return new Map(
      results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return [
            agentIds[index],
            {
              status: 'failed' as const,
              error: result.reason,
            },
          ];
        }
      })
    );
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 1. Check condition
      if (step.condition && !step.condition(context)) {
        return {
          status: 'skipped',
          reason: 'Condition not met',
        };
      }

      // 2. Check dependencies
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          const depResult = context.results.get(depId);
          if (!depResult || depResult.status === 'failed') {
            throw new DependencyNotMetError(step.id, depId);
          }
        }
      }

      // 3. Get agent
      const agent = this.agents.get(step.agentId);
      if (!agent) {
        throw new AgentNotFoundError(step.agentId);
      }

      // 4. Execute with retry
      const result = await this.retry(
        async () => agent.execute(step.task, context),
        step.retryPolicy || this.config.retryPolicy
      );

      return {
        status: 'completed',
        output: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Topological sort of workflow steps
   */
  private topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
    // Kahn's algorithm for topological sort
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Build graph
    for (const step of steps) {
      graph.set(step.id, []);
      inDegree.set(step.id, 0);
    }

    for (const step of steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          graph.get(depId)!.push(step.id);
          inDegree.set(step.id, inDegree.get(step.id)! + 1);
        }
      }
    }

    // Topological sort
    const queue: string[] = [];
    const sorted: WorkflowStep[] = [];

    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const step = steps.find(s => s.id === current)!;
      sorted.push(step);

      for (const neighbor of graph.get(current)!) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (sorted.length !== steps.length) {
      throw new CyclicDependencyError();
    }

    return sorted;
  }

  /**
   * Retry mechanism with exponential backoff
   */
  private async retry<T>(
    fn: () => Promise<T>,
    policy?: RetryPolicy
  ): Promise<T> {
    if (!policy) {
      return await fn();
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < policy.maxAttempts - 1) {
          const delay =
            policy.backoff === 'exponential'
              ? Math.pow(2, attempt) * (policy.delay || 1000)
              : policy.delay || 1000;

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): OrchestratorStats {
    return { ...this.stats };
  }

  /**
   * Get coordinator
   */
  getCoordinator(): AgentCoordinator {
    return this.coordinator;
  }

  /**
   * Get scheduler
   */
  getScheduler(): TaskScheduler {
    return this.scheduler;
  }

  /**
   * Get workflow engine
   */
  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine;
  }

  /**
   * Get message bus
   */
  getMessageBus(): MessageBus {
    return this.messageBus;
  }

  /**
   * Shutdown the orchestrator
   */
  shutdown(): void {
    this.scheduler.stop();
    this.messageBus.shutdown();
    this.agents.clear();
    this.workflows.clear();
  }
}
