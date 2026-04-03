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
export declare class ReActAgent extends BaseAgent {
    readonly id: string;
    readonly name: string;
    readonly provider: AgentProvider;
    private maxIterations;
    constructor(config: ReActAgentConfig);
    /**
     * Execute the agent using ReAct pattern
     */
    run(input: string, context?: AgentContext): Promise<AgentResponse>;
    /**
     * Execute the ReAct loop
     */
    private executeReActLoop;
    /**
     * Execute a single ReAct step
     *
     * Note: This is a simplified implementation. In a real scenario,
     * this would call an LLM to generate thoughts and actions.
     */
    private executeReActStep;
    /**
     * Extract final answer from observation
     */
    private extractFinalAnswer;
    /**
     * Parse LLM response to extract ReAct components
     *
     * Helper method for parsing LLM responses
     */
    protected parseReActResponse(response: string): ReActStep;
}
