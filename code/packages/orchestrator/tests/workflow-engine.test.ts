/**
 * @fileoverview Workflow Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine } from '../src/workflow-engine';
import { Workflow, WorkflowStep } from '../src/types';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('Workflow Creation', () => {
    it('should create a workflow from definition', () => {
      const workflow = engine.createWorkflow({
        name: 'Test Workflow',
        description: 'A test workflow',
        steps: [
          {
            agentId: 'agent-1',
            task: 'Task 1',
          },
          {
            agentId: 'agent-2',
            task: 'Task 2',
            dependencies: ['step-1'],
          },
        ],
      });

      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.steps.length).toBe(2);
      expect(workflow.id).toMatch(/^wf_/);
    });

    it('should get a workflow by ID', () => {
      const workflow = engine.createWorkflow({
        name: 'Test Workflow',
        steps: [
          {
            agentId: 'agent-1',
            task: 'Task 1',
          },
        ],
      });

      const retrieved = engine.getWorkflow(workflow.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(workflow.id);
    });

    it('should return undefined for non-existent workflow', () => {
      const workflow = engine.getWorkflow('non-existent');
      expect(workflow).toBeUndefined();
    });

    it('should get all workflow IDs', () => {
      engine.createWorkflow({
        name: 'Workflow 1',
        steps: [{ agentId: 'agent-1', task: 'Task' }],
      });

      engine.createWorkflow({
        name: 'Workflow 2',
        steps: [{ agentId: 'agent-2', task: 'Task' }],
      });

      const ids = engine.getWorkflowIds();
      expect(ids.length).toBe(2);
    });
  });

  describe('Workflow Validation', () => {
    it('should validate a correct workflow', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Task 2',
            dependencies: ['step-1'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = engine.validateWorkflow(workflow);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect duplicate step IDs', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
          },
          {
            id: 'step-1', // Duplicate
            agentId: 'agent-2',
            task: 'Task 2',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = engine.validateWorkflow(workflow);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Duplicate step ID: step-1');
    });

    it('should detect missing dependencies', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Task 2',
            dependencies: ['non-existent'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = engine.validateWorkflow(workflow);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('non-existent'))).toBe(true);
    });

    it('should detect cyclic dependencies', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
            dependencies: ['step-2'],
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Task 2',
            dependencies: ['step-1'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = engine.validateWorkflow(workflow);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('cyclic'))).toBe(true);
    });

    it('should validate required step fields', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: '',
            agentId: '',
            task: '',
          } as WorkflowStep,
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = engine.validateWorkflow(workflow);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Parallel Step Analysis', () => {
    it('should identify parallelizable steps', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Task 2',
          },
          {
            id: 'step-3',
            agentId: 'agent-3',
            task: 'Task 3',
            dependencies: ['step-1', 'step-2'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const parallelSteps = engine.getParallelSteps(workflow);
      expect(parallelSteps.length).toBe(2);
      expect(parallelSteps[0].length).toBe(2); // step-1 and step-2
      expect(parallelSteps[1].length).toBe(1); // step-3
    });

    it('should handle sequential workflow', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Task 2',
            dependencies: ['step-1'],
          },
          {
            id: 'step-3',
            agentId: 'agent-3',
            task: 'Task 3',
            dependencies: ['step-2'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const parallelSteps = engine.getParallelSteps(workflow);
      expect(parallelSteps.length).toBe(3);
      expect(parallelSteps[0].length).toBe(1);
      expect(parallelSteps[1].length).toBe(1);
      expect(parallelSteps[2].length).toBe(1);
    });

    it('should throw error for cyclic dependencies in parallel analysis', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
            dependencies: ['step-2'],
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Task 2',
            dependencies: ['step-1'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => engine.getParallelSteps(workflow)).toThrow();
    });
  });

  describe('Workflow Statistics', () => {
    it('should calculate workflow statistics', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
          },
          {
            id: 'step-2',
            agentId: 'agent-2',
            task: 'Task 2',
          },
          {
            id: 'step-3',
            agentId: 'agent-3',
            task: 'Task 3',
            dependencies: ['step-1', 'step-2'],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const stats = engine.getWorkflowStats(workflow);
      expect(stats.totalSteps).toBe(3);
      expect(stats.maxDepth).toBe(2);
      expect(stats.hasFallback).toBe(false);
    });

    it('should detect fallback step', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
          },
        ],
        fallback: {
          id: 'fallback',
          agentId: 'fallback-agent',
          task: 'Fallback task',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const stats = engine.getWorkflowStats(workflow);
      expect(stats.hasFallback).toBe(true);
    });
  });

  describe('Workflow Updates', () => {
    it('should update a workflow', () => {
      const workflow = engine.createWorkflow({
        name: 'Original Name',
        steps: [
          {
            agentId: 'agent-1',
            task: 'Task',
          },
        ],
      });

      const updated = engine.updateWorkflow(workflow.id, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        workflow.createdAt.getTime()
      );
    });

    it('should delete a workflow', () => {
      const workflow = engine.createWorkflow({
        name: 'Test Workflow',
        steps: [
          {
            agentId: 'agent-1',
            task: 'Task',
          },
        ],
      });

      const deleted = engine.deleteWorkflow(workflow.id);
      expect(deleted).toBe(true);
      expect(engine.getWorkflow(workflow.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent workflow', () => {
      const deleted = engine.deleteWorkflow('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Workflow Clearing', () => {
    it('should clear all workflows', () => {
      engine.createWorkflow({
        name: 'Workflow 1',
        steps: [{ agentId: 'agent-1', task: 'Task' }],
      });

      engine.createWorkflow({
        name: 'Workflow 2',
        steps: [{ agentId: 'agent-2', task: 'Task' }],
      });

      expect(engine.getWorkflowIds().length).toBe(2);

      engine.clearWorkflows();

      expect(engine.getWorkflowIds().length).toBe(0);
    });
  });
});
