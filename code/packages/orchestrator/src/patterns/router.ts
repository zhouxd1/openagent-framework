/**
 * @fileoverview Router Pattern
 * @description Routing pattern that directs tasks to appropriate agents based on conditions
 */

import { Agent, AgentResult, WorkflowContext, RouterConfig } from '../types';

/**
 * Extended router configuration with priority
 */
export interface ExtendedRouterConfig extends RouterConfig {
  /** Priority for this router (higher = checked first) */
  priority?: number;
  /** Router name/label */
  name?: string;
}

/**
 * Router pattern - condition-based agent selection
 * 
 * Use case: When different types of tasks should be handled by different agents.
 * Examples:
 * - Route support tickets based on category (technical, billing, general)
 * - Route API requests based on endpoint type
 * - Route content based on language or topic
 * - Route tasks based on complexity or priority
 */
export class RouterPattern {
  private routers: ExtendedRouterConfig[] = [];
  private defaultAgent?: Agent;

  /**
   * Add a router configuration
   */
  addRouter(config: ExtendedRouterConfig): this {
    this.routers.push(config);
    // Sort by priority (higher first)
    this.routers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return this;
  }

  /**
   * Set default agent for when no router matches
   */
  setDefaultAgent(agent: Agent): this {
    this.defaultAgent = agent;
    return this;
  }

  /**
   * Route a task to the appropriate agent
   * 
   * @param task - Task to route
   * @param context - Optional workflow context
   * @returns Result from the matched agent
   * 
   * @example
   * ```typescript
   * const router = new RouterPattern()
   *   .addRouter({
   *     name: 'technical',
   *     condition: (task) => task.includes('technical'),
   *     agent: technicalAgent,
   *     priority: 10
   *   })
   *   .addRouter({
   *     name: 'billing',
   *     condition: (task) => task.includes('billing'),
   *     agent: billingAgent,
   *     priority: 5
   *   })
   *   .setDefaultAgent(generalAgent);
   * 
   * const result = await router.route("Help with technical issue");
   * ```
   */
  async route(task: string, context?: WorkflowContext): Promise<AgentResult> {
    // Find matching router
    for (const router of this.routers) {
      try {
        if (router.condition(task, context)) {
          return await router.agent.execute(task, context);
        }
      } catch (error) {
        console.error(`Error in router condition: ${error}`);
        continue;
      }
    }

    // Use default agent if no match
    if (this.defaultAgent) {
      return await this.defaultAgent.execute(task, context);
    }

    return {
      status: 'failed',
      error: 'No matching router found and no default agent configured',
    };
  }

  /**
   * Static route method for simple routing
   */
  static async route(
    task: string,
    routers: RouterConfig[],
    context?: WorkflowContext,
    defaultAgent?: Agent
  ): Promise<AgentResult> {
    for (const router of routers) {
      try {
        if (router.condition(task, context)) {
          return await router.agent.execute(task, context);
        }
      } catch (error) {
        console.error(`Error in router condition: ${error}`);
        continue;
      }
    }

    if (defaultAgent) {
      return await defaultAgent.execute(task, context);
    }

    return {
      status: 'failed',
      error: 'No matching router found',
    };
  }

  /**
   * Get all router names
   */
  getRouterNames(): string[] {
    return this.routers
      .filter(r => r.name)
      .map(r => r.name!);
  }

  /**
   * Clear all routers
   */
  clearRouters(): void {
    this.routers = [];
  }

  /**
   * Get router count
   */
  getRouterCount(): number {
    return this.routers.length;
  }
}

/**
 * Content-based router that routes based on content analysis
 */
export class ContentRouter extends RouterPattern {
  /**
   * Add a keyword-based router
   */
  addKeywordRouter(
    keywords: string[],
    agent: Agent,
    options?: {
      name?: string;
      priority?: number;
      caseSensitive?: boolean;
    }
  ): this {
    const caseSensitive = options?.caseSensitive || false;
    
    return this.addRouter({
      name: options?.name,
      priority: options?.priority || 0,
      condition: (task: string) => {
        const content = caseSensitive ? task : task.toLowerCase();
        return keywords.some(keyword => {
          const kw = caseSensitive ? keyword : keyword.toLowerCase();
          return content.includes(kw);
        });
      },
      agent,
    });
  }

  /**
   * Add a regex-based router
   */
  addRegexRouter(
    pattern: RegExp,
    agent: Agent,
    options?: {
      name?: string;
      priority?: number;
    }
  ): this {
    return this.addRouter({
      name: options?.name,
      priority: options?.priority || 0,
      condition: (task: string) => pattern.test(task),
      agent,
    });
  }
}

/**
 * Priority-based router that routes based on task priority
 */
export class PriorityRouter extends RouterPattern {
  /**
   * Add a priority range router
   */
  addPriorityRangeRouter(
    minPriority: number,
    maxPriority: number,
    agent: Agent,
    options?: {
      name?: string;
    }
  ): this {
    return this.addRouter({
      name: options?.name || `priority-${minPriority}-${maxPriority}`,
      priority: maxPriority, // Higher priority tasks get checked first
      condition: (_task: string, context?: WorkflowContext) => {
        const priority = context?.metadata?.priority as number;
        return priority >= minPriority && priority <= maxPriority;
      },
      agent,
    });
  }
}

/**
 * Load balancer router that distributes tasks across agents
 */
export class LoadBalancerRouter {
  private agents: Agent[] = [];
  private currentIndex = 0;
  private agentLoads: Map<string, number> = new Map();

  /**
   * Add an agent to the pool
   */
  addAgent(agent: Agent): this {
    this.agents.push(agent);
    this.agentLoads.set(agent.id, 0);
    return this;
  }

  /**
   * Route using round-robin strategy
   */
  async routeRoundRobin(
    task: string,
    context?: WorkflowContext
  ): Promise<AgentResult> {
    if (this.agents.length === 0) {
      return {
        status: 'failed',
        error: 'No agents available',
      };
    }

    const agent = this.agents[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.agents.length;

    return await agent.execute(task, context);
  }

  /**
   * Route to agent with least load
   */
  async routeLeastLoaded(
    task: string,
    context?: WorkflowContext
  ): Promise<AgentResult> {
    if (this.agents.length === 0) {
      return {
        status: 'failed',
        error: 'No agents available',
      };
    }

    // Find agent with minimum load
    let minLoad = Infinity;
    let selectedAgent = this.agents[0];

    for (const agent of this.agents) {
      const load = this.agentLoads.get(agent.id) || 0;
      if (load < minLoad) {
        minLoad = load;
        selectedAgent = agent;
      }
    }

    // Increment load
    this.agentLoads.set(selectedAgent.id, minLoad + 1);

    try {
      const result = await selectedAgent.execute(task, context);
      return result;
    } finally {
      // Decrement load
      const currentLoad = this.agentLoads.get(selectedAgent.id) || 0;
      this.agentLoads.set(selectedAgent.id, Math.max(0, currentLoad - 1));
    }
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    return this.agents.length;
  }

  /**
   * Get current loads
   */
  getLoads(): Map<string, number> {
    return new Map(this.agentLoads);
  }
}
