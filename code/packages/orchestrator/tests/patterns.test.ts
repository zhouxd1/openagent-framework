/**
 * @fileoverview Orchestration Patterns Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, AgentResult } from '../src/types';
import { ChainPattern } from '../src/patterns/chain';
import { ParallelPattern } from '../src/patterns/parallel';
import { RouterPattern, ContentRouter, LoadBalancerRouter } from '../src/patterns/router';
import { SupervisorPattern } from '../src/patterns/supervisor';

describe('ChainPattern', () => {
  let agent1: Agent;
  let agent2: Agent;
  let agent3: Agent;

  beforeEach(() => {
    agent1 = {
      id: 'agent-1',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-1',
      }),
    };

    agent2 = {
      id: 'agent-2',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-2',
      }),
    };

    agent3 = {
      id: 'agent-3',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-3',
      }),
    };
  });

  it('should execute agents in sequence', async () => {
    const result = await ChainPattern.execute(
      [agent1, agent2, agent3],
      'initial task'
    );

    expect(result.status).toBe('completed');
    expect(result.output).toBe('result-3');
    expect(agent1.execute).toHaveBeenCalledWith('initial task', undefined);
    expect(agent2.execute).toHaveBeenCalledWith('result-1', undefined);
    expect(agent3.execute).toHaveBeenCalledWith('result-2', undefined);
  });

  it('should stop on failure with stopOnFailure option', async () => {
    agent2.execute = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'Agent 2 failed',
    });

    const result = await ChainPattern.execute(
      [agent1, agent2, agent3],
      'task',
      undefined,
      { stopOnFailure: true }
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Agent 2 failed');
    expect(agent3.execute).not.toHaveBeenCalled();
  });

  it('should continue on failure without stopOnFailure', async () => {
    agent2.execute = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'Agent 2 failed',
    });

    const result = await ChainPattern.execute(
      [agent1, agent2, agent3],
      'task',
      undefined,
      { stopOnFailure: false }
    );

    expect(result.status).toBe('completed');
    expect(agent3.execute).toHaveBeenCalled();
  });

  it('should return failed result for empty agents array', async () => {
    const result = await ChainPattern.execute([], 'task');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('No agents');
  });

  it('should include intermediate results with option', async () => {
    const result = await ChainPattern.execute(
      [agent1, agent2],
      'task',
      undefined,
      { includeIntermediateResults: true }
    );

    expect(result.chainResults).toBeDefined();
    expect(result.chainResults?.length).toBe(2);
  });

  it('should execute with transformer', async () => {
    const transformer = vi.fn((output, index) => `transformed-${output}`);

    const result = await ChainPattern.executeWithTransform(
      [agent1, agent2],
      'task',
      transformer
    );

    expect(result.status).toBe('completed');
    expect(transformer).toHaveBeenCalledTimes(1);
  });
});

describe('ParallelPattern', () => {
  let agent1: Agent;
  let agent2: Agent;
  let agent3: Agent;

  beforeEach(() => {
    agent1 = {
      id: 'agent-1',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-1',
      }),
    };

    agent2 = {
      id: 'agent-2',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-2',
      }),
    };

    agent3 = {
      id: 'agent-3',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-3',
      }),
    };
  });

  it('should execute agents in parallel', async () => {
    const result = await ParallelPattern.execute(
      [agent1, agent2, agent3],
      'task'
    );

    expect(result.status).toBe('completed');
    expect(result.results.size).toBe(3);
    expect(result.successfulCount).toBe(3);
    expect(result.failedCount).toBe(0);
  });

  it('should handle partial failures', async () => {
    agent2.execute = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'Agent 2 failed',
    });

    const result = await ParallelPattern.execute(
      [agent1, agent2, agent3],
      'task'
    );

    expect(result.status).toBe('partial');
    expect(result.successfulCount).toBe(2);
    expect(result.failedCount).toBe(1);
  });

  it('should respect maxConcurrency', async () => {
    const result = await ParallelPattern.execute(
      [agent1, agent2, agent3],
      'task',
      undefined,
      { maxConcurrency: 2 }
    );

    expect(result.status).toBe('completed');
    expect(result.results.size).toBe(3);
  });

  it('should race agents and return first result', async () => {
    // Make agent2 faster
    agent1.execute = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        status: 'completed',
        output: 'result-1',
      }), 100))
    );

    agent2.execute = vi.fn().mockResolvedValue({
      status: 'completed',
      output: 'result-2',
    });

    const result = await ParallelPattern.race([agent1, agent2], 'task');

    expect(result.status).toBe('completed');
    expect(['result-1', 'result-2']).toContain(result.output);
  });

  it('should return failed result for empty agents in race', async () => {
    const result = await ParallelPattern.race([], 'task');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('No agents');
  });

  it('should execute allSettled and return all results', async () => {
    agent2.execute = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'Failed',
    });

    const results = await ParallelPattern.allSettled(
      [agent1, agent2, agent3],
      'task'
    );

    expect(results.size).toBe(3);
    expect(results.get('agent-1')?.status).toBe('completed');
    expect(results.get('agent-2')?.status).toBe('failed');
    expect(results.get('agent-3')?.status).toBe('completed');
  });

  it('should return first successful result', async () => {
    agent1.execute = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'Failed',
    });

    const result = await ParallelPattern.firstSuccessful(
      [agent1, agent2, agent3],
      'task'
    );

    expect(result.status).toBe('completed');
  });

  it('should return failed if all agents fail in firstSuccessful', async () => {
    agent1.execute = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'Failed 1',
    });

    agent2.execute = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'Failed 2',
    });

    agent3.execute = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'Failed 3',
    });

    const result = await ParallelPattern.firstSuccessful(
      [agent1, agent2, agent3],
      'task'
    );

    expect(result.status).toBe('failed');
  });
});

describe('RouterPattern', () => {
  let technicalAgent: Agent;
  let billingAgent: Agent;
  let generalAgent: Agent;

  beforeEach(() => {
    technicalAgent = {
      id: 'technical',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'technical response',
      }),
    };

    billingAgent = {
      id: 'billing',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'billing response',
      }),
    };

    generalAgent = {
      id: 'general',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'general response',
      }),
    };
  });

  it('should route to matching agent', async () => {
    const router = new RouterPattern()
      .addRouter({
        condition: task => task.includes('technical'),
        agent: technicalAgent,
      })
      .addRouter({
        condition: task => task.includes('billing'),
        agent: billingAgent,
      });

    const result = await router.route('I have a technical issue');

    expect(result.output).toBe('technical response');
    expect(technicalAgent.execute).toHaveBeenCalled();
    expect(billingAgent.execute).not.toHaveBeenCalled();
  });

  it('should use default agent when no match', async () => {
    const router = new RouterPattern()
      .addRouter({
        condition: task => task.includes('technical'),
        agent: technicalAgent,
      })
      .setDefaultAgent(generalAgent);

    const result = await router.route('General question');

    expect(result.output).toBe('general response');
    expect(generalAgent.execute).toHaveBeenCalled();
  });

  it('should fail when no match and no default', async () => {
    const router = new RouterPattern()
      .addRouter({
        condition: task => task.includes('technical'),
        agent: technicalAgent,
      });

    const result = await router.route('General question');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('No matching router');
  });

  it('should respect router priority', async () => {
    const router = new RouterPattern()
      .addRouter({
        condition: () => true, // Always matches
        agent: technicalAgent,
        priority: 1,
      })
      .addRouter({
        condition: () => true, // Always matches
        agent: billingAgent,
        priority: 10, // Higher priority
      });

    await router.route('task');

    expect(billingAgent.execute).toHaveBeenCalled();
    expect(technicalAgent.execute).not.toHaveBeenCalled();
  });

  it('should use static route method', async () => {
    const result = await RouterPattern.route(
      'technical question',
      [
        {
          condition: task => task.includes('technical'),
          agent: technicalAgent,
        },
      ],
      undefined,
      generalAgent
    );

    expect(result.output).toBe('technical response');
  });

  it('should clear routers', () => {
    const router = new RouterPattern()
      .addRouter({
        condition: () => true,
        agent: technicalAgent,
      });

    expect(router.getRouterCount()).toBe(1);

    router.clearRouters();

    expect(router.getRouterCount()).toBe(0);
  });
});

describe('ContentRouter', () => {
  let agent1: Agent;
  let agent2: Agent;

  beforeEach(() => {
    agent1 = {
      id: 'agent-1',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-1',
      }),
    };

    agent2 = {
      id: 'agent-2',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-2',
      }),
    };
  });

  it('should route based on keywords', async () => {
    const router = new ContentRouter()
      .addKeywordRouter(['urgent', 'critical'], agent1)
      .addKeywordRouter(['normal', 'regular'], agent2);

    const result = await router.route('This is urgent');

    expect(result.output).toBe('result-1');
  });

  it('should handle case-insensitive matching', async () => {
    const router = new ContentRouter()
      .addKeywordRouter(['urgent'], agent1, { caseSensitive: false });

    const result = await router.route('This is URGENT');

    expect(result.output).toBe('result-1');
  });

  it('should route based on regex', async () => {
    const router = new ContentRouter()
      .addRegexRouter(/\b\d{3}-\d{4}\b/, agent1); // Phone number pattern

    const result = await router.route('Call me at 123-4567');

    expect(result.output).toBe('result-1');
  });
});

describe('LoadBalancerRouter', () => {
  let agent1: Agent;
  let agent2: Agent;
  let agent3: Agent;

  beforeEach(() => {
    agent1 = {
      id: 'agent-1',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-1',
      }),
    };

    agent2 = {
      id: 'agent-2',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-2',
      }),
    };

    agent3 = {
      id: 'agent-3',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'result-3',
      }),
    };
  });

  it('should distribute tasks using round-robin', async () => {
    const balancer = new LoadBalancerRouter()
      .addAgent(agent1)
      .addAgent(agent2)
      .addAgent(agent3);

    await balancer.routeRoundRobin('task1');
    await balancer.routeRoundRobin('task2');
    await balancer.routeRoundRobin('task3');

    // Each agent should be called once
    expect(agent1.execute).toHaveBeenCalledTimes(1);
    expect(agent2.execute).toHaveBeenCalledTimes(1);
    expect(agent3.execute).toHaveBeenCalledTimes(1);
  });

  it('should route to least loaded agent', async () => {
    const balancer = new LoadBalancerRouter()
      .addAgent(agent1)
      .addAgent(agent2);

    const result = await balancer.routeLeastLoaded('task');

    expect(result.status).toBe('completed');
    expect(balancer.getAgentCount()).toBe(2);
  });

  it('should return failed for empty agent pool', async () => {
    const balancer = new LoadBalancerRouter();

    const result = await balancer.routeRoundRobin('task');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('No agents');
  });
});

describe('SupervisorPattern', () => {
  let supervisor: Agent;
  let worker1: Agent;
  let worker2: Agent;

  beforeEach(() => {
    supervisor = {
      id: 'supervisor',
      execute: vi.fn()
        .mockResolvedValueOnce({
          status: 'completed',
          output: 'Subtask 1\nSubtask 2\nSubtask 3',
        })
        .mockResolvedValueOnce({
          status: 'completed',
          output: 'Final synthesis',
        }),
    };

    worker1 = {
      id: 'worker-1',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'worker-1 result',
      }),
    };

    worker2 = {
      id: 'worker-2',
      execute: vi.fn().mockResolvedValue({
        status: 'completed',
        output: 'worker-2 result',
      }),
    };
  });

  it('should execute supervisor pattern', async () => {
    const result = await SupervisorPattern.execute(
      supervisor,
      [worker1, worker2],
      'Complex task'
    );

    expect(result.status).toBe('completed');
    expect(result.subtaskCount).toBe(3);
    expect(supervisor.execute).toHaveBeenCalledTimes(2);
  });

  it('should handle no workers', async () => {
    const result = await SupervisorPattern.execute(
      supervisor,
      [],
      'task'
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('No workers');
  });

  it('should handle decomposition failure', async () => {
    supervisor.execute = vi.fn().mockResolvedValueOnce({
      status: 'failed',
      error: 'Decomposition failed',
    });

    const result = await SupervisorPattern.execute(
      supervisor,
      [worker1],
      'task'
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('decompose');
  });

  it('should execute sequentially when parallelExecution is false', async () => {
    const result = await SupervisorPattern.execute(
      supervisor,
      [worker1, worker2],
      'task',
      undefined,
      { parallelExecution: false }
    );

    expect(result.status).toBe('completed');
  });

  it('should include worker results when configured', async () => {
    const result = await SupervisorPattern.execute(
      supervisor,
      [worker1, worker2],
      'task',
      undefined,
      { includeWorkerResults: true }
    );

    expect(result.workerResults).toBeDefined();
    expect(result.workerResults?.size).toBeGreaterThan(0);
  });

  it('should handle worker failures', async () => {
    worker1.execute = vi.fn().mockResolvedValue({
      status: 'failed',
      error: 'Worker failed',
    });

    const result = await SupervisorPattern.execute(
      supervisor,
      [worker1, worker2],
      'task'
    );

    expect(result.status).toBe('partial');
    expect(result.failedSubtasks).toBeGreaterThan(0);
  });
});
