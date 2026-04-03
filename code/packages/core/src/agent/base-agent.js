"use strict";
/**
 * Base Agent Implementation for OpenAgent Framework
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = void 0;
const tool_executor_1 = require("../tools/tool-executor");
const event_emitter_1 = require("../events/event-emitter");
const logger_1 = require("../logger");
const logger = (0, logger_1.createLogger)('BaseAgent');
/**
 * Abstract base class for all agent implementations
 *
 * Provides common functionality:
 * - Tool management
 * - Event emission
 * - State management
 * - Error handling
 * - Logging
 */
class BaseAgent {
    tools;
    toolExecutor;
    eventEmitter;
    config;
    _state;
    logger;
    messageHistory;
    constructor(config) {
        this.tools = new Map();
        this.toolExecutor = new tool_executor_1.ToolExecutor(undefined, (0, logger_1.createLogger)('AgentToolExecutor'));
        this.eventEmitter = new event_emitter_1.EventEmitter();
        this.config = config;
        this.messageHistory = [];
        this.logger = logger.child({ agentId: config.id, agentName: config.name });
        this._state = {
            status: 'idle',
            currentIteration: 0,
            lastActivity: new Date(),
            totalToolCalls: 0,
        };
    }
    /**
     * Get current agent state
     */
    get state() {
        return { ...this._state };
    }
    /**
     * Initialize the agent
     */
    async initialize() {
        this.logger.debug('Initializing agent', { id: this.id });
        // Register all tools with the executor
        for (const [name, tool] of this.tools) {
            const coreToolDef = {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            };
            this.toolExecutor.register(coreToolDef, async (params, ctx) => {
                const result = await tool.execute(params);
                // Convert ToolResult to the Core ToolResult format
                return {
                    success: result.success,
                    data: result.data,
                    error: result.error,
                };
            });
        }
        this._state.status = 'idle';
        this._state.lastActivity = new Date();
        this.logger.info('Agent initialized', { id: this.id, toolCount: this.tools.size });
    }
    /**
     * Destroy the agent and cleanup resources
     */
    async destroy() {
        this.logger.debug('Destroying agent', { id: this.id });
        this.tools.clear();
        this.messageHistory = [];
        this._state.status = 'idle';
        this.eventEmitter.clear();
        this.logger.info('Agent destroyed', { id: this.id });
    }
    /**
     * Add a tool to the agent
     */
    addTool(tool) {
        if (this.tools.has(tool.name)) {
            this.logger.warn('Tool already exists, overwriting', { toolName: tool.name });
        }
        this.tools.set(tool.name, tool);
        // Register with executor
        const coreToolDef = {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        };
        this.toolExecutor.register(coreToolDef, async (params, ctx) => {
            const result = await tool.execute(params);
            // Convert ToolResult to the Core ToolResult format
            return {
                success: result.success,
                data: result.data,
                error: result.error,
            };
        });
        this.logger.debug('Tool added', { toolName: tool.name });
    }
    /**
     * Remove a tool from the agent
     */
    removeTool(toolName) {
        if (!this.tools.has(toolName)) {
            this.logger.warn('Tool not found', { toolName });
            return;
        }
        this.tools.delete(toolName);
        this.toolExecutor.unregister(toolName);
        this.logger.debug('Tool removed', { toolName });
    }
    /**
     * Get all registered tools
     */
    getTools() {
        return Array.from(this.tools.values());
    }
    /**
     * Update agent configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.logger.debug('Config updated', { config: this.config });
    }
    /**
     * Get agent configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Pause agent execution
     */
    async pause() {
        if (this._state.status === 'running') {
            this._state.status = 'paused';
            this.logger.info('Agent paused');
        }
    }
    /**
     * Resume agent execution
     */
    async resume() {
        if (this._state.status === 'paused') {
            this._state.status = 'running';
            this.logger.info('Agent resumed');
        }
    }
    /**
     * Reset agent state
     */
    reset() {
        this._state = {
            status: 'idle',
            currentIteration: 0,
            lastActivity: new Date(),
            totalToolCalls: 0,
        };
        this.messageHistory = [];
        this.logger.info('Agent reset');
    }
    /**
     * Protected helper to execute a tool
     */
    async executeTool(toolName, parameters, context) {
        const startTime = Date.now();
        try {
            // Emit tool start event
            await this.eventEmitter.emit({
                type: 'tool.called',
                timestamp: new Date(),
                data: {
                    agentId: this.id,
                    toolName,
                    parameters,
                    sessionId: context?.sessionId,
                },
            });
            const execContext = context ? {
                sessionId: context.sessionId,
                userId: context.userId,
                timeout: context.timeout,
            } : undefined;
            const result = await this.toolExecutor.execute(toolName, parameters, execContext);
            const duration = Date.now() - startTime;
            this._state.totalToolCalls++;
            // Emit tool completion event
            await this.eventEmitter.emit({
                type: result.success ? 'tool.completed' : 'tool.failed',
                timestamp: new Date(),
                data: {
                    agentId: this.id,
                    toolName,
                    duration,
                    success: result.success,
                    sessionId: context?.sessionId,
                },
            });
            // Convert back to agent ToolResult format
            return {
                success: result.success,
                data: result.data,
                error: result.error,
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Emit tool failure event
            await this.eventEmitter.emit({
                type: 'tool.failed',
                timestamp: new Date(),
                data: {
                    agentId: this.id,
                    toolName,
                    duration,
                    error: errorMessage,
                    sessionId: context?.sessionId,
                },
            });
            this.logger.error('Tool execution failed', error instanceof Error ? error : new Error(errorMessage), {
                toolName,
                duration,
            });
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    /**
     * Protected helper to emit events
     */
    async emitEvent(type, data) {
        await this.eventEmitter.emit({
            type: type,
            timestamp: new Date(),
            data: {
                agentId: this.id,
                ...data,
            },
        });
    }
    /**
     * Protected helper to update state
     */
    updateState(updates) {
        this._state = { ...this._state, ...updates, lastActivity: new Date() };
    }
    /**
     * Protected helper to add message to history
     */
    addMessage(message) {
        this.messageHistory.push(message);
    }
    /**
     * Protected helper to get message history
     */
    getMessageHistory() {
        return [...this.messageHistory];
    }
    /**
     * Protected helper to clear message history
     */
    clearMessageHistory() {
        this.messageHistory = [];
    }
    /**
     * Protected helper to build system prompt
     */
    buildSystemPrompt() {
        let systemPrompt = this.config.systemPrompt || 'You are a helpful AI assistant.';
        // Add tool descriptions if in ReAct mode
        if (this.config.mode === 'react' && this.tools.size > 0) {
            const toolDescriptions = Array.from(this.tools.values())
                .map(tool => `- ${tool.name}: ${tool.description}`)
                .join('\n');
            systemPrompt += `\n\nAvailable tools:\n${toolDescriptions}`;
        }
        return systemPrompt;
    }
    /**
     * Protected helper to create error response
     */
    createErrorResponse(error, metadata) {
        const errorMessage = error instanceof Error ? error.message : error;
        this.logger.error('Creating error response', error instanceof Error ? error : new Error(errorMessage));
        return {
            success: false,
            message: errorMessage,
            error: errorMessage,
            metadata: {
                provider: this.provider,
                duration: 0,
                finishReason: 'error',
                ...metadata,
            },
        };
    }
    /**
     * Subscribe to agent events
     */
    on(eventType, handler) {
        this.eventEmitter.on(eventType, handler);
    }
    /**
     * Unsubscribe from agent events
     */
    off(eventType, handler) {
        this.eventEmitter.off(eventType, handler);
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1hZ2VudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhc2UtYWdlbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFjSCwwREFBc0Q7QUFFdEQsMkRBQXVEO0FBQ3ZELHNDQUFpRDtBQU1qRCxNQUFNLE1BQU0sR0FBRyxJQUFBLHFCQUFZLEVBQUMsV0FBVyxDQUFDLENBQUM7QUFFekM7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBc0IsU0FBUztJQUNuQixLQUFLLENBQW9CO0lBQ3pCLFlBQVksQ0FBZTtJQUMzQixZQUFZLENBQWU7SUFDM0IsTUFBTSxDQUFjO0lBQ3BCLE1BQU0sQ0FBYTtJQUNuQixNQUFNLENBQVM7SUFDZixjQUFjLENBQWlCO0lBTXpDLFlBQVksTUFBbUI7UUFDN0IsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLFNBQVMsRUFBRSxJQUFBLHFCQUFZLEVBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO1FBQ25GLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSw0QkFBWSxFQUFFLENBQUM7UUFDdkMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLGNBQWMsR0FBRyxFQUFFLENBQUM7UUFDekIsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRTNFLElBQUksQ0FBQyxNQUFNLEdBQUc7WUFDWixNQUFNLEVBQUUsTUFBTTtZQUNkLGdCQUFnQixFQUFFLENBQUM7WUFDbkIsWUFBWSxFQUFFLElBQUksSUFBSSxFQUFFO1lBQ3hCLGNBQWMsRUFBRSxDQUFDO1NBQ2xCLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7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LENBQUMsR0FBRyxDQUFDLFNBQWdCLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbkQsQ0FBQztDQUNGO0FBalhELDhCQWlYQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQmFzZSBBZ2VudCBJbXBsZW1lbnRhdGlvbiBmb3IgT3BlbkFnZW50IEZyYW1ld29ya1xuICovXG5cbmltcG9ydCB7IElBZ2VudCwgVG9vbCwgVG9vbFJlc3VsdCB9IGZyb20gJy4vaW50ZXJmYWNlJztcbmltcG9ydCB7XG4gIEFnZW50UHJvdmlkZXIsXG4gIEFnZW50Q29udGV4dCxcbiAgQWdlbnRSZXNwb25zZSxcbiAgQWdlbnRDb25maWcsXG4gIEFnZW50U3RhdGUsXG4gIEFnZW50TW9kZSxcbiAgQWdlbnRNZXNzYWdlLFxuICBSZUFjdFN0ZXAsXG4gIFRvb2xDYWxsUmVxdWVzdCxcbn0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBUb29sRXhlY3V0b3IgfSBmcm9tICcuLi90b29scy90b29sLWV4ZWN1dG9yJztcbmltcG9ydCB7IFRvb2xEZWZpbml0aW9uIGFzIENvcmVUb29sRGVmaW5pdGlvbiwgVG9vbEV4ZWN1dGlvbkNvbnRleHQgfSBmcm9tICcuLi90b29scy9pbnRlcmZhY2UnO1xuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnLi4vZXZlbnRzL2V2ZW50LWVtaXR0ZXInO1xuaW1wb3J0IHsgTG9nZ2VyLCBjcmVhdGVMb2dnZXIgfSBmcm9tICcuLi9sb2dnZXInO1xuaW1wb3J0IHsgT3BlbkFnZW50RXJyb3IsIEVycm9yQ29kZSB9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgeyBQYXJhbWV0ZXJzLCBNZXRhZGF0YSwgSlNPTlZhbHVlIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVJZCB9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7IHogfSBmcm9tICd6b2QnO1xuXG5jb25zdCBsb2dnZXIgPSBjcmVhdGVMb2dnZXIoJ0Jhc2VBZ2VudCcpO1xuXG4vKipcbiAqIEFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIGFsbCBhZ2VudCBpbXBsZW1lbnRhdGlvbnNcbiAqIFxuICogUHJvdmlkZXMgY29tbW9uIGZ1bmN0aW9uYWxpdHk6XG4gKiAtIFRvb2wgbWFuYWdlbWVudFxuICogLSBFdmVudCBlbWlzc2lvblxuICogLSBTdGF0ZSBtYW5hZ2VtZW50XG4gKiAtIEVycm9yIGhhbmRsaW5nXG4gKiAtIExvZ2dpbmdcbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VBZ2VudCBpbXBsZW1lbnRzIElBZ2VudCB7XG4gIHByb3RlY3RlZCB0b29sczogTWFwPHN0cmluZywgVG9vbD47XG4gIHByb3RlY3RlZCB0b29sRXhlY3V0b3I6IFRvb2xFeGVjdXRvcjtcbiAgcHJvdGVjdGVkIGV2ZW50RW1pdHRlcjogRXZlbnRFbWl0dGVyO1xuICBwcm90ZWN0ZWQgY29uZmlnOiBBZ2VudENvbmZpZztcbiAgcHJvdGVjdGVkIF9zdGF0ZTogQWdlbnRTdGF0ZTtcbiAgcHJvdGVjdGVkIGxvZ2dlcjogTG9nZ2VyO1xuICBwcm90ZWN0ZWQgbWVzc2FnZUhpc3Rvcnk6IEFnZW50TWVzc2FnZVtdO1xuXG4gIGFic3RyYWN0IHJlYWRvbmx5IGlkOiBzdHJpbmc7XG4gIGFic3RyYWN0IHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgYWJzdHJhY3QgcmVhZG9ubHkgcHJvdmlkZXI6IEFnZW50UHJvdmlkZXI7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBBZ2VudENvbmZpZykge1xuICAgIHRoaXMudG9vbHMgPSBuZXcgTWFwKCk7XG4gICAgdGhpcy50b29sRXhlY3V0b3IgPSBuZXcgVG9vbEV4ZWN1dG9yKHVuZGVmaW5lZCwgY3JlYXRlTG9nZ2VyKCdBZ2VudFRvb2xFeGVjdXRvcicpKTtcbiAgICB0aGlzLmV2ZW50RW1pdHRlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLm1lc3NhZ2VIaXN0b3J5ID0gW107XG4gICAgdGhpcy5sb2dnZXIgPSBsb2dnZXIuY2hpbGQoeyBhZ2VudElkOiBjb25maWcuaWQsIGFnZW50TmFtZTogY29uZmlnLm5hbWUgfSk7XG5cbiAgICB0aGlzLl9zdGF0ZSA9IHtcbiAgICAgIHN0YXR1czogJ2lkbGUnLFxuICAgICAgY3VycmVudEl0ZXJhdGlvbjogMCxcbiAgICAgIGxhc3RBY3Rpdml0eTogbmV3IERhdGUoKSxcbiAgICAgIHRvdGFsVG9vbENhbGxzOiAwLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogR2V0IGN1cnJlbnQgYWdlbnQgc3RhdGVcbiAgICovXG4gIGdldCBzdGF0ZSgpOiBBZ2VudFN0YXRlIHtcbiAgICByZXR1cm4geyAuLi50aGlzLl9zdGF0ZSB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgdGhlIGFnZW50IC0gbXVzdCBiZSBpbXBsZW1lbnRlZCBieSBzdWJjbGFzc2VzXG4gICAqL1xuICBhYnN0cmFjdCBydW4oaW5wdXQ6IHN0cmluZywgY29udGV4dD86IEFnZW50Q29udGV4dCk6IFByb21pc2U8QWdlbnRSZXNwb25zZT47XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGFnZW50XG4gICAqL1xuICBhc3luYyBpbml0aWFsaXplKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdJbml0aWFsaXppbmcgYWdlbnQnLCB7IGlkOiB0aGlzLmlkIH0pO1xuICAgIFxuICAgIC8vIFJlZ2lzdGVyIGFsbCB0b29scyB3aXRoIHRoZSBleGVjdXRvclxuICAgIGZvciAoY29uc3QgW25hbWUsIHRvb2xdIG9mIHRoaXMudG9vbHMpIHtcbiAgICAgICAgY29uc3QgY29yZVRvb2xEZWY6IENvcmVUb29sRGVmaW5pdGlvbiA9IHtcbiAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXG4gICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZGVzY3JpcHRpb24sXG4gICAgICAgICAgcGFyYW1ldGVyczogdG9vbC5wYXJhbWV0ZXJzLFxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgdGhpcy50b29sRXhlY3V0b3IucmVnaXN0ZXIoXG4gICAgICAgICAgY29yZVRvb2xEZWYsXG4gICAgICAgICAgYXN5bmMgKHBhcmFtczogUGFyYW1ldGVycywgY3R4PzogVG9vbEV4ZWN1dGlvbkNvbnRleHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRvb2wuZXhlY3V0ZShwYXJhbXMpO1xuICAgICAgICAgICAgLy8gQ29udmVydCBUb29sUmVzdWx0IHRvIHRoZSBDb3JlIFRvb2xSZXN1bHQgZm9ybWF0XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdWNjZXNzOiByZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICAgICAgZGF0YTogcmVzdWx0LmRhdGEgYXMgSlNPTlZhbHVlIHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICBlcnJvcjogcmVzdWx0LmVycm9yLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICB0aGlzLl9zdGF0ZS5zdGF0dXMgPSAnaWRsZSc7XG4gICAgdGhpcy5fc3RhdGUubGFzdEFjdGl2aXR5ID0gbmV3IERhdGUoKTtcblxuICAgIHRoaXMubG9nZ2VyLmluZm8oJ0FnZW50IGluaXRpYWxpemVkJywgeyBpZDogdGhpcy5pZCwgdG9vbENvdW50OiB0aGlzLnRvb2xzLnNpemUgfSk7XG4gIH1cblxuICAvKipcbiAgICogRGVzdHJveSB0aGUgYWdlbnQgYW5kIGNsZWFudXAgcmVzb3VyY2VzXG4gICAqL1xuICBhc3luYyBkZXN0cm95KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdEZXN0cm95aW5nIGFnZW50JywgeyBpZDogdGhpcy5pZCB9KTtcbiAgICBcbiAgICB0aGlzLnRvb2xzLmNsZWFyKCk7XG4gICAgdGhpcy5tZXNzYWdlSGlzdG9yeSA9IFtdO1xuICAgIHRoaXMuX3N0YXRlLnN0YXR1cyA9ICdpZGxlJztcbiAgICB0aGlzLmV2ZW50RW1pdHRlci5jbGVhcigpO1xuXG4gICAgdGhpcy5sb2dnZXIuaW5mbygnQWdlbnQgZGVzdHJveWVkJywgeyBpZDogdGhpcy5pZCB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSB0b29sIHRvIHRoZSBhZ2VudFxuICAgKi9cbiAgYWRkVG9vbCh0b29sOiBUb29sKTogdm9pZCB7XG4gICAgaWYgKHRoaXMudG9vbHMuaGFzKHRvb2wubmFtZSkpIHtcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oJ1Rvb2wgYWxyZWFkeSBleGlzdHMsIG92ZXJ3cml0aW5nJywgeyB0b29sTmFtZTogdG9vbC5uYW1lIH0pO1xuICAgIH1cblxuICAgIHRoaXMudG9vbHMuc2V0KHRvb2wubmFtZSwgdG9vbCk7XG4gICAgXG4gICAgLy8gUmVnaXN0ZXIgd2l0aCBleGVjdXRvclxuICAgIGNvbnN0IGNvcmVUb29sRGVmOiBDb3JlVG9vbERlZmluaXRpb24gPSB7XG4gICAgICBuYW1lOiB0b29sLm5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbixcbiAgICAgIHBhcmFtZXRlcnM6IHRvb2wucGFyYW1ldGVycyxcbiAgICB9O1xuICAgIFxuICAgIHRoaXMudG9vbEV4ZWN1dG9yLnJlZ2lzdGVyKFxuICAgICAgY29yZVRvb2xEZWYsXG4gICAgICBhc3luYyAocGFyYW1zOiBQYXJhbWV0ZXJzLCBjdHg/OiBUb29sRXhlY3V0aW9uQ29udGV4dCkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0b29sLmV4ZWN1dGUocGFyYW1zKTtcbiAgICAgICAgLy8gQ29udmVydCBUb29sUmVzdWx0IHRvIHRoZSBDb3JlIFRvb2xSZXN1bHQgZm9ybWF0XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogcmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgZGF0YTogcmVzdWx0LmRhdGEgYXMgSlNPTlZhbHVlIHwgdW5kZWZpbmVkLFxuICAgICAgICAgIGVycm9yOiByZXN1bHQuZXJyb3IsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgKTtcblxuICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdUb29sIGFkZGVkJywgeyB0b29sTmFtZTogdG9vbC5uYW1lIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhIHRvb2wgZnJvbSB0aGUgYWdlbnRcbiAgICovXG4gIHJlbW92ZVRvb2wodG9vbE5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICghdGhpcy50b29scy5oYXModG9vbE5hbWUpKSB7XG4gICAgICB0aGlzLmxvZ2dlci53YXJuKCdUb29sIG5vdCBmb3VuZCcsIHsgdG9vbE5hbWUgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy50b29scy5kZWxldGUodG9vbE5hbWUpO1xuICAgIHRoaXMudG9vbEV4ZWN1dG9yLnVucmVnaXN0ZXIodG9vbE5hbWUpO1xuXG4gICAgdGhpcy5sb2dnZXIuZGVidWcoJ1Rvb2wgcmVtb3ZlZCcsIHsgdG9vbE5hbWUgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCByZWdpc3RlcmVkIHRvb2xzXG4gICAqL1xuICBnZXRUb29scygpOiBUb29sW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMudG9vbHMudmFsdWVzKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBhZ2VudCBjb25maWd1cmF0aW9uXG4gICAqL1xuICB1cGRhdGVDb25maWcoY29uZmlnOiBQYXJ0aWFsPEFnZW50Q29uZmlnPik6IHZvaWQge1xuICAgIHRoaXMuY29uZmlnID0geyAuLi50aGlzLmNvbmZpZywgLi4uY29uZmlnIH07XG4gICAgdGhpcy5sb2dnZXIuZGVidWcoJ0NvbmZpZyB1cGRhdGVkJywgeyBjb25maWc6IHRoaXMuY29uZmlnIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhZ2VudCBjb25maWd1cmF0aW9uXG4gICAqL1xuICBnZXRDb25maWcoKTogQWdlbnRDb25maWcge1xuICAgIHJldHVybiB7IC4uLnRoaXMuY29uZmlnIH07XG4gIH1cblxuICAvKipcbiAgICogUGF1c2UgYWdlbnQgZXhlY3V0aW9uXG4gICAqL1xuICBhc3luYyBwYXVzZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5fc3RhdGUuc3RhdHVzID09PSAncnVubmluZycpIHtcbiAgICAgIHRoaXMuX3N0YXRlLnN0YXR1cyA9ICdwYXVzZWQnO1xuICAgICAgdGhpcy5sb2dnZXIuaW5mbygnQWdlbnQgcGF1c2VkJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlc3VtZSBhZ2VudCBleGVjdXRpb25cbiAgICovXG4gIGFzeW5jIHJlc3VtZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5fc3RhdGUuc3RhdHVzID09PSAncGF1c2VkJykge1xuICAgICAgdGhpcy5fc3RhdGUuc3RhdHVzID0gJ3J1bm5pbmcnO1xuICAgICAgdGhpcy5sb2dnZXIuaW5mbygnQWdlbnQgcmVzdW1lZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCBhZ2VudCBzdGF0ZVxuICAgKi9cbiAgcmVzZXQoKTogdm9pZCB7XG4gICAgdGhpcy5fc3RhdGUgPSB7XG4gICAgICBzdGF0dXM6ICdpZGxlJyxcbiAgICAgIGN1cnJlbnRJdGVyYXRpb246IDAsXG4gICAgICBsYXN0QWN0aXZpdHk6IG5ldyBEYXRlKCksXG4gICAgICB0b3RhbFRvb2xDYWxsczogMCxcbiAgICB9O1xuICAgIHRoaXMubWVzc2FnZUhpc3RvcnkgPSBbXTtcbiAgICB0aGlzLmxvZ2dlci5pbmZvKCdBZ2VudCByZXNldCcpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb3RlY3RlZCBoZWxwZXIgdG8gZXhlY3V0ZSBhIHRvb2xcbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBleGVjdXRlVG9vbChcbiAgICB0b29sTmFtZTogc3RyaW5nLFxuICAgIHBhcmFtZXRlcnM6IFBhcmFtZXRlcnMsXG4gICAgY29udGV4dD86IEFnZW50Q29udGV4dFxuICApOiBQcm9taXNlPFRvb2xSZXN1bHQ+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIEVtaXQgdG9vbCBzdGFydCBldmVudFxuICAgICAgYXdhaXQgdGhpcy5ldmVudEVtaXR0ZXIuZW1pdCh7XG4gICAgICAgIHR5cGU6ICd0b29sLmNhbGxlZCcgYXMgYW55LFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCksXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBhZ2VudElkOiB0aGlzLmlkLFxuICAgICAgICAgIHRvb2xOYW1lLFxuICAgICAgICAgIHBhcmFtZXRlcnMsXG4gICAgICAgICAgc2Vzc2lvbklkOiBjb250ZXh0Py5zZXNzaW9uSWQsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgZXhlY0NvbnRleHQ6IFRvb2xFeGVjdXRpb25Db250ZXh0IHwgdW5kZWZpbmVkID0gY29udGV4dCA/IHtcbiAgICAgICAgc2Vzc2lvbklkOiBjb250ZXh0LnNlc3Npb25JZCxcbiAgICAgICAgdXNlcklkOiBjb250ZXh0LnVzZXJJZCxcbiAgICAgICAgdGltZW91dDogY29udGV4dC50aW1lb3V0LFxuICAgICAgfSA6IHVuZGVmaW5lZDtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy50b29sRXhlY3V0b3IuZXhlY3V0ZSh0b29sTmFtZSwgcGFyYW1ldGVycywgZXhlY0NvbnRleHQpO1xuXG4gICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICB0aGlzLl9zdGF0ZS50b3RhbFRvb2xDYWxscysrO1xuXG4gICAgICAvLyBFbWl0IHRvb2wgY29tcGxldGlvbiBldmVudFxuICAgICAgYXdhaXQgdGhpcy5ldmVudEVtaXR0ZXIuZW1pdCh7XG4gICAgICAgIHR5cGU6IHJlc3VsdC5zdWNjZXNzID8gJ3Rvb2wuY29tcGxldGVkJyBhcyBhbnkgOiAndG9vbC5mYWlsZWQnIGFzIGFueSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgYWdlbnRJZDogdGhpcy5pZCxcbiAgICAgICAgICB0b29sTmFtZSxcbiAgICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgICBzdWNjZXNzOiByZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICBzZXNzaW9uSWQ6IGNvbnRleHQ/LnNlc3Npb25JZCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDb252ZXJ0IGJhY2sgdG8gYWdlbnQgVG9vbFJlc3VsdCBmb3JtYXRcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5zdWNjZXNzLFxuICAgICAgICBkYXRhOiByZXN1bHQuZGF0YSxcbiAgICAgICAgZXJyb3I6IHJlc3VsdC5lcnJvcixcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcblxuICAgICAgLy8gRW1pdCB0b29sIGZhaWx1cmUgZXZlbnRcbiAgICAgIGF3YWl0IHRoaXMuZXZlbnRFbWl0dGVyLmVtaXQoe1xuICAgICAgICB0eXBlOiAndG9vbC5mYWlsZWQnIGFzIGFueSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgYWdlbnRJZDogdGhpcy5pZCxcbiAgICAgICAgICB0b29sTmFtZSxcbiAgICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgICBlcnJvcjogZXJyb3JNZXNzYWdlLFxuICAgICAgICAgIHNlc3Npb25JZDogY29udGV4dD8uc2Vzc2lvbklkLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdUb29sIGV4ZWN1dGlvbiBmYWlsZWQnLCBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgRXJyb3IoZXJyb3JNZXNzYWdlKSwge1xuICAgICAgICB0b29sTmFtZSxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycm9yOiBlcnJvck1lc3NhZ2UsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm90ZWN0ZWQgaGVscGVyIHRvIGVtaXQgZXZlbnRzXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgZW1pdEV2ZW50KHR5cGU6IHN0cmluZywgZGF0YTogTWV0YWRhdGEpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmV2ZW50RW1pdHRlci5lbWl0KHtcbiAgICAgIHR5cGU6IHR5cGUgYXMgYW55LFxuICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLFxuICAgICAgZGF0YToge1xuICAgICAgICBhZ2VudElkOiB0aGlzLmlkLFxuICAgICAgICAuLi5kYXRhLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm90ZWN0ZWQgaGVscGVyIHRvIHVwZGF0ZSBzdGF0ZVxuICAgKi9cbiAgcHJvdGVjdGVkIHVwZGF0ZVN0YXRlKHVwZGF0ZXM6IFBhcnRpYWw8QWdlbnRTdGF0ZT4pOiB2b2lkIHtcbiAgICB0aGlzLl9zdGF0ZSA9IHsgLi4udGhpcy5fc3RhdGUsIC4uLnVwZGF0ZXMsIGxhc3RBY3Rpdml0eTogbmV3IERhdGUoKSB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFByb3RlY3RlZCBoZWxwZXIgdG8gYWRkIG1lc3NhZ2UgdG8gaGlzdG9yeVxuICAgKi9cbiAgcHJvdGVjdGVkIGFkZE1lc3NhZ2UobWVzc2FnZTogQWdlbnRNZXNzYWdlKTogdm9pZCB7XG4gICAgdGhpcy5tZXNzYWdlSGlzdG9yeS5wdXNoKG1lc3NhZ2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb3RlY3RlZCBoZWxwZXIgdG8gZ2V0IG1lc3NhZ2UgaGlzdG9yeVxuICAgKi9cbiAgcHJvdGVjdGVkIGdldE1lc3NhZ2VIaXN0b3J5KCk6IEFnZW50TWVzc2FnZVtdIHtcbiAgICByZXR1cm4gWy4uLnRoaXMubWVzc2FnZUhpc3RvcnldO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb3RlY3RlZCBoZWxwZXIgdG8gY2xlYXIgbWVzc2FnZSBoaXN0b3J5XG4gICAqL1xuICBwcm90ZWN0ZWQgY2xlYXJNZXNzYWdlSGlzdG9yeSgpOiB2b2lkIHtcbiAgICB0aGlzLm1lc3NhZ2VIaXN0b3J5ID0gW107XG4gIH1cblxuICAvKipcbiAgICogUHJvdGVjdGVkIGhlbHBlciB0byBidWlsZCBzeXN0ZW0gcHJvbXB0XG4gICAqL1xuICBwcm90ZWN0ZWQgYnVpbGRTeXN0ZW1Qcm9tcHQoKTogc3RyaW5nIHtcbiAgICBsZXQgc3lzdGVtUHJvbXB0ID0gdGhpcy5jb25maWcuc3lzdGVtUHJvbXB0IHx8ICdZb3UgYXJlIGEgaGVscGZ1bCBBSSBhc3Npc3RhbnQuJztcblxuICAgIC8vIEFkZCB0b29sIGRlc2NyaXB0aW9ucyBpZiBpbiBSZUFjdCBtb2RlXG4gICAgaWYgKHRoaXMuY29uZmlnLm1vZGUgPT09ICdyZWFjdCcgJiYgdGhpcy50b29scy5zaXplID4gMCkge1xuICAgICAgY29uc3QgdG9vbERlc2NyaXB0aW9ucyA9IEFycmF5LmZyb20odGhpcy50b29scy52YWx1ZXMoKSlcbiAgICAgICAgLm1hcCh0b29sID0+IGAtICR7dG9vbC5uYW1lfTogJHt0b29sLmRlc2NyaXB0aW9ufWApXG4gICAgICAgIC5qb2luKCdcXG4nKTtcblxuICAgICAgc3lzdGVtUHJvbXB0ICs9IGBcXG5cXG5BdmFpbGFibGUgdG9vbHM6XFxuJHt0b29sRGVzY3JpcHRpb25zfWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN5c3RlbVByb21wdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm90ZWN0ZWQgaGVscGVyIHRvIGNyZWF0ZSBlcnJvciByZXNwb25zZVxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZUVycm9yUmVzcG9uc2UoZXJyb3I6IEVycm9yIHwgc3RyaW5nLCBtZXRhZGF0YT86IE1ldGFkYXRhKTogQWdlbnRSZXNwb25zZSB7XG4gICAgY29uc3QgZXJyb3JNZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvcjtcbiAgICBcbiAgICB0aGlzLmxvZ2dlci5lcnJvcignQ3JlYXRpbmcgZXJyb3IgcmVzcG9uc2UnLCBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgRXJyb3IoZXJyb3JNZXNzYWdlKSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBtZXNzYWdlOiBlcnJvck1lc3NhZ2UsXG4gICAgICBlcnJvcjogZXJyb3JNZXNzYWdlLFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXG4gICAgICAgIGR1cmF0aW9uOiAwLFxuICAgICAgICBmaW5pc2hSZWFzb246ICdlcnJvcicsXG4gICAgICAgIC4uLm1ldGFkYXRhLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFN1YnNjcmliZSB0byBhZ2VudCBldmVudHNcbiAgICovXG4gIG9uKGV2ZW50VHlwZTogc3RyaW5nLCBoYW5kbGVyOiAoZXZlbnQ6IGFueSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4pOiB2b2lkIHtcbiAgICB0aGlzLmV2ZW50RW1pdHRlci5vbihldmVudFR5cGUgYXMgYW55LCBoYW5kbGVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVbnN1YnNjcmliZSBmcm9tIGFnZW50IGV2ZW50c1xuICAgKi9cbiAgb2ZmKGV2ZW50VHlwZTogc3RyaW5nLCBoYW5kbGVyOiAoZXZlbnQ6IGFueSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4pOiB2b2lkIHtcbiAgICB0aGlzLmV2ZW50RW1pdHRlci5vZmYoZXZlbnRUeXBlIGFzIGFueSwgaGFuZGxlcik7XG4gIH1cbn1cbiJdfQ==