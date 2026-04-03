/**
 * @fileoverview Agent Coordinator
 * @description Coordinates agent execution and resource management
 */

import {
  Agent,
  AgentResult,
  WorkflowContext,
  OrchestratorConfig,
} from './types';
import { MessageBus } from './communication/message-bus';
import { MessageFactory } from './communication/protocol';

/**
 * Agent status
 */
export interface AgentStatus {
  /** Agent ID */
  id: string;
  /** Whether the agent is available */
  available: boolean;
  /** Current load (number of tasks) */
  load: number;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Total completed tasks */
  completedTasks: number;
  /** Total failed tasks */
  failedTasks: number;
}

/**
 * Coordination result
 */
export interface CoordinationResult {
  /** Overall status */
  status: 'success' | 'partial' | 'failed';
  /** Agent results */
  results: Map<string, AgentResult>;
  /** Coordination metadata */
  metadata: {
    /** Total agents involved */
    totalAgents: number;
    /** Successful agents */
    successfulAgents: number;
    /** Failed agents */
    failedAgents: number;
    /** Coordination duration in ms */
    duration: number;
  };
}

/**
 * Agent coordinator for managing agent execution
 */
export class AgentCoordinator {
  private agents: Map<string, Agent> = new Map();
  private agentStatus: Map<string, AgentStatus> = new Map();
  private config: OrchestratorConfig;
  private messageBus?: MessageBus;

  constructor(config: OrchestratorConfig = {}, messageBus?: MessageBus) {
    this.config = config;
    this.messageBus = messageBus;
  }

  /**
   * Register an agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.agentStatus.set(agent.id, {
      id: agent.id,
      available: true,
      load: 0,
      lastActivity: new Date(),
      completedTasks: 0,
      failedTasks: 0,
    });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): boolean {
    const deleted = this.agents.delete(agentId);
    this.agentStatus.delete(agentId);
    return deleted;
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get available agents
   */
  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(agent => {
      const status = this.agentStatus.get(agent.id);
      return status?.available;
    });
  }

  /**
   * Execute a task on a specific agent
   */
  async executeOnAgent(
    agentId: string,
    task: string,
    context?: WorkflowContext
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        status: 'failed',
        error: `Agent ${agentId} not found`,
      };
    }

    const status = this.agentStatus.get(agentId)!;
    status.available = false;
    status.load++;

    const startTime = Date.now();

    try {
      // Notify via message bus if available
      if (this.messageBus) {
        const message = MessageFactory.createTaskMessage(
          'coordinator',
          agentId,
          { task, context }
        );
        await this.messageBus.send('agent-tasks', message);
      }

      const result = await agent.execute(task, context);

      status.lastActivity = new Date();
      if (result.status === 'completed') {
        status.completedTasks++;
      } else {
        status.failedTasks++;
      }

      return result;
    } catch (error) {
      status.failedTasks++;
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      status.load--;
      status.available = true;
    }
  }

  /**
   * Execute tasks on multiple agents in parallel
   */
  async executeParallel(
    agentIds: string[],
    task: string,
    context?: WorkflowContext
  ): Promise<CoordinationResult> {
    const startTime = Date.now();
    const results = new Map<string, AgentResult>();

    const promises = agentIds.map(async agentId => {
      const result = await this.executeOnAgent(agentId, task, context);
      return [agentId, result] as const;
    });

    const settled = await Promise.allSettled(promises);

    let successfulAgents = 0;
    let failedAgents = 0;

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const [agentId, agentResult] = result.value;
        results.set(agentId, agentResult);
        if (agentResult.status === 'completed') {
          successfulAgents++;
        } else {
          failedAgents++;
        }
      } else {
        results.set(agentIds[index], {
          status: 'failed',
          error: result.reason,
        });
        failedAgents++;
      }
    });

    const duration = Date.now() - startTime;

    return {
      status: failedAgents === 0 ? 'success' : 
              successfulAgents === 0 ? 'failed' : 'partial',
      results,
      metadata: {
        totalAgents: agentIds.length,
        successfulAgents,
        failedAgents,
        duration,
      },
    };
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.agentStatus.get(agentId);
  }

  /**
   * Get all agent statuses
   */
  getAllAgentStatuses(): AgentStatus[] {
    return Array.from(this.agentStatus.values());
  }

  /**
   * Select best agent for a task (based on load)
   */
  selectBestAgent(): Agent | undefined {
    const availableAgents = this.getAvailableAgents();
    if (availableAgents.length === 0) {
      return undefined;
    }

    // Select agent with lowest load
    let selectedAgent = availableAgents[0];
    let minLoad = this.agentStatus.get(selectedAgent.id)?.load || 0;

    for (const agent of availableAgents) {
      const load = this.agentStatus.get(agent.id)?.load || 0;
      if (load < minLoad) {
        minLoad = load;
        selectedAgent = agent;
      }
    }

    return selectedAgent;
  }

  /**
   * Get coordinator statistics
   */
  getStats(): {
    totalAgents: number;
    availableAgents: number;
    totalCompletedTasks: number;
    totalFailedTasks: number;
  } {
    let availableAgents = 0;
    let totalCompletedTasks = 0;
    let totalFailedTasks = 0;

    this.agentStatus.forEach(status => {
      if (status.available) availableAgents++;
      totalCompletedTasks += status.completedTasks;
      totalFailedTasks += status.failedTasks;
    });

    return {
      totalAgents: this.agents.size,
      availableAgents,
      totalCompletedTasks,
      totalFailedTasks,
    };
  }

  /**
   * Reset all agent statuses
   */
  resetStatuses(): void {
    this.agentStatus.forEach(status => {
      status.available = true;
      status.load = 0;
      status.lastActivity = new Date();
    });
  }
}
