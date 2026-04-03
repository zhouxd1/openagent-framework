/**
 * @fileoverview Chain Pattern
 * @description Sequential execution pattern where agents execute one after another
 * Each agent's output becomes the next agent's input
 */

import { Agent, AgentResult, WorkflowContext } from '../types';

/**
 * Chain pattern configuration
 */
export interface ChainConfig {
  /** Stop execution if a step fails */
  stopOnFailure?: boolean;
  /** Include intermediate results in final output */
  includeIntermediateResults?: boolean;
}

/**
 * Chain execution result with detailed information
 */
export interface ChainResult extends AgentResult {
  /** Results from each agent in the chain */
  chainResults?: AgentResult[];
  /** Number of successful steps */
  successfulSteps?: number;
  /** Number of failed steps */
  failedSteps?: number;
}

/**
 * Chain pattern - sequential execution
 * 
 * Use case: When you need to process data through multiple stages where each stage's
 * output becomes the input for the next stage. Examples:
 * - Data processing pipeline (extract -> transform -> load)
 * - Content generation (outline -> draft -> refine -> polish)
 * - Analysis workflow (collect -> analyze -> summarize -> report)
 */
export class ChainPattern {
  /**
   * Execute agents in sequence, passing output from one to the next
   * 
   * @param agents - Array of agents to execute in order
   * @param task - Initial task/input for the first agent
   * @param context - Optional workflow context
   * @param config - Optional chain configuration
   * @returns Final result after all agents have executed
   * 
   * @example
   * ```typescript
   * const result = await ChainPattern.execute(
   *   [analyzerAgent, summarizerAgent, formatterAgent],
   *   "Analyze this data: ...",
   *   context,
   *   { stopOnFailure: true }
   * );
   * ```
   */
  static async execute(
    agents: Agent[],
    task: string,
    context?: WorkflowContext,
    config: ChainConfig = {}
  ): Promise<ChainResult> {
    if (agents.length === 0) {
      return {
        status: 'failed',
        error: 'No agents provided for chain execution',
      };
    }

    const {
      stopOnFailure = true,
      includeIntermediateResults = false,
    } = config;

    let currentInput: any = task;
    const chainResults: AgentResult[] = [];
    let successfulSteps = 0;
    let failedSteps = 0;
    let lastResult: AgentResult | null = null;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];

      try {
        // Execute the agent with the current input
        const result = await agent.execute(currentInput, context);
        chainResults.push(result);

        if (result.status === 'completed') {
          successfulSteps++;
          // Use the output as input for the next agent
          currentInput = result.output;
          lastResult = result;
        } else if (result.status === 'failed') {
          failedSteps++;
          if (stopOnFailure) {
            // Stop the chain on failure
            return {
              status: 'failed',
              error: `Chain stopped at agent ${i} (${agent.id}): ${result.error}`,
              chainResults: includeIntermediateResults ? chainResults : undefined,
              successfulSteps,
              failedSteps,
            };
          }
          // Continue with the original input if not stopping on failure
        } else if (result.status === 'skipped') {
          // Continue with the same input
          lastResult = result;
        }
      } catch (error) {
        failedSteps++;
        const errorResult: AgentResult = {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
        chainResults.push(errorResult);

        if (stopOnFailure) {
          return {
            status: 'failed',
            error: `Chain stopped at agent ${i} (${agent.id}): ${errorResult.error}`,
            chainResults: includeIntermediateResults ? chainResults : undefined,
            successfulSteps,
            failedSteps,
          };
        }
      }
    }

    // Determine final status
    const finalStatus = failedSteps === 0 ? 'completed' : 
                        successfulSteps === 0 ? 'failed' : 'completed';

    return {
      status: finalStatus,
      output: lastResult?.output,
      error: failedSteps > 0 ? `${failedSteps} steps failed` : undefined,
      chainResults: includeIntermediateResults ? chainResults : undefined,
      successfulSteps,
      failedSteps,
    };
  }

  /**
   * Execute a chain with a transformer function between steps
   * 
   * @param agents - Array of agents to execute
   * @param task - Initial task
   * @param transformer - Function to transform output between steps
   * @param context - Optional workflow context
   */
  static async executeWithTransform(
    agents: Agent[],
    task: string,
    transformer: (output: any, agentIndex: number) => string,
    context?: WorkflowContext
  ): Promise<ChainResult> {
    if (agents.length === 0) {
      return {
        status: 'failed',
        error: 'No agents provided for chain execution',
      };
    }

    let currentInput: any = task;
    const chainResults: AgentResult[] = [];

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const result = await agent.execute(currentInput, context);
      chainResults.push(result);

      if (result.status === 'failed') {
        return {
          status: 'failed',
          error: `Chain failed at agent ${i} (${agent.id}): ${result.error}`,
          chainResults,
          successfulSteps: i,
          failedSteps: 1,
        };
      }

      // Transform the output for the next agent
      if (i < agents.length - 1) {
        currentInput = transformer(result.output, i);
      }
    }

    const lastResult = chainResults[chainResults.length - 1];
    return {
      status: 'completed',
      output: lastResult.output,
      chainResults,
      successfulSteps: agents.length,
      failedSteps: 0,
    };
  }
}
