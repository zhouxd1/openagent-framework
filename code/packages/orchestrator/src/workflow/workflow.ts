/**
 * @fileoverview Workflow Class
 * @description Workflow definition and management
 */

import {
  Workflow,
  WorkflowStep,
  WorkflowDefinition,
} from '../types';

/**
 * Workflow builder for creating workflows
 */
export class WorkflowBuilder {
  private workflow: Partial<Workflow> = {};
  private steps: WorkflowStep[] = [];
  private fallbackStep?: WorkflowStep;

  /**
   * Set workflow ID
   */
  id(id: string): WorkflowBuilder {
    this.workflow.id = id;
    return this;
  }

  /**
   * Set workflow name
   */
  name(name: string): WorkflowBuilder {
    this.workflow.name = name;
    return this;
  }

  /**
   * Set workflow description
   */
  description(description: string): WorkflowBuilder {
    this.workflow.description = description;
    return this;
  }

  /**
   * Add a step to the workflow
   */
  addStep(step: WorkflowStep): WorkflowBuilder {
    this.steps.push(step);
    return this;
  }

  /**
   * Add multiple steps to the workflow
   */
  addSteps(steps: WorkflowStep[]): WorkflowBuilder {
    this.steps.push(...steps);
    return this;
  }

  /**
   * Set fallback step
   */
  fallback(step: WorkflowStep): WorkflowBuilder {
    this.fallbackStep = step;
    return this;
  }

  /**
   * Set workflow metadata
   */
  metadata(metadata: Record<string, any>): WorkflowBuilder {
    this.workflow.metadata = metadata;
    return this;
  }

  /**
   * Build the workflow
   */
  build(): Workflow {
    if (!this.workflow.name) {
      throw new Error('Workflow name is required');
    }

    if (this.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    const now = new Date();

    return {
      id: this.workflow.id || this.generateId(),
      name: this.workflow.name,
      description: this.workflow.description,
      steps: this.steps,
      fallback: this.fallbackStep,
      metadata: this.workflow.metadata,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Generate a unique workflow ID
   */
  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a new workflow builder
 */
export function workflow(): WorkflowBuilder {
  return new WorkflowBuilder();
}

/**
 * Workflow helper functions
 */
export class WorkflowHelper {
  /**
   * Create workflow from definition
   */
  static fromDefinition(definition: WorkflowDefinition): Workflow {
    const builder = new WorkflowBuilder();

    builder.name(definition.name);

    if (definition.description) {
      builder.description(definition.description);
    }

    // Add steps with auto-generated IDs
    definition.steps.forEach((stepDef, index) => {
      builder.addStep({
        id: `step-${index + 1}`,
        ...stepDef,
      });
    });

    if (definition.fallback) {
      builder.fallback({
        id: 'fallback',
        ...definition.fallback,
      });
    }

    if (definition.metadata) {
      builder.metadata(definition.metadata);
    }

    return builder.build();
  }

  /**
   * Clone a workflow with optional modifications
   */
  static clone(
    original: Workflow,
    modifications?: Partial<WorkflowDefinition>
  ): Workflow {
    const cloned: Workflow = {
      ...original,
      steps: [...original.steps],
      metadata: { ...original.metadata },
      createdAt: original.createdAt,
      updatedAt: new Date(),
    };

    if (modifications) {
      if (modifications.name) {
        cloned.name = modifications.name;
      }
      if (modifications.description) {
        cloned.description = modifications.description;
      }
      if (modifications.metadata) {
        cloned.metadata = { ...cloned.metadata, ...modifications.metadata };
      }
    }

    return cloned;
  }

  /**
   * Get step by ID
   */
  static getStep(workflow: Workflow, stepId: string): WorkflowStep | undefined {
    return workflow.steps.find(s => s.id === stepId);
  }

  /**
   * Get all step IDs
   */
  static getStepIds(workflow: Workflow): string[] {
    return workflow.steps.map(s => s.id);
  }

  /**
   * Check if workflow has a specific step
   */
  static hasStep(workflow: Workflow, stepId: string): boolean {
    return workflow.steps.some(s => s.id === stepId);
  }

  /**
   * Get workflow summary
   */
  static getSummary(workflow: Workflow): string {
    const stepCount = workflow.steps.length;
    const hasFallback = workflow.fallback !== undefined;
    
    return `${workflow.name}: ${stepCount} steps${hasFallback ? ' (+ fallback)' : ''}`;
  }
}
