/**
 * @fileoverview Supervisor Pattern
 * @description Hierarchical pattern where a supervisor coordinates multiple worker agents
 */

import { Agent, AgentResult, WorkflowContext } from '../types';

/**
 * Supervisor pattern configuration
 */
export interface SupervisorConfig {
  /** Maximum number of subtasks */
  maxSubtasks?: number;
  /** Execute subtasks in parallel */
  parallelExecution?: boolean;
  /** Include worker results in final output */
  includeWorkerResults?: boolean;
  /** Custom subtask parser */
  subtaskParser?: (decomposition: string) => string[];
}

/**
 * Subtask definition
 */
export interface Subtask {
  /** Subtask ID */
  id: string;
  /** Subtask description */
  description: string;
  /** Assigned worker ID */
  workerId: string;
  /** Subtask result */
  result?: AgentResult;
}

/**
 * Supervisor execution result
 */
export interface SupervisorResult extends AgentResult {
  /** Number of subtasks created */
  subtaskCount?: number;
  /** Number of successful subtasks */
  successfulSubtasks?: number;
  /** Number of failed subtasks */
  failedSubtasks?: number;
  /** Worker results by subtask */
  workerResults?: Map<string, AgentResult>;
}

/**
 * Supervisor pattern - hierarchical coordination
 * 
 * Use case: When a complex task needs to be decomposed and coordinated.
 * Examples:
 * - Project management (plan -> assign -> monitor -> integrate)
 * - Complex analysis (decompose -> analyze parts -> synthesize)
 * - Large-scale data processing (split -> process chunks -> merge)
 * - Multi-domain problems (coordinate domain experts)
 */
export class SupervisorPattern {
  /**
   * Execute supervisor pattern
   * 
   * @param supervisor - Supervisor agent that coordinates work
   * @param workers - Array of worker agents
   * @param task - Task to execute
   * @param context - Optional workflow context
   * @param config - Optional configuration
   * @returns Result from supervisor after coordinating workers
   * 
   * @example
   * ```typescript
   * const result = await SupervisorPattern.execute(
   *   managerAgent,
   *   [worker1, worker2, worker3],
   *   "Develop a comprehensive market analysis",
   *   context,
   *   { parallelExecution: true }
   * );
   * ```
   */
  static async execute(
    supervisor: Agent,
    workers: Agent[],
    task: string,
    context?: WorkflowContext,
    config: SupervisorConfig = {}
  ): Promise<SupervisorResult> {
    if (workers.length === 0) {
      return {
        status: 'failed',
        error: 'No workers available',
      };
    }

    const {
      maxSubtasks = 10,
      parallelExecution = true,
      includeWorkerResults = true,
      subtaskParser = this.defaultSubtaskParser,
    } = config;

    try {
      // Step 1: Supervisor decomposes the task
      const decompositionPrompt = `Decompose this task into ${Math.min(maxSubtasks, workers.length * 2)} specific subtasks. Format each subtask on a new line starting with "-". Task: ${task}`;
      
      const decomposition = await supervisor.execute(decompositionPrompt, context);
      
      if (decomposition.status !== 'completed') {
        return {
          status: 'failed',
          error: `Supervisor failed to decompose task: ${decomposition.error}`,
        };
      }

      // Step 2: Parse subtasks
      const subtaskDescriptions = subtaskParser(decomposition.output);
      
      if (subtaskDescriptions.length === 0) {
        return {
          status: 'failed',
          error: 'No subtasks were generated',
        };
      }

      const subtasks: Subtask[] = subtaskDescriptions.map((desc, index) => ({
        id: `subtask-${index + 1}`,
        description: desc,
        workerId: workers[index % workers.length].id,
      }));

      // Step 3: Assign and execute subtasks
      const workerResults = new Map<string, AgentResult>();
      let successfulSubtasks = 0;
      let failedSubtasks = 0;

      if (parallelExecution) {
        // Execute in parallel
        const promises = subtasks.map(async subtask => {
          const worker = workers.find(w => w.id === subtask.workerId);
          if (!worker) {
            return [subtask.id, {
              status: 'failed' as const,
              error: `Worker ${subtask.workerId} not found`,
            }] as const;
          }

          try {
            const result = await worker.execute(subtask.description, context);
            subtask.result = result;
            return [subtask.id, result] as const;
          } catch (error) {
            const result: AgentResult = {
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            };
            subtask.result = result;
            return [subtask.id, result] as const;
          }
        });

        const results = await Promise.allSettled(promises);
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            const [subtaskId, agentResult] = result.value;
            workerResults.set(subtaskId, agentResult);
            if (agentResult.status === 'completed') {
              successfulSubtasks++;
            } else {
              failedSubtasks++;
            }
          }
        });
      } else {
        // Execute sequentially
        for (const subtask of subtasks) {
          const worker = workers.find(w => w.id === subtask.workerId);
          if (!worker) {
            workerResults.set(subtask.id, {
              status: 'failed',
              error: `Worker ${subtask.workerId} not found`,
            });
            failedSubtasks++;
            continue;
          }

          try {
            const result = await worker.execute(subtask.description, context);
            subtask.result = result;
            workerResults.set(subtask.id, result);
            if (result.status === 'completed') {
              successfulSubtasks++;
            } else {
              failedSubtasks++;
            }
          } catch (error) {
            const result: AgentResult = {
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            };
            subtask.result = result;
            workerResults.set(subtask.id, result);
            failedSubtasks++;
          }
        }
      }

      // Step 4: Supervisor synthesizes results
      const synthesisPrompt = `Synthesize the following subtask results into a comprehensive final result:
${Array.from(workerResults.entries())
  .map(([id, result]) => `${id}: ${result.status === 'completed' ? result.output : 'FAILED: ' + result.error}`)
  .join('\n')}`;

      const synthesis = await supervisor.execute(synthesisPrompt, context);

      if (synthesis.status !== 'completed') {
        return {
          status: 'partial',
          error: `Supervisor failed to synthesize results: ${synthesis.error}`,
          subtaskCount: subtasks.length,
          successfulSubtasks,
          failedSubtasks,
          workerResults: includeWorkerResults ? workerResults : undefined,
        };
      }

      return {
        status: failedSubtasks === 0 ? 'completed' : 'partial',
        output: synthesis.output,
        subtaskCount: subtasks.length,
        successfulSubtasks,
        failedSubtasks,
        workerResults: includeWorkerResults ? workerResults : undefined,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute with iterative refinement
   */
  static async executeWithRefinement(
    supervisor: Agent,
    workers: Agent[],
    task: string,
    context?: WorkflowContext,
    options?: {
      maxIterations?: number;
      qualityThreshold?: number;
    }
  ): Promise<SupervisorResult> {
    const maxIterations = options?.maxIterations || 3;
    const qualityThreshold = options?.qualityThreshold || 0.8;
    
    let iteration = 0;
    let lastResult: SupervisorResult | null = null;

    while (iteration < maxIterations) {
      const result = await this.execute(supervisor, workers, task, context);
      lastResult = result;

      // Check quality
      const successRate = result.subtaskCount && result.successfulSubtasks
        ? result.successfulSubtasks / result.subtaskCount
        : 0;

      if (successRate >= qualityThreshold || result.status === 'completed') {
        return result;
      }

      // Prepare for next iteration
      const reviewPrompt = `Review and improve this result. Current success rate: ${successRate}. Previous output: ${result.output}`;
      task = reviewPrompt;
      iteration++;
    }

    return lastResult || {
      status: 'failed',
      error: 'Max iterations reached without achieving quality threshold',
    };
  }

  /**
   * Default subtask parser
   */
  private static defaultSubtaskParser(decomposition: string): string[] {
    return decomposition
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove common prefixes
        return line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
      })
      .filter(line => line.length > 0);
  }
}

/**
 * Hierarchical supervisor pattern with multiple levels
 */
export class HierarchicalSupervisor {
  /**
   * Execute with multiple levels of supervision
   */
  static async execute(
    levels: Array<{
      supervisor: Agent;
      workers: Agent[];
    }>,
    task: string,
    context?: WorkflowContext
  ): Promise<AgentResult> {
    if (levels.length === 0) {
      return {
        status: 'failed',
        error: 'No supervision levels provided',
      };
    }

    let currentTask = task;

    // Execute from top to bottom
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const result = await SupervisorPattern.execute(
        level.supervisor,
        level.workers,
        currentTask,
        context
      );

      if (result.status !== 'completed' && i < levels.length - 1) {
        return {
          status: 'failed',
          error: `Level ${i + 1} failed: ${result.error}`,
        };
      }

      currentTask = result.output || '';
    }

    return {
      status: 'completed',
      output: currentTask,
    };
  }
}
