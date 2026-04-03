/**
 * ReAct (Reasoning + Acting) Agent Implementation
 * 
 * This agent uses the ReAct pattern:
 * 1. Thought: Reason about what to do next
 * 2. Action: Choose and execute a tool
 * 3. Observation: Observe the result
 * 4. Repeat until task is complete
 */

import { BaseAgent } from './base-agent';
import { AgentProvider, AgentContext, AgentResponse, AgentConfig, ReActStep } from './types';
import { Parameters, Metadata, JSONObject } from '../types';
import { generateId } from '../utils';

/**
 * ReAct Agent Configuration
 */
export interface ReActAgentConfig extends AgentConfig {
  mode: 'react';
  maxIterations?: number;
}

/**
 * ReAct Agent Implementation
 * 
 * Implements the ReAct pattern for reasoning and tool use
 */
export class ReActAgent extends BaseAgent {
  readonly id: string;
  readonly name: string;
  readonly provider: AgentProvider;
  private maxIterations: number;

  constructor(config: ReActAgentConfig) {
    super(config);
    this.id = config.id;
    this.name = config.name;
    this.provider = config.provider;
    this.maxIterations = config.maxIterations || 10;
  }

  /**
   * Execute the agent using ReAct pattern
   */
  async run(input: string, context?: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    this.updateState({ status: 'running', currentIteration: 0 });

    try {
      // Emit agent start event
      await this.emitEvent('agent:start', {
        input,
        sessionId: context?.sessionId,
        userId: context?.userId,
      });

      // Add user message to history
      this.addMessage({
        role: 'user',
        content: input,
      });

      // Execute ReAct loop
      const result = await this.executeReActLoop(input, context);

      const duration = Date.now() - startTime;
      this.updateState({ status: 'idle' });

      // Emit agent end event
      await this.emitEvent('agent:end', {
        duration,
        success: result.success,
        sessionId: context?.sessionId,
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          provider: this.provider,
          duration,
          iterations: this._state.currentIteration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateState({ status: 'error' });

      // Emit error event
      await this.emitEvent('error', {
        error: error instanceof Error ? error.message : String(error),
        duration,
        sessionId: context?.sessionId,
      });

      return this.createErrorResponse(error as Error, {
        duration,
        iterations: this._state.currentIteration,
      });
    }
  }

  /**
   * Execute the ReAct loop
   */
  private async executeReActLoop(
    input: string,
    context?: AgentContext
  ): Promise<AgentResponse> {
    let iteration = 0;
    const maxIterations = context?.maxIterations || this.maxIterations;

    while (iteration < maxIterations) {
      // Check if paused
      if (this._state.status === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      iteration++;
      this.updateState({ currentIteration: iteration });

      this.logger.debug('ReAct iteration', {
        iteration,
        maxIterations,
      });

      // Execute one ReAct step
      const step = await this.executeReActStep(input, iteration, context);

      // Check if we have a final answer
      if (step.observation && step.observation.includes('Final Answer:')) {
        const finalAnswer = this.extractFinalAnswer(step.observation);
        
        return {
          success: true,
          message: finalAnswer,
          metadata: {
            provider: this.provider,
            duration: 0,
            iterations: iteration,
            finishReason: 'stop',
          },
        };
      }

      // Check if no action was taken (task complete or stuck)
      if (!step.action) {
        return {
          success: true,
          message: step.thought || 'Task completed',
          metadata: {
            provider: this.provider,
            duration: 0,
            iterations: iteration,
            finishReason: 'stop',
          },
        };
      }
    }

    // Max iterations reached
    return {
      success: false,
      message: 'Maximum iterations reached without completing the task',
      metadata: {
        provider: this.provider,
        duration: 0,
        iterations: maxIterations,
        finishReason: 'max_iterations',
      },
    };
  }

  /**
   * Execute a single ReAct step
   * 
   * Note: This is a simplified implementation. In a real scenario,
   * this would call an LLM to generate thoughts and actions.
   */
  private async executeReActStep(
    input: string,
    iteration: number,
    context?: AgentContext
  ): Promise<ReActStep> {
    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Call the LLM with the current context
    // 2. Parse the response to extract Thought/Action/Action Input
    // 3. Execute the action if present
    // 4. Generate an observation

    const step: ReActStep = {
      thought: `Processing iteration ${iteration}`,
    };

    // For demonstration, we'll use a simple rule-based approach
    // In reality, this would be powered by an LLM
    
    // Check if we should take an action
    if (iteration === 1) {
      // First iteration: analyze the input
      step.thought = `Analyzing the input: "${input}"`;
      step.observation = 'Initial analysis complete. Ready to proceed.';
    } else {
      // Subsequent iterations
      step.thought = 'Task appears to be complete.';
      step.observation = 'Final Answer: Task completed successfully.';
    }

    // Add step to message history
    this.addMessage({
      role: 'assistant',
      content: `Thought: ${step.thought}\n${step.action ? `Action: ${step.action}\nAction Input: ${JSON.stringify(step.actionInput)}` : ''}\nObservation: ${step.observation}`,
    });

    return step;
  }

  /**
   * Extract final answer from observation
   */
  private extractFinalAnswer(observation: string): string {
    const match = observation.match(/Final Answer:\s*(.+)/);
    return match ? match[1].trim() : observation;
  }

  /**
   * Parse LLM response to extract ReAct components
   * 
   * Helper method for parsing LLM responses
   */
  protected parseReActResponse(response: string): ReActStep {
    const thoughtMatch = response.match(/Thought:\s*(.+?)(?=\n|$)/);
    const actionMatch = response.match(/Action:\s*(.+?)(?=\n|$)/);
    const actionInputMatch = response.match(/Action Input:\s*(.+?)(?=\n|$)/);
    const observationMatch = response.match(/Observation:\s*(.+?)(?=\n|$)/);

    const step: ReActStep = {
      thought: thoughtMatch ? thoughtMatch[1].trim() : '',
    };

    if (actionMatch) {
      step.action = actionMatch[1].trim();
    }

    if (actionInputMatch) {
      try {
        step.actionInput = JSON.parse(actionInputMatch[1].trim()) as JSONObject;
      } catch {
        // If JSON parse fails, wrap the string in an object
        step.actionInput = { value: actionInputMatch[1].trim() } as JSONObject;
      }
    }

    if (observationMatch) {
      step.observation = observationMatch[1].trim();
    }

    return step;
  }
}
