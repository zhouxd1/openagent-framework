"use strict";
/**
 * ReAct (Reasoning + Acting) Agent Implementation
 *
 * This agent uses the ReAct pattern:
 * 1. Thought: Reason about what to do next
 * 2. Action: Choose and execute a tool
 * 3. Observation: Observe the result
 * 4. Repeat until task is complete
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReActAgent = void 0;
const base_agent_1 = require("./base-agent");
/**
 * ReAct Agent Implementation
 *
 * Implements the ReAct pattern for reasoning and tool use
 */
class ReActAgent extends base_agent_1.BaseAgent {
    id;
    name;
    provider;
    maxIterations;
    constructor(config) {
        super(config);
        this.id = config.id;
        this.name = config.name;
        this.provider = config.provider;
        this.maxIterations = config.maxIterations || 10;
    }
    /**
     * Execute the agent using ReAct pattern
     */
    async run(input, context) {
        const startTime = Date.now();
        this.updateState({ status: 'running', currentIteration: 0 });
        try {
            // Emit agent start event
            await this.emitEvent('agent:start', {
                input,
                sessionId: context?.sessionId,
                userId: context?.userId,
            });
            // Add user message to history
            this.addMessage({
                role: 'user',
                content: input,
            });
            // Execute ReAct loop
            const result = await this.executeReActLoop(input, context);
            const duration = Date.now() - startTime;
            this.updateState({ status: 'idle' });
            // Emit agent end event
            await this.emitEvent('agent:end', {
                duration,
                success: result.success,
                sessionId: context?.sessionId,
            });
            return {
                ...result,
                metadata: {
                    ...result.metadata,
                    provider: this.provider,
                    duration,
                    iterations: this._state.currentIteration,
                },
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.updateState({ status: 'error' });
            // Emit error event
            await this.emitEvent('error', {
                error: error instanceof Error ? error.message : String(error),
                duration,
                sessionId: context?.sessionId,
            });
            return this.createErrorResponse(error, {
                duration,
                iterations: this._state.currentIteration,
            });
        }
    }
    /**
     * Execute the ReAct loop
     */
    async executeReActLoop(input, context) {
        let iteration = 0;
        const maxIterations = context?.maxIterations || this.maxIterations;
        while (iteration < maxIterations) {
            // Check if paused
            if (this._state.status === 'paused') {
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }
            iteration++;
            this.updateState({ currentIteration: iteration });
            this.logger.debug('ReAct iteration', {
                iteration,
                maxIterations,
            });
            // Execute one ReAct step
            const step = await this.executeReActStep(input, iteration, context);
            // Check if we have a final answer
            if (step.observation && step.observation.includes('Final Answer:')) {
                const finalAnswer = this.extractFinalAnswer(step.observation);
                return {
                    success: true,
                    message: finalAnswer,
                    metadata: {
                        provider: this.provider,
                        duration: 0,
                        iterations: iteration,
                        finishReason: 'stop',
                    },
                };
            }
            // Check if no action was taken (task complete or stuck)
            if (!step.action) {
                return {
                    success: true,
                    message: step.thought || 'Task completed',
                    metadata: {
                        provider: this.provider,
                        duration: 0,
                        iterations: iteration,
                        finishReason: 'stop',
                    },
                };
            }
        }
        // Max iterations reached
        return {
            success: false,
            message: 'Maximum iterations reached without completing the task',
            metadata: {
                provider: this.provider,
                duration: 0,
                iterations: maxIterations,
                finishReason: 'max_iterations',
            },
        };
    }
    /**
     * Execute a single ReAct step
     *
     * Note: This is a simplified implementation. In a real scenario,
     * this would call an LLM to generate thoughts and actions.
     */
    async executeReActStep(input, iteration, context) {
        // This is a placeholder implementation
        // In a real implementation, you would:
        // 1. Call the LLM with the current context
        // 2. Parse the response to extract Thought/Action/Action Input
        // 3. Execute the action if present
        // 4. Generate an observation
        const step = {
            thought: `Processing iteration ${iteration}`,
        };
        // For demonstration, we'll use a simple rule-based approach
        // In reality, this would be powered by an LLM
        // Check if we should take an action
        if (iteration === 1) {
            // First iteration: analyze the input
            step.thought = `Analyzing the input: "${input}"`;
            step.observation = 'Initial analysis complete. Ready to proceed.';
        }
        else {
            // Subsequent iterations
            step.thought = 'Task appears to be complete.';
            step.observation = 'Final Answer: Task completed successfully.';
        }
        // Add step to message history
        this.addMessage({
            role: 'assistant',
            content: `Thought: ${step.thought}\n${step.action ? `Action: ${step.action}\nAction Input: ${JSON.stringify(step.actionInput)}` : ''}\nObservation: ${step.observation}`,
        });
        return step;
    }
    /**
     * Extract final answer from observation
     */
    extractFinalAnswer(observation) {
        const match = observation.match(/Final Answer:\s*(.+)/);
        return match ? match[1].trim() : observation;
    }
    /**
     * Parse LLM response to extract ReAct components
     *
     * Helper method for parsing LLM responses
     */
    parseReActResponse(response) {
        const thoughtMatch = response.match(/Thought:\s*(.+?)(?=\n|$)/);
        const actionMatch = response.match(/Action:\s*(.+?)(?=\n|$)/);
        const actionInputMatch = response.match(/Action Input:\s*(.+?)(?=\n|$)/);
        const observationMatch = response.match(/Observation:\s*(.+?)(?=\n|$)/);
        const step = {
            thought: thoughtMatch ? thoughtMatch[1].trim() : '',
        };
        if (actionMatch) {
            step.action = actionMatch[1].trim();
        }
        if (actionInputMatch) {
            try {
                step.actionInput = JSON.parse(actionInputMatch[1].trim());
            }
            catch {
                // If JSON parse fails, wrap the string in an object
                step.actionInput = { value: actionInputMatch[1].trim() };
            }
        }
        if (observationMatch) {
            step.observation = observationMatch[1].trim();
        }
        return step;
    }
}
exports.ReActAgent = ReActAgent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVhY3QtYWdlbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZWFjdC1hZ2VudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7OztBQUVILDZDQUF5QztBQWF6Qzs7OztHQUlHO0FBQ0gsTUFBYSxVQUFXLFNBQVEsc0JBQVM7SUFDOUIsRUFBRSxDQUFTO0lBQ1gsSUFBSSxDQUFTO0lBQ2IsUUFBUSxDQUFnQjtJQUN6QixhQUFhLENBQVM7SUFFOUIsWUFBWSxNQUF3QjtRQUNsQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDZCxJQUFJLENBQUMsRUFBRSxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUM7UUFDcEIsSUFBSSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUNoQyxJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxhQUFhLElBQUksRUFBRSxDQUFDO0lBQ2xELENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBYSxFQUFFLE9BQXNCO1FBQzdDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRTdELElBQUksQ0FBQztZQUNILHlCQUF5QjtZQUN6QixNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFO2dCQUNsQyxLQUFLO2dCQUNMLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUztnQkFDN0IsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNO2FBQ3hCLENBQUMsQ0FBQztZQUVILDhCQUE4QjtZQUM5QixJQUFJLENBQUMsVUFBVSxDQUFDO2dCQUNkLElBQUksRUFBRSxNQUFNO2dCQUNaLE9B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SW1wbGVtZW50YXRpb25cbiAqIFxuICogVGhpcyBhZ2VudCB1c2VzIHRoZSBSZUFjdCBwYXR0ZXJuOlxuICogMS4gVGhvdWdodDogUmVhc29uIGFib3V0IHdoYXQgdG8gZG8gbmV4dFxuICogMi4gQWN0aW9uOiBDaG9vc2UgYW5kIGV4ZWN1dGUgYSB0b29sXG4gKiAzLiBPYnNlcnZhdGlvbjogT2JzZXJ2ZSB0aGUgcmVzdWx0XG4gKiA0LiBSZXBlYXQgdW50aWwgdGFzayBpcyBjb21wbGV0ZVxuICovXG5cbmltcG9ydCB7IEJhc2VBZ2VudCB9IGZyb20gJy4vYmFzZS1hZ2VudCc7XG5pbXBvcnQgeyBBZ2VudFByb3ZpZGVyLCBBZ2VudENvbnRleHQsIEFnZW50UmVzcG9uc2UsIEFnZW50Q29uZmlnLCBSZUFjdFN0ZXAgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IFBhcmFtZXRlcnMsIE1ldGFkYXRhLCBKU09OT2JqZWN0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVJZCB9IGZyb20gJy4uL3V0aWxzJztcblxuLyoqXG4gKiBSZUFjdCBBZ2VudCBDb25maWd1cmF0aW9uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVBY3RBZ2VudENvbmZpZyBleHRlbmRzIEFnZW50Q29uZmlnIHtcbiAgbW9kZTogJ3JlYWN0JztcbiAgbWF4SXRlcmF0aW9ucz86IG51bWJlcjtcbn1cblxuLyoqXG4gKiBSZUFjdCBBZ2VudCBJbXBsZW1lbnRhdGlvblxuICogXG4gKiBJbXBsZW1lbnRzIHRoZSBSZUFjdCBwYXR0ZXJuIGZvciByZWFzb25pbmcgYW5kIHRvb2wgdXNlXG4gKi9cbmV4cG9ydCBjbGFzcyBSZUFjdEFnZW50IGV4dGVuZHMgQmFzZUFnZW50IHtcbiAgcmVhZG9ubHkgaWQ6IHN0cmluZztcbiAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICByZWFkb25seSBwcm92aWRlcjogQWdlbnRQcm92aWRlcjtcbiAgcHJpdmF0ZSBtYXhJdGVyYXRpb25zOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBSZUFjdEFnZW50Q29uZmlnKSB7XG4gICAgc3VwZXIoY29uZmlnKTtcbiAgICB0aGlzLmlkID0gY29uZmlnLmlkO1xuICAgIHRoaXMubmFtZSA9IGNvbmZpZy5uYW1lO1xuICAgIHRoaXMucHJvdmlkZXIgPSBjb25maWcucHJvdmlkZXI7XG4gICAgdGhpcy5tYXhJdGVyYXRpb25zID0gY29uZmlnLm1heEl0ZXJhdGlvbnMgfHwgMTA7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSB0aGUgYWdlbnQgdXNpbmcgUmVBY3QgcGF0dGVyblxuICAgKi9cbiAgYXN5bmMgcnVuKGlucHV0OiBzdHJpbmcsIGNvbnRleHQ/OiBBZ2VudENvbnRleHQpOiBQcm9taXNlPEFnZW50UmVzcG9uc2U+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMudXBkYXRlU3RhdGUoeyBzdGF0dXM6ICdydW5uaW5nJywgY3VycmVudEl0ZXJhdGlvbjogMCB9KTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBFbWl0IGFnZW50IHN0YXJ0IGV2ZW50XG4gICAgICBhd2FpdCB0aGlzLmVtaXRFdmVudCgnYWdlbnQ6c3RhcnQnLCB7XG4gICAgICAgIGlucHV0LFxuICAgICAgICBzZXNzaW9uSWQ6IGNvbnRleHQ/LnNlc3Npb25JZCxcbiAgICAgICAgdXNlcklkOiBjb250ZXh0Py51c2VySWQsXG4gICAgICB9KTtcblxuICAgICAgLy8gQWRkIHVzZXIgbWVzc2FnZSB0byBoaXN0b3J5XG4gICAgICB0aGlzLmFkZE1lc3NhZ2Uoe1xuICAgICAgICByb2xlOiAndXNlcicsXG4gICAgICAgIGNvbnRlbnQ6IGlucHV0LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIEV4ZWN1dGUgUmVBY3QgbG9vcFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5leGVjdXRlUmVBY3RMb29wKGlucHV0LCBjb250ZXh0KTtcblxuICAgICAgY29uc3QgZHVyYXRpb24gPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgdGhpcy51cGRhdGVTdGF0ZSh7IHN0YXR1czogJ2lkbGUnIH0pO1xuXG4gICAgICAvLyBFbWl0IGFnZW50IGVuZCBldmVudFxuICAgICAgYXdhaXQgdGhpcy5lbWl0RXZlbnQoJ2FnZW50OmVuZCcsIHtcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzLFxuICAgICAgICBzZXNzaW9uSWQ6IGNvbnRleHQ/LnNlc3Npb25JZCxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5yZXN1bHQsXG4gICAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgICAgLi4ucmVzdWx0Lm1ldGFkYXRhLFxuICAgICAgICAgIHByb3ZpZGVyOiB0aGlzLnByb3ZpZGVyLFxuICAgICAgICAgIGR1cmF0aW9uLFxuICAgICAgICAgIGl0ZXJhdGlvbnM6IHRoaXMuX3N0YXRlLmN1cnJlbnRJdGVyYXRpb24sXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXRlKHsgc3RhdHVzOiAnZXJyb3InIH0pO1xuXG4gICAgICAvLyBFbWl0IGVycm9yIGV2ZW50XG4gICAgICBhd2FpdCB0aGlzLmVtaXRFdmVudCgnZXJyb3InLCB7XG4gICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvciksXG4gICAgICAgIGR1cmF0aW9uLFxuICAgICAgICBzZXNzaW9uSWQ6IGNvbnRleHQ/LnNlc3Npb25JZCxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdGhpcy5jcmVhdGVFcnJvclJlc3BvbnNlKGVycm9yIGFzIEVycm9yLCB7XG4gICAgICAgIGR1cmF0aW9uLFxuICAgICAgICBpdGVyYXRpb25zOiB0aGlzLl9zdGF0ZS5jdXJyZW50SXRlcmF0aW9uLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgdGhlIFJlQWN0IGxvb3BcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZVJlQWN0TG9vcChcbiAgICBpbnB1dDogc3RyaW5nLFxuICAgIGNvbnRleHQ/OiBBZ2VudENvbnRleHRcbiAgKTogUHJvbWlzZTxBZ2VudFJlc3BvbnNlPiB7XG4gICAgbGV0IGl0ZXJhdGlvbiA9IDA7XG4gICAgY29uc3QgbWF4SXRlcmF0aW9ucyA9IGNvbnRleHQ/Lm1heEl0ZXJhdGlvbnMgfHwgdGhpcy5tYXhJdGVyYXRpb25zO1xuXG4gICAgd2hpbGUgKGl0ZXJhdGlvbiA8IG1heEl0ZXJhdGlvbnMpIHtcbiAgICAgIC8vIENoZWNrIGlmIHBhdXNlZFxuICAgICAgaWYgKHRoaXMuX3N0YXRlLnN0YXR1cyA9PT0gJ3BhdXNlZCcpIHtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMCkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaXRlcmF0aW9uKys7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXRlKHsgY3VycmVudEl0ZXJhdGlvbjogaXRlcmF0aW9uIH0pO1xuXG4gICAgICB0aGlzLmxvZ2dlci5kZWJ1ZygnUmVBY3QgaXRlcmF0aW9uJywge1xuICAgICAgICBpdGVyYXRpb24sXG4gICAgICAgIG1heEl0ZXJhdGlvbnMsXG4gICAgICB9KTtcblxuICAgICAgLy8gRXhlY3V0ZSBvbmUgUmVBY3Qgc3RlcFxuICAgICAgY29uc3Qgc3RlcCA9IGF3YWl0IHRoaXMuZXhlY3V0ZVJlQWN0U3RlcChpbnB1dCwgaXRlcmF0aW9uLCBjb250ZXh0KTtcblxuICAgICAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhIGZpbmFsIGFuc3dlclxuICAgICAgaWYgKHN0ZXAub2JzZXJ2YXRpb24gJiYgc3RlcC5vYnNlcnZhdGlvbi5pbmNsdWRlcygnRmluYWwgQW5zd2VyOicpKSB7XG4gICAgICAgIGNvbnN0IGZpbmFsQW5zd2VyID0gdGhpcy5leHRyYWN0RmluYWxBbnN3ZXIoc3RlcC5vYnNlcnZhdGlvbik7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgbWVzc2FnZTogZmluYWxBbnN3ZXIsXG4gICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAgIHByb3ZpZGVyOiB0aGlzLnByb3ZpZGVyLFxuICAgICAgICAgICAgZHVyYXRpb246IDAsXG4gICAgICAgICAgICBpdGVyYXRpb25zOiBpdGVyYXRpb24sXG4gICAgICAgICAgICBmaW5pc2hSZWFzb246ICdzdG9wJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICAvLyBDaGVjayBpZiBubyBhY3Rpb24gd2FzIHRha2VuICh0YXNrIGNvbXBsZXRlIG9yIHN0dWNrKVxuICAgICAgaWYgKCFzdGVwLmFjdGlvbikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgbWVzc2FnZTogc3RlcC50aG91Z2h0IHx8ICdUYXNrIGNvbXBsZXRlZCcsXG4gICAgICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgICAgIHByb3ZpZGVyOiB0aGlzLnByb3ZpZGVyLFxuICAgICAgICAgICAgZHVyYXRpb246IDAsXG4gICAgICAgICAgICBpdGVyYXRpb25zOiBpdGVyYXRpb24sXG4gICAgICAgICAgICBmaW5pc2hSZWFzb246ICdzdG9wJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1heCBpdGVyYXRpb25zIHJlYWNoZWRcbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBtZXNzYWdlOiAnTWF4aW11bSBpdGVyYXRpb25zIHJlYWNoZWQgd2l0aG91dCBjb21wbGV0aW5nIHRoZSB0YXNrJyxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIHByb3ZpZGVyOiB0aGlzLnByb3ZpZGVyLFxuICAgICAgICBkdXJhdGlvbjogMCxcbiAgICAgICAgaXRlcmF0aW9uczogbWF4SXRlcmF0aW9ucyxcbiAgICAgICAgZmluaXNoUmVhc29uOiAnbWF4X2l0ZXJhdGlvbnMnLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgYSBzaW5nbGUgUmVBY3Qgc3RlcFxuICAgKiBcbiAgICogTm90ZTogVGhpcyBpcyBhIHNpbXBsaWZpZWQgaW1wbGVtZW50YXRpb24uIEluIGEgcmVhbCBzY2VuYXJpbyxcbiAgICogdGhpcyB3b3VsZCBjYWxsIGFuIExMTSB0byBnZW5lcmF0ZSB0aG91Z2h0cyBhbmQgYWN0aW9ucy5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZVJlQWN0U3RlcChcbiAgICBpbnB1dDogc3RyaW5nLFxuICAgIGl0ZXJhdGlvbjogbnVtYmVyLFxuICAgIGNvbnRleHQ/OiBBZ2VudENvbnRleHRcbiAgKTogUHJvbWlzZTxSZUFjdFN0ZXA+IHtcbiAgICAvLyBUaGlzIGlzIGEgcGxhY2Vob2xkZXIgaW1wbGVtZW50YXRpb25cbiAgICAvLyBJbiBhIHJlYWwgaW1wbGVtZW50YXRpb24sIHlvdSB3b3VsZDpcbiAgICAvLyAxLiBDYWxsIHRoZSBMTE0gd2l0aCB0aGUgY3VycmVudCBjb250ZXh0XG4gICAgLy8gMi4gUGFyc2UgdGhlIHJlc3BvbnNlIHRvIGV4dHJhY3QgVGhvdWdodC9BY3Rpb24vQWN0aW9uIElucHV0XG4gICAgLy8gMy4gRXhlY3V0ZSB0aGUgYWN0aW9uIGlmIHByZXNlbnRcbiAgICAvLyA0LiBHZW5lcmF0ZSBhbiBvYnNlcnZhdGlvblxuXG4gICAgY29uc3Qgc3RlcDogUmVBY3RTdGVwID0ge1xuICAgICAgdGhvdWdodDogYFByb2Nlc3NpbmcgaXRlcmF0aW9uICR7aXRlcmF0aW9ufWAsXG4gICAgfTtcblxuICAgIC8vIEZvciBkZW1vbnN0cmF0aW9uLCB3ZSdsbCB1c2UgYSBzaW1wbGUgcnVsZS1iYXNlZCBhcHByb2FjaFxuICAgIC8vIEluIHJlYWxpdHksIHRoaXMgd291bGQgYmUgcG93ZXJlZCBieSBhbiBMTE1cbiAgICBcbiAgICAvLyBDaGVjayBpZiB3ZSBzaG91bGQgdGFrZSBhbiBhY3Rpb25cbiAgICBpZiAoaXRlcmF0aW9uID09PSAxKSB7XG4gICAgICAvLyBGaXJzdCBpdGVyYXRpb246IGFuYWx5emUgdGhlIGlucHV0XG4gICAgICBzdGVwLnRob3VnaHQgPSBgQW5hbHl6aW5nIHRoZSBpbnB1dDogXCIke2lucHV0fVwiYDtcbiAgICAgIHN0ZXAub2JzZXJ2YXRpb24gPSAnSW5pdGlhbCBhbmFseXNpcyBjb21wbGV0ZS4gUmVhZHkgdG8gcHJvY2VlZC4nO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTdWJzZXF1ZW50IGl0ZXJhdGlvbnNcbiAgICAgIHN0ZXAudGhvdWdodCA9ICdUYXNrIGFwcGVhcnMgdG8gYmUgY29tcGxldGUuJztcbiAgICAgIHN0ZXAub2JzZXJ2YXRpb24gPSAnRmluYWwgQW5zd2VyOiBUYXNrIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHkuJztcbiAgICB9XG5cbiAgICAvLyBBZGQgc3RlcCB0byBtZXNzYWdlIGhpc3RvcnlcbiAgICB0aGlzLmFkZE1lc3NhZ2Uoe1xuICAgICAgcm9sZTogJ2Fzc2lzdGFudCcsXG4gICAgICBjb250ZW50OiBgVGhvdWdodDogJHtzdGVwLnRob3VnaHR9XFxuJHtzdGVwLmFjdGlvbiA/IGBBY3Rpb246ICR7c3RlcC5hY3Rpb259XFxuQWN0aW9uIElucHV0OiAke0pTT04uc3RyaW5naWZ5KHN0ZXAuYWN0aW9uSW5wdXQpfWAgOiAnJ31cXG5PYnNlcnZhdGlvbjogJHtzdGVwLm9ic2VydmF0aW9ufWAsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3RlcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeHRyYWN0IGZpbmFsIGFuc3dlciBmcm9tIG9ic2VydmF0aW9uXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RGaW5hbEFuc3dlcihvYnNlcnZhdGlvbjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBtYXRjaCA9IG9ic2VydmF0aW9uLm1hdGNoKC9GaW5hbCBBbnN3ZXI6XFxzKiguKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXS50cmltKCkgOiBvYnNlcnZhdGlvbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXJzZSBMTE0gcmVzcG9uc2UgdG8gZXh0cmFjdCBSZUFjdCBjb21wb25lbnRzXG4gICAqIFxuICAgKiBIZWxwZXIgbWV0aG9kIGZvciBwYXJzaW5nIExMTSByZXNwb25zZXNcbiAgICovXG4gIHByb3RlY3RlZCBwYXJzZVJlQWN0UmVzcG9uc2UocmVzcG9uc2U6IHN0cmluZyk6IFJlQWN0U3RlcCB7XG4gICAgY29uc3QgdGhvdWdodE1hdGNoID0gcmVzcG9uc2UubWF0Y2goL1Rob3VnaHQ6XFxzKiguKz8pKD89XFxufCQpLyk7XG4gICAgY29uc3QgYWN0aW9uTWF0Y2ggPSByZXNwb25zZS5tYXRjaCgvQWN0aW9uOlxccyooLis/KSg/PVxcbnwkKS8pO1xuICAgIGNvbnN0IGFjdGlvbklucHV0TWF0Y2ggPSByZXNwb25zZS5tYXRjaCgvQWN0aW9uIElucHV0OlxccyooLis/KSg/PVxcbnwkKS8pO1xuICAgIGNvbnN0IG9ic2VydmF0aW9uTWF0Y2ggPSByZXNwb25zZS5tYXRjaCgvT2JzZXJ2YXRpb246XFxzKiguKz8pKD89XFxufCQpLyk7XG5cbiAgICBjb25zdCBzdGVwOiBSZUFjdFN0ZXAgPSB7XG4gICAgICB0aG91Z2h0OiB0aG91Z2h0TWF0Y2ggPyB0aG91Z2h0TWF0Y2hbMV0udHJpbSgpIDogJycsXG4gICAgfTtcblxuICAgIGlmIChhY3Rpb25NYXRjaCkge1xuICAgICAgc3RlcC5hY3Rpb24gPSBhY3Rpb25NYXRjaFsxXS50cmltKCk7XG4gICAgfVxuXG4gICAgaWYgKGFjdGlvbklucHV0TWF0Y2gpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHN0ZXAuYWN0aW9uSW5wdXQgPSBKU09OLnBhcnNlKGFjdGlvbklucHV0TWF0Y2hbMV0udHJpbSgpKSBhcyBKU09OT2JqZWN0O1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIElmIEpTT04gcGFyc2UgZmFpbHMsIHdyYXAgdGhlIHN0cmluZyBpbiBhbiBvYmplY3RcbiAgICAgICAgc3RlcC5hY3Rpb25JbnB1dCA9IHsgdmFsdWU6IGFjdGlvbklucHV0TWF0Y2hbMV0udHJpbSgpIH0gYXMgSlNPTk9iamVjdDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob2JzZXJ2YXRpb25NYXRjaCkge1xuICAgICAgc3RlcC5vYnNlcnZhdGlvbiA9IG9ic2VydmF0aW9uTWF0Y2hbMV0udHJpbSgpO1xuICAgIH1cblxuICAgIHJldHVybiBzdGVwO1xuICB9XG59XG4iXX0=