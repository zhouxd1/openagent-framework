/**
 * @fileoverview Workflow Engine
 * @description Engine for creating, validating, and managing workflows
 */

import {
  Workflow,
  WorkflowStep,
  WorkflowDefinition,
  ValidationResult,
  CyclicDependencyError,
} from './types';
import { WorkflowHelper } from './workflow/workflow';

/**
 * Workflow execution plan
 */
export interface ExecutionPlan {
  /** Workflow ID */
  workflowId: string;
  /** Execution levels (parallelizable steps) */
  levels: WorkflowStep[][];
  /** Total steps */
  totalSteps: number;
  /** Maximum depth (longest path) */
  maxDepth: number;
}

/**
 * Custom error for cyclic dependencies
 */
export class CyclicDependencyDetectedError extends Error {
  constructor(message: string = 'Cyclic dependency detected') {
    super(message);
    this.name = 'CyclicDependencyDetectedError';
  }
}

/**
 * Workflow engine for managing workflow lifecycle
 */
export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();

  constructor() {}

  /**
   * Create a new workflow from definition
   */
  createWorkflow(definition: WorkflowDefinition): Workflow {
    const workflow = WorkflowHelper.fromDefinition(definition);
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  /**
   * Get a workflow by ID
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Update a workflow
   */
  updateWorkflow(
    workflowId: string,
    updates: Partial<WorkflowDefinition>
  ): Workflow {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const updated = WorkflowHelper.clone(workflow, updates);
    updated.updatedAt = new Date();
    
    this.workflows.set(workflowId, updated);
    return updated;
  }

  /**
   * Delete a workflow
   */
  deleteWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  /**
   * Validate a workflow
   */
  validateWorkflow(workflow: Workflow): ValidationResult {
    const errors: string[] = [];

    // 1. Check workflow has a name
    if (!workflow.name || workflow.name.trim().length === 0) {
      errors.push('Workflow name is required');
    }

    // 2. Check workflow has at least one step
    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    // 3. Check step ID uniqueness
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    // 4. Check that all dependencies exist
    for (const step of workflow.steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            errors.push(
              `Step ${step.id} depends on non-existent step ${depId}`
            );
          }
        }
      }
    }

    // 5. Check for cyclic dependencies
    if (this.hasCyclicDependency(workflow.steps)) {
      errors.push('Workflow contains cyclic dependencies');
    }

    // 6. Validate each step
    for (const step of workflow.steps) {
      const stepErrors = this.validateStep(step);
      errors.push(...stepErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single step
   */
  private validateStep(step: WorkflowStep): string[] {
    const errors: string[] = [];

    if (!step.id || step.id.trim().length === 0) {
      errors.push('Step ID is required');
    }

    if (!step.agentId || step.agentId.trim().length === 0) {
      errors.push(`Step ${step.id}: Agent ID is required`);
    }

    if (!step.task || step.task.trim().length === 0) {
      errors.push(`Step ${step.id}: Task description is required`);
    }

    if (step.dependencies && !Array.isArray(step.dependencies)) {
      errors.push(`Step ${step.id}: Dependencies must be an array`);
    }

    if (step.timeout && step.timeout < 0) {
      errors.push(`Step ${step.id}: Timeout must be positive`);
    }

    if (step.retryPolicy && step.retryPolicy.maxAttempts < 1) {
      errors.push(`Step ${step.id}: Retry policy must have at least 1 attempt`);
    }

    return errors;
  }

  /**
   * Get parallel execution levels
   */
  getParallelSteps(workflow: Workflow): WorkflowStep[][] {
    const levels: WorkflowStep[][] = [];
    const completed = new Set<string>();
    const remaining = [...workflow.steps];

    while (remaining.length > 0) {
      const level: WorkflowStep[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const step = remaining[i];

        // Check if all dependencies are completed
        const depsMet =
          !step.dependencies ||
          step.dependencies.every(dep => completed.has(dep));

        if (depsMet) {
          level.push(step);
          remaining.splice(i, 1);
        }
      }

      if (level.length === 0) {
        throw new CyclicDependencyDetectedError(
          'Cannot determine parallel levels - possible cyclic dependency'
        );
      }

      levels.push(level);
      level.forEach(step => completed.add(step.id));
    }

    return levels;
  }

  /**
   * Create an execution plan for a workflow
   */
  createExecutionPlan(workflow: Workflow): ExecutionPlan {
    // Validate first
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(
        `Invalid workflow: ${validation.errors.join(', ')}`
      );
    }

    const levels = this.getParallelSteps(workflow);

    return {
      workflowId: workflow.id,
      levels,
      totalSteps: workflow.steps.length,
      maxDepth: levels.length,
    };
  }

  /**
   * Check for cyclic dependencies using DFS
   */
  private hasCyclicDependency(steps: WorkflowStep[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) return true;
      if (visited.has(stepId)) return false;

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step?.dependencies) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (hasCycle(step.id)) return true;
    }

    return false;
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats(workflow: Workflow): {
    totalSteps: number;
    maxDepth: number;
    avgDependencies: number;
    hasFallback: boolean;
    stepWithMostDeps: string | null;
  } {
    const levels = this.getParallelSteps(workflow);
    const maxDeps = Math.max(
      ...workflow.steps.map(s => s.dependencies?.length || 0)
    );
    const stepWithMostDeps =
      maxDeps > 0
        ? workflow.steps.find(s => s.dependencies?.length === maxDeps)?.id ||
          null
        : null;

    const avgDeps =
      workflow.steps.reduce(
        (sum, s) => sum + (s.dependencies?.length || 0),
        0
      ) / workflow.steps.length;

    return {
      totalSteps: workflow.steps.length,
      maxDepth: levels.length,
      avgDependencies: avgDeps,
      hasFallback: workflow.fallback !== undefined,
      stepWithMostDeps,
    };
  }

  /**
   * Get all workflow IDs
   */
  getWorkflowIds(): string[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Clear all workflows
   */
  clearWorkflows(): void {
    this.workflows.clear();
  }

  /**
   * Generate a unique workflow ID
   */
  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
