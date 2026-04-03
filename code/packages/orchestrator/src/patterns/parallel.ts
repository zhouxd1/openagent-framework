/**
 * @fileoverview Parallel Pattern
 * @description Parallel execution pattern where multiple agents execute simultaneously
 */

import { Agent, AgentResult, WorkflowContext } from '../types';

/**
 * Parallel pattern configuration
 */
export interface ParallelConfig {
  /** Maximum number of concurrent agents */
  maxConcurrency?: number;
  /** Fail fast - return as soon as one agent fails */
  failFast?: boolean;
  /** Include all results even if some failed */
  includeAllResults?: boolean;
}

/**
 * Parallel execution result
 */
export interface ParallelResult {
  /** Overall status */
  status: 'completed' | 'partial' | 'failed';
  /** Map of agent ID to result */
  results: Map<string, AgentResult>;
  /** Number of successful executions */
  successfulCount: number;
  /** Number of failed executions */
  failedCount: number;
  /** Total execution time in milliseconds */
  duration: number;
}

/**
 * Parallel pattern - simultaneous execution
 * 
 * Use case: When multiple independent tasks can be executed simultaneously.
 * Examples:
 * - Parallel data analysis from multiple sources
 * - Concurrent API calls to different services
 * - Load balancing across multiple agents
 * - Voting/consensus mechanisms
 */
export class ParallelPattern {
  /**
   * Execute agents in parallel (simultaneously)
   * 
   * @param agents - Array of agents to execute in parallel
   * @param task - Task to execute
   * @param context - Optional workflow context
   * @param config - Optional parallel configuration
   * @returns Map of agent IDs to their results
   * 
   * @example
   * ```typescript
   * const results = await ParallelPattern.execute(
   *   [agent1, agent2, agent3],
   *   "Process this data",
   *   context,
   *   { maxConcurrency: 2 }
   * );
   * ```
   */
  static async execute(
    agents: Agent[],
    task: string,
    context?: WorkflowContext,
    config: ParallelConfig = {}
  ): Promise<ParallelResult> {
    if (agents.length === 0) {
      return {
        status: 'failed',
        results: new Map(),
        successfulCount: 0,
        failedCount: 0,
        duration: 0,
      };
    }

    const startTime = Date.now();
    const {
      maxConcurrency = agents.length,
      failFast = false,
      includeAllResults = true,
    } = config;

    const results = new Map<string, AgentResult>();
    let successfulCount = 0;
    let failedCount = 0;

    // If no concurrency limit, execute all at once
    if (maxConcurrency >= agents.length) {
      const promises = agents.map(async agent => {
        try {
          const result = await agent.execute(task, context);
          return [agent.id, result] as const;
        } catch (error) {
          return [agent.id, {
            status: 'failed' as const,
            error: error instanceof Error ? error.message : String(error),
          }] as const;
        }
      });

      if (failFast) {
        // Use Promise.race to detect failures early
        try {
          const settled = await Promise.allSettled(promises);
          settled.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              const [agentId, agentResult] = result.value;
              results.set(agentId, agentResult);
              if (agentResult.status === 'completed') {
                successfulCount++;
              } else {
                failedCount++;
              }
            } else {
              results.set(agents[index].id, {
                status: 'failed',
                error: result.reason,
              });
              failedCount++;
            }
          });
        } catch (error) {
          // This shouldn't happen with Promise.allSettled
        }
      } else {
        const settled = await Promise.allSettled(promises);
        settled.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const [agentId, agentResult] = result.value;
            results.set(agentId, agentResult);
            if (agentResult.status === 'completed') {
              successfulCount++;
            } else {
              failedCount++;
            }
          } else {
            results.set(agents[index].id, {
              status: 'failed',
              error: result.reason,
            });
            failedCount++;
          }
        });
      }
    } else {
      // Execute with concurrency limit
      const batches = this.createBatches(agents, maxConcurrency);
      
      for (const batch of batches) {
        const batchPromises = batch.map(async agent => {
          try {
            const result = await agent.execute(task, context);
            return [agent.id, result] as const;
          } catch (error) {
            return [agent.id, {
              status: 'failed' as const,
              error: error instanceof Error ? error.message : String(error),
            }] as const;
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            const [agentId, agentResult] = result.value;
            results.set(agentId, agentResult);
            if (agentResult.status === 'completed') {
              successfulCount++;
            } else {
              failedCount++;
            }
          }
        }

        // Stop if failFast and any failed
        if (failFast && failedCount > 0) {
          break;
        }
      }
    }

    const duration = Date.now() - startTime;
    const status = failedCount === 0 ? 'completed' :
                   successfulCount === 0 ? 'failed' : 'partial';

    return {
      status,
      results,
      successfulCount,
      failedCount,
      duration,
    };
  }

  /**
   * Race pattern - return the first result (successful or failed)
   * 
   * @param agents - Array of agents to race
   * @param task - Task to execute
   * @param context - Optional workflow context
   * @returns Result from the first agent to complete
   * 
   * @example
   * ```typescript
   * // Get the fastest response from multiple APIs
   * const result = await ParallelPattern.race(
   *   [fastAgent, backupAgent],
   *   "Fetch data"
   * );
   * ```
   */
  static async race(
    agents: Agent[],
    task: string,
    context?: WorkflowContext
  ): Promise<AgentResult> {
    if (agents.length === 0) {
      return {
        status: 'failed',
        error: 'No agents provided for race',
      };
    }

    const promises = agents.map(agent => agent.execute(task, context));

    try {
      return await Promise.race(promises);
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'All agents failed',
      };
    }
  }

  /**
   * All settled pattern - wait for all agents to complete (success or failure)
   * 
   * @param agents - Array of agents
   * @param task - Task to execute
   * @param context - Optional workflow context
   * @returns All results, regardless of success/failure
   */
  static async allSettled(
    agents: Agent[],
    task: string,
    context?: WorkflowContext
  ): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>();

    const promises = agents.map(async agent => {
      try {
        const result = await agent.execute(task, context);
        return [agent.id, result] as const;
      } catch (error) {
        return [agent.id, {
          status: 'failed' as const,
          error: error instanceof Error ? error.message : String(error),
        }] as const;
      }
    });

    const settled = await Promise.allSettled(promises);
    
    settled.forEach(result => {
      if (result.status === 'fulfilled') {
        const [agentId, agentResult] = result.value;
        results.set(agentId, agentResult);
      }
    });

    return results;
  }

  /**
   * First successful pattern - return the first successful result
   * 
   * @param agents - Array of agents
   * @param task - Task to execute
   * @param context - Optional workflow context
   * @param timeout - Maximum time to wait in milliseconds
   * @returns First successful result, or last failure if none succeed
   */
  static async firstSuccessful(
    agents: Agent[],
    task: string,
    context?: WorkflowContext,
    timeout?: number
  ): Promise<AgentResult> {
    if (agents.length === 0) {
      return {
        status: 'failed',
        error: 'No agents provided',
      };
    }

    let lastError: string | undefined;
    const promises = agents.map(async agent => {
      const result = await agent.execute(task, context);
      if (result.status === 'completed') {
        return result;
      }
      lastError = result.error;
      throw new Error(result.error || 'Agent failed');
    });

    try {
      if (timeout) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        );
        return await Promise.race([Promise.any(promises), timeoutPromise]);
      }
      return await Promise.any(promises);
    } catch (error) {
      return {
        status: 'failed',
        error: lastError || 'All agents failed',
      };
    }
  }

  /**
   * Create batches for limited concurrency
   */
  private static createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
