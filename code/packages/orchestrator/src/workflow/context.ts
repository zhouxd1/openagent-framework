/**
 * @fileoverview Workflow Context
 * @description Manages execution context for workflows
 */

import { WorkflowContext, StepResult } from '../types';

/**
 * Workflow context manager
 */
export class ContextManager {
  private context: WorkflowContext;

  /**
   * Create a new context manager
   */
  constructor(executionId: string, input: unknown, metadata?: Record<string, any>) {
    this.context = {
      executionId,
      input,
      results: new Map<string, StepResult>(),
      metadata,
    };
  }

  /**
   * Get the workflow context
   */
  getContext(): WorkflowContext {
    return this.context;
  }

  /**
   * Set a step result
   */
  setStepResult(stepId: string, result: StepResult): void {
    this.context.results.set(stepId, result);
  }

  /**
   * Get a step result
   */
  getStepResult(stepId: string): StepResult | undefined {
    return this.context.results.get(stepId);
  }

  /**
   * Check if a step has been completed
   */
  isStepCompleted(stepId: string): boolean {
    const result = this.context.results.get(stepId);
    return result?.status === 'completed';
  }

  /**
   * Check if a step has failed
   */
  isStepFailed(stepId: string): boolean {
    const result = this.context.results.get(stepId);
    return result?.status === 'failed';
  }

  /**
   * Get all step results
   */
  getAllResults(): Map<string, StepResult> {
    return this.context.results;
  }

  /**
   * Update context metadata
   */
  updateMetadata(metadata: Record<string, any>): void {
    this.context.metadata = {
      ...this.context.metadata,
      ...metadata,
    };
  }

  /**
   * Get execution ID
   */
  getExecutionId(): string {
    return this.context.executionId;
  }

  /**
   * Get workflow input
   */
  getInput(): unknown {
    return this.context.input;
  }

  /**
   * Create a snapshot of the current context
   */
  createSnapshot(): WorkflowContext {
    return {
      ...this.context,
      results: new Map(this.context.results),
    };
  }
}
