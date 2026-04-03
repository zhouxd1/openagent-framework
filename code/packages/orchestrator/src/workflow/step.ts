/**
 * @fileoverview Workflow Step
 * @description Defines workflow step functionality
 */

import {
  WorkflowStep,
  StepResult,
  WorkflowContext,
  RetryPolicy,
} from '../types';

/**
 * Step builder for creating workflow steps
 */
export class StepBuilder {
  private step: Partial<WorkflowStep> = {};

  /**
   * Set step ID
   */
  id(id: string): StepBuilder {
    this.step.id = id;
    return this;
  }

  /**
   * Set step name
   */
  name(name: string): StepBuilder {
    this.step.name = name;
    return this;
  }

  /**
   * Set agent ID
   */
  agent(agentId: string): StepBuilder {
    this.step.agentId = agentId;
    return this;
  }

  /**
   * Set task description
   */
  task(task: string): StepBuilder {
    this.step.task = task;
    return this;
  }

  /**
   * Add dependencies
   */
  dependsOn(...stepIds: string[]): StepBuilder {
    this.step.dependencies = stepIds;
    return this;
  }

  /**
   * Set condition function
   */
  condition(condition: (context: WorkflowContext) => boolean): StepBuilder {
    this.step.condition = condition;
    return this;
  }

  /**
   * Set retry policy
   */
  retry(policy: RetryPolicy): StepBuilder {
    this.step.retryPolicy = policy;
    return this;
  }

  /**
   * Set timeout
   */
  timeout(ms: number): StepBuilder {
    this.step.timeout = ms;
    return this;
  }

  /**
   * Build the step
   */
  build(): WorkflowStep {
    if (!this.step.id) {
      throw new Error('Step ID is required');
    }
    if (!this.step.agentId) {
      throw new Error('Agent ID is required');
    }
    if (!this.step.task) {
      throw new Error('Task description is required');
    }

    return this.step as WorkflowStep;
  }
}

/**
 * Create a new step builder
 */
export function step(): StepBuilder {
  return new StepBuilder();
}

/**
 * Step execution helper
 */
export class StepExecutor {
  /**
   * Check if step should be executed based on condition
   */
  static shouldExecute(step: WorkflowStep, context: WorkflowContext): boolean {
    if (!step.condition) {
      return true;
    }
    return step.condition(context);
  }

  /**
   * Check if step dependencies are met
   */
  static areDependenciesMet(
    step: WorkflowStep,
    context: WorkflowContext
  ): boolean {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }

    return step.dependencies.every(depId => {
      const result = context.results.get(depId);
      return result && result.status === 'completed';
    });
  }

  /**
   * Get failed dependencies
   */
  static getFailedDependencies(
    step: WorkflowStep,
    context: WorkflowContext
  ): string[] {
    if (!step.dependencies) {
      return [];
    }

    return step.dependencies.filter(depId => {
      const result = context.results.get(depId);
      return !result || result.status === 'failed';
    });
  }

  /**
   * Create a successful step result
   */
  static createSuccessResult(output: any, duration: number): StepResult {
    return {
      status: 'completed',
      output,
      duration,
    };
  }

  /**
   * Create a failed step result
   */
  static createFailedResult(error: string, duration: number): StepResult {
    return {
      status: 'failed',
      error,
      duration,
    };
  }

  /**
   * Create a skipped step result
   */
  static createSkippedResult(reason: string): StepResult {
    return {
      status: 'skipped',
      reason,
    };
  }
}
