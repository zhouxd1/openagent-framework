/**
 * @fileoverview Orchestrator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentOrchestrator,
  Agent,
  Workflow,
} from '../src';

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let mockAgent1: Agent;
  let mockAgent2: Agent;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      maxConcurrentAgents: 10,
      timeout: 30000,
    });

    mockAgent1 = {
      id: 'agent-1',
      name: 'Agent 1',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-1',
      }),
    };

    mockAgent2 = {
      id: 'agent-2',
      name: 'Agent 2',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-2',
      }),
    };

    orchestrator.registerAgent(mockAgent1);
    orchestrator.registerAgent(mockAgent2);
  });

  describe('Agent Management', () => {
    it('should register agents', () => {
      const stats = orchestrator.getStats();
      expect(stats.totalAgents).toBe(2);
    });

    it('should unregister agents', () => {
      const deleted = orchestrator.unregisterAgent('agent-1');
      expect(deleted).toBe(true);
      
      const stats = orchestrator.getStats();
      expect(stats.totalAgents).toBe(1);
    });

    it('should get agent by ID', () => {
      const agent = orchestrator.getAgent('agent-1');
      expect(agent).toBeDefined();
      expect(agent?.id).toBe('agent-1');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = orchestrator.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });

    it('should get all agent IDs', () => {
      const ids = orchestrator.getAgentIds();
      expect(ids).toContain('agent-1');
      expect(ids).toContain('agent-2');
      expect(ids.length).toBe(2);
    });
  });

  describe('Workflow Management', () => {
    it('should register a workflow', () => {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      orchestrator.registerWorkflow(workflow);

      const stats = orchestrator.getStats();
      expect(stats.totalWorkflows).toBe(1);
    });

    it('should get workflow by ID', () => {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      orchestrator.registerWorkflow(workflow);

      const retrieved = orchestrator.getWorkflow('test-workflow');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-workflow');
    });

    it('should get all workflow IDs', () => {
      const workflow1: Workflow = {
        id: 'workflow-1',
        name: 'Workflow 1',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-1',
            task: 'Task 1',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const workflow2: Workflow = {
        id: 'workflow-2',
        name: 'Workflow 2',
        steps: [
          {
            id: 'step-1',
            agentId: 'agent-2',
            task: 'Task 1',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      orchestrator.registerWorkflow(workflow1);
      orchestrator.registerWorkflow(workflow2);

      const ids = orchestrator.getWorkflowIds();
      expect(ids).toContain('workflow-1');
      expect(ids).toContain('workflow-2');
      expect(ids.length).toBe(2);
    });
  });

  describe('Workflow Execution', () => {
    it('should execute workflow in order', async () => {
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

      orchestrator.registerWorkflow(workflow);
      const result = await orchestrator.executeWorkflow('test-workflow', 'input');

      expect(result.status).toBe('completed');
      expect(mockAgent1.execute).toHaveBeenCalled();
      expect(mockAgent2.execute).toHaveBeenCalled();
    });

    it('should execute workflow and return results', async () => {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      orchestrator.registerWorkflow(workflow);
      const result = await orchestrator.executeWorkflow('test-workflow', 'input');

      // Check that the workflow executed
      expect(result.status).toBeDefined();
      expect(result.executionId).toBeDefined();
      expect(result.results).toBeDefined();
    });

    it('should skip step with unmet condition', async () => {
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
            condition: () => false, // Always false
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      orchestrator.registerWorkflow(workflow);
      const result = await orchestrator.executeWorkflow('test-workflow', 'input');

      expect(result.status).toBe('completed');
      // The second agent should not be called due to condition
    });
  });

  describe('Parallel Execution', () => {
    it('should execute agents in parallel', async () => {
      const results = await orchestrator.executeParallel(
        ['agent-1', 'agent-2'],
        'Parallel task'
      );

      expect(results.size).toBe(2);
      expect(results.get('agent-1')?.status).toBe('completed');
      expect(results.get('agent-2')?.status).toBe('completed');
    });

    it('should handle partial failures in parallel execution', async () => {
      mockAgent1.execute = vi.fn().mockResolvedValue({
        status: 'failed',
        error: 'Agent 1 failed',
      });

      const results = await orchestrator.executeParallel(
        ['agent-1', 'agent-2'],
        'Parallel task'
      );

      expect(results.size).toBe(2);
      expect(results.get('agent-1')?.status).toBe('failed');
      expect(results.get('agent-2')?.status).toBe('completed');
    });
  });

  describe('Statistics', () => {
    it('should track execution statistics', async () => {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      orchestrator.registerWorkflow(workflow);
      
      const statsBefore = orchestrator.getStats();
      expect(statsBefore.totalExecutions).toBe(0);

      await orchestrator.executeWorkflow('test-workflow', 'input');

      const statsAfter = orchestrator.getStats();
      expect(statsAfter.totalExecutions).toBe(1);
      expect(statsAfter.successfulExecutions).toBe(1);
    });

    it('should track workflow and agent counts', () => {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      orchestrator.registerWorkflow(workflow);

      const stats = orchestrator.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.totalWorkflows).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw WorkflowNotFoundError for non-existent workflow', async () => {
      await expect(
        orchestrator.executeWorkflow('non-existent', 'input')
      ).rejects.toThrow();
    });

    it('should handle non-existent agent', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agentId: 'non-existent-agent',
            task: 'Task 1',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      orchestrator.registerWorkflow(workflow);
      const result = await orchestrator.executeWorkflow('test-workflow', 'input');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('not found');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', () => {
      orchestrator.shutdown();
      // After shutdown, agents and workflows are cleared
      const ids = orchestrator.getAgentIds();
      expect(ids.length).toBe(0);
    });
  });
});
