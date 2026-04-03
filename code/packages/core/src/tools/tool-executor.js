"use strict";
/**
 * Enhanced Tool Executor Implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolExecutor = void 0;
const client_1 = require("@prisma/client");
const validator_1 = require("../validator");
const logger_1 = require("../logger");
const cache_1 = require("../cache");
const logger = (0, logger_1.createLogger)('ToolExecutor');
/**
 * Enhanced Tool Executor with caching, retry, and statistics
 */
class ToolExecutor {
    prisma;
    tools;
    logger;
    config;
    resultCache;
    constructor(prisma, customLogger, config) {
        this.prisma = prisma || new client_1.PrismaClient();
        this.tools = new Map();
        this.logger = customLogger || logger;
        this.config = config || {};
        // Initialize cache if enabled
        if (this.config.enableCache) {
            this.resultCache = new cache_1.Cache({
                maxSize: 100,
                ttl: this.config.cacheTTL || 300000, // 5 minutes default
            });
        }
    }
    /**
     * Register a tool with its handler and optional schema
     */
    register(tool, handler, schema) {
        this.tools.set(tool.name, {
            definition: tool,
            handler,
            schema,
            stats: {
                totalCalls: 0,
                successfulCalls: 0,
                failedCalls: 0,
                averageDuration: 0,
            },
        });
        this.logger.debug('Tool registered', { toolName: tool.name });
    }
    /**
     * Unregister a tool
     */
    unregister(toolName) {
        this.tools.delete(toolName);
        this.logger.debug('Tool unregistered', { toolName });
    }
    /**
     * Get all registered tools (including from database)
     */
    async getTools() {
        // Get tools from database
        let dbTools = [];
        try {
            dbTools = await this.prisma.tool.findMany({
                where: { enabled: true },
            });
        }
        catch (error) {
            // Gracefully handle if table doesn't exist
        }
        // Merge with registered tools
        const registeredTools = Array.from(this.tools.values()).map(t => t.definition);
        // Combine and deduplicate
        const allTools = [...registeredTools];
        for (const dbTool of dbTools) {
            if (!this.tools.has(dbTool.name)) {
                allTools.push({
                    name: dbTool.name,
                    description: dbTool.description,
                    parameters: JSON.parse(dbTool.schema),
                    enabled: dbTool.enabled,
                });
            }
        }
        return allTools;
    }
    /**
     * Get a specific tool by name
     */
    async getTool(name) {
        // Check registered tools first
        const registered = this.tools.get(name);
        if (registered) {
            return registered.definition;
        }
        // Check database
        try {
            const dbTool = await this.prisma.tool.findUnique({
                where: { name },
            });
            if (!dbTool)
                return null;
            return {
                name: dbTool.name,
                description: dbTool.description,
                parameters: JSON.parse(dbTool.schema),
                enabled: dbTool.enabled,
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Execute a tool with validation, timeout, and error handling
     */
    async execute(toolName, parameters, context) {
        const startTime = Date.now();
        this.logger.info('Tool execution started', {
            toolName,
            sessionId: context?.sessionId,
            userId: context?.userId,
        });
        // Get tool
        const tool = await this.getTool(toolName);
        if (!tool) {
            const error = `Tool not found: ${toolName}`;
            this.logger.warn('Tool not found', { toolName });
            return {
                success: false,
                error,
            };
        }
        // Check if tool is enabled
        if (tool.enabled === false) {
            const error = `Tool is disabled: ${toolName}`;
            this.logger.warn('Tool is disabled', { toolName });
            return {
                success: false,
                error,
            };
        }
        // Validate parameters with enhanced error reporting
        const validation = await this.validateWithSchema(toolName, parameters);
        if (!validation.success) {
            this.logger.warn('Tool parameter validation failed', {
                toolName,
                errors: validation.errors,
            });
            return {
                success: false,
                error: `Validation failed:\n${validation.errors?.map((e) => `  - ${e.path}: ${e.message}`).join('\n')}`,
            };
        }
        // Check cache
        if (this.config.enableCache && this.resultCache) {
            const cacheKey = this.getCacheKey(toolName, parameters);
            const cached = this.resultCache.get(cacheKey);
            if (cached) {
                this.logger.debug('Tool result from cache', { toolName });
                return {
                    ...cached,
                    metadata: { ...cached.metadata, fromCache: true },
                };
            }
        }
        // Create tool call record
        let toolCallId;
        try {
            const toolCall = await this.prisma.toolCall.create({
                data: {
                    sessionId: context?.sessionId,
                    toolName,
                    parameters: JSON.stringify(parameters),
                    status: 'running',
                },
            });
            toolCallId = toolCall.id;
        }
        catch (error) {
            // Gracefully handle if table doesn't exist
            this.logger.debug('Could not create tool call record');
        }
        try {
            // Get handler
            const registered = this.tools.get(toolName);
            if (!registered) {
                throw new Error(`No handler registered for tool: ${toolName}`);
            }
            // Execute with timeout and retry
            const timeout = context?.timeout || tool.timeout || this.config.timeout || 30000;
            const retryAttempts = tool.retryAttempts || this.config.retryAttempts || 0;
            const result = await this.executeWithRetry(registered.handler, validation.data || parameters, context, timeout, retryAttempts);
            const duration = Date.now() - startTime;
            // Update tool call record
            if (toolCallId) {
                try {
                    await this.prisma.toolCall.update({
                        where: { id: toolCallId },
                        data: {
                            status: 'completed',
                            result: JSON.stringify(result.data),
                            completedAt: new Date(),
                        },
                    });
                }
                catch (error) {
                    // Ignore errors
                }
            }
            // Update statistics
            this.updateStats(toolName, duration, true);
            // Cache result
            if (this.config.enableCache && this.resultCache) {
                const cacheKey = this.getCacheKey(toolName, parameters);
                this.resultCache.set(cacheKey, result);
            }
            this.logger.info('Tool execution completed', {
                toolName,
                duration,
                success: result.success,
                sessionId: context?.sessionId,
            });
            return {
                ...result,
                duration,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const duration = Date.now() - startTime;
            // Update tool call record
            if (toolCallId) {
                try {
                    await this.prisma.toolCall.update({
                        where: { id: toolCallId },
                        data: {
                            status: 'failed',
                            error: errorMessage,
                            completedAt: new Date(),
                        },
                    });
                }
                catch (error) {
                    // Ignore errors
                }
            }
            // Update statistics
            this.updateStats(toolName, duration, false);
            this.logger.error('Tool execution failed', error instanceof Error ? error : new Error(errorMessage), {
                toolName,
                duration,
                sessionId: context?.sessionId,
            });
            return {
                success: false,
                error: errorMessage,
                duration,
            };
        }
    }
    /**
     * Validate tool parameters
     */
    async validate(toolName, parameters) {
        const tool = await this.getTool(toolName);
        if (!tool)
            return false;
        // Check required parameters
        for (const [key, param] of Object.entries(tool.parameters)) {
            const typedParam = param;
            if (typedParam.required && !(key in parameters)) {
                this.logger.debug('Missing required parameter', {
                    toolName,
                    parameter: key,
                });
                return false;
            }
            // Check type
            if (key in parameters) {
                const value = parameters[key];
                const type = typedParam.type;
                if (type === 'string' && typeof value !== 'string')
                    return false;
                if (type === 'number' && typeof value !== 'number')
                    return false;
                if (type === 'boolean' && typeof value !== 'boolean')
                    return false;
                if (type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value)))
                    return false;
                if (type === 'array' && !Array.isArray(value))
                    return false;
                // Check enum
                if (typedParam.enum && typeof value === 'string' && !typedParam.enum.includes(value)) {
                    this.logger.debug('Invalid enum value', {
                        toolName,
                        parameter: key,
                        value,
                        allowed: typedParam.enum,
                    });
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Check if a tool is enabled
     */
    async isEnabled(toolName) {
        const tool = await this.getTool(toolName);
        if (!tool)
            return false;
        return tool.enabled !== false;
    }
    /**
     * Get tool statistics
     */
    async getStats(toolName) {
        const tool = this.tools.get(toolName);
        return tool?.stats || null;
    }
    /**
     * Enhanced validation using schema if available
     */
    async validateWithSchema(toolName, parameters) {
        const registered = this.tools.get(toolName);
        // If schema is provided, use it
        if (registered?.schema) {
            const result = validator_1.Validator.safeValidate(registered.schema, parameters);
            if (!result.success) {
                return {
                    success: false,
                    errors: result.errors,
                };
            }
            return {
                success: true,
                data: result.data,
            };
        }
        // Fall back to legacy validation
        const isValid = await this.validate(toolName, parameters);
        return {
            success: isValid,
            data: isValid ? parameters : undefined,
            errors: isValid ? undefined : [{ path: 'parameters', message: 'Invalid parameters', code: 'invalid' }],
        };
    }
    /**
     * Execute with retry logic
     */
    async executeWithRetry(handler, parameters, context, timeout, retryAttempts) {
        let lastError;
        for (let attempt = 0; attempt <= retryAttempts; attempt++) {
            try {
                return await this.executeWithTimeout(handler, parameters, context, timeout);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < retryAttempts) {
                    this.logger.debug('Tool execution failed, retrying', {
                        attempt: attempt + 1,
                        maxAttempts: retryAttempts + 1,
                        error: lastError.message,
                    });
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
            }
        }
        throw lastError || new Error('Tool execution failed after retries');
    }
    /**
     * Execute with timeout control
     */
    async executeWithTimeout(handler, parameters, context, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Tool execution timeout after ${timeout}ms`));
            }, timeout);
            handler(parameters, context)
                .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    /**
     * Update tool statistics
     */
    updateStats(toolName, duration, success) {
        const tool = this.tools.get(toolName);
        if (!tool)
            return;
        tool.stats.totalCalls++;
        if (success) {
            tool.stats.successfulCalls++;
        }
        else {
            tool.stats.failedCalls++;
        }
        // Update average duration
        const totalDuration = tool.stats.averageDuration * (tool.stats.totalCalls - 1) + duration;
        tool.stats.averageDuration = totalDuration / tool.stats.totalCalls;
        tool.stats.lastCalled = new Date();
    }
    /**
     * Generate cache key for tool execution
     */
    getCacheKey(toolName, parameters) {
        return `${toolName}:${JSON.stringify(parameters)}`;
    }
    /**
     * Clear cache
     */
    clearCache() {
        if (this.resultCache) {
            this.resultCache.clear();
            this.logger.debug('Tool result cache cleared');
        }
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        if (!this.resultCache)
            return null;
        const stats = this.resultCache.getStats();
        return {
            size: stats.size,
            maxSize: stats.maxSize,
        };
    }
    /**
     * Destroy the executor and cleanup resources
     */
    destroy() {
        if (this.resultCache) {
            this.resultCache.destroy();
        }
        this.tools.clear();
        this.logger.debug('Tool executor destroyed');
    }
}
exports.ToolExecutor = ToolExecutor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbC1leGVjdXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRvb2wtZXhlY3V0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFFSCwyQ0FBOEM7QUFZOUMsNENBQXlDO0FBQ3pDLHNDQUFpRDtBQUNqRCxvQ0FBaUM7QUFJakMsTUFBTSxNQUFNLEdBQUcsSUFBQSxxQkFBWSxFQUFDLGNBQWMsQ0FBQyxDQUFDO0FBRTVDOztHQUVHO0FBQ0gsTUFBYSxZQUFZO0lBQ2YsTUFBTSxDQUFlO0lBQ3JCLEtBQUssQ0FLVjtJQUNLLE1BQU0sQ0FBUztJQUNmLE1BQU0sQ0FBYTtJQUNuQixXQUFXLENBQXFCO0lBRXhDLFlBQVksTUFBcUIsRUFBRSxZQUFxQixFQUFFLE1BQW1CO1FBQzNFLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxJQUFJLElBQUkscUJBQVksRUFBRSxDQUFDO1FBQzNDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsTUFBTSxHQUFHLFlBQVksSUFBSSxNQUFNLENBQUM7UUFDckMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLElBQUksRUFBRSxDQUFDO1FBRTNCLDhCQUE4QjtRQUM5QixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDNUIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLGFBQUssQ0FBYTtnQkFDdkMsT0FBTyxFQUFFLEdBQUc7Z0JBQ1osR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE1BQU0sRUFBRSxvQkFBb0I7YUFDMUQsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVEsQ0FDTixJQUFvQixFQUNwQixPQUFvQixFQUNwQixNQUFpQztRQUVqQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO1lB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LENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ3JDLENBQUM7SUFFRDs7T0FFRztJQUNLLFdBQVcsQ0FBQyxRQUFnQixFQUFFLFVBQXNCO1FBQzFELE9BQU8sR0FBRyxRQUFRLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO0lBQ3JELENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVU7UUFDUixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNyQixJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3pCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDakQsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWE7UUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVc7WUFBRSxPQUFPLElBQUksQ0FBQztRQUNuQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQzFDLE9BQU87WUFDTCxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7WUFDaEIsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPO1NBQ3ZCLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPO1FBQ0wsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUM3QixDQUFDO1FBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQy9DLENBQUM7Q0FDRjtBQWpnQkQsb0NBaWdCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRW5oYW5jZWQgVG9vbCBFeGVjdXRvciBJbXBsZW1lbnRhdGlvblxuICovXG5cbmltcG9ydCB7IFByaXNtYUNsaWVudCB9IGZyb20gJ0BwcmlzbWEvY2xpZW50JztcbmltcG9ydCB7XG4gIElUb29sRXhlY3V0b3IsXG4gIFRvb2xIYW5kbGVyLFxuICBUb29sRGVmaW5pdGlvbixcbiAgVG9vbEV4ZWN1dGlvbkNvbnRleHQsXG4gIFRvb2xSZXN1bHQsXG4gIFRvb2xQYXJhbWV0ZXIsXG4gIFRvb2xDb25maWcsXG4gIFRvb2xTdGF0cyxcbiAgVmFsaWRhdGlvblJlc3VsdCxcbn0gZnJvbSAnLi9pbnRlcmZhY2UnO1xuaW1wb3J0IHsgVmFsaWRhdG9yIH0gZnJvbSAnLi4vdmFsaWRhdG9yJztcbmltcG9ydCB7IExvZ2dlciwgY3JlYXRlTG9nZ2VyIH0gZnJvbSAnLi4vbG9nZ2VyJztcbmltcG9ydCB7IENhY2hlIH0gZnJvbSAnLi4vY2FjaGUnO1xuaW1wb3J0IHsgUGFyYW1ldGVycyB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IHogfSBmcm9tICd6b2QnO1xuXG5jb25zdCBsb2dnZXIgPSBjcmVhdGVMb2dnZXIoJ1Rvb2xFeGVjdXRvcicpO1xuXG4vKipcbiAqIEVuaGFuY2VkIFRvb2wgRXhlY3V0b3Igd2l0aCBjYWNoaW5nLCByZXRyeSwgYW5kIHN0YXRpc3RpY3NcbiAqL1xuZXhwb3J0IGNsYXNzIFRvb2xFeGVjdXRvciBpbXBsZW1lbnRzIElUb29sRXhlY3V0b3Ige1xuICBwcml2YXRlIHByaXNtYTogUHJpc21hQ2xpZW50O1xuICBwcml2YXRlIHRvb2xzOiBNYXA8c3RyaW5nLCB7XG4gICAgZGVmaW5pdGlvbjogVG9vbERlZmluaXRpb247XG4gICAgaGFuZGxlcjogVG9vbEhhbmRsZXI7XG4gICAgc2NoZW1hPzogei5ab2RUeXBlPGFueSwgYW55LCBhbnk+O1xuICAgIHN0YXRzOiBUb29sU3RhdHM7XG4gIH0+O1xuICBwcml2YXRlIGxvZ2dlcjogTG9nZ2VyO1xuICBwcml2YXRlIGNvbmZpZzogVG9vbENvbmZpZztcbiAgcHJpdmF0ZSByZXN1bHRDYWNoZT86IENhY2hlPFRvb2xSZXN1bHQ+O1xuXG4gIGNvbnN0cnVjdG9yKHByaXNtYT86IFByaXNtYUNsaWVudCwgY3VzdG9tTG9nZ2VyPzogTG9nZ2VyLCBjb25maWc/OiBUb29sQ29uZmlnKSB7XG4gICAgdGhpcy5wcmlzbWEgPSBwcmlzbWEgfHwgbmV3IFByaXNtYUNsaWVudCgpO1xuICAgIHRoaXMudG9vbHMgPSBuZXcgTWFwKCk7XG4gICAgdGhpcy5sb2dnZXIgPSBjdXN0b21Mb2dnZXIgfHwgbG9nZ2VyO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnIHx8IHt9O1xuXG4gICAgLy8gSW5pdGlhbGl6ZSBjYWNoZSBpZiBlbmFibGVkXG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZUNhY2hlKSB7XG4gICAgICB0aGlzLnJlc3VsdENhY2hlID0gbmV3IENhY2hlPFRvb2xSZXN1bHQ+KHtcbiAgICAgICAgbWF4U2l6ZTogMTAwLFxuICAgICAgICB0dGw6IHRoaXMuY29uZmlnLmNhY2hlVFRMIHx8IDMwMDAwMCwgLy8gNSBtaW51dGVzIGRlZmF1bHRcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIHRvb2wgd2l0aCBpdHMgaGFuZGxlciBhbmQgb3B0aW9uYWwgc2NoZW1hXG4gICAqL1xuICByZWdpc3RlcihcbiAgICB0b29sOiBUb29sRGVmaW5pdGlvbixcbiAgICBoYW5kbGVyOiBUb29sSGFuZGxlcixcbiAgICBzY2hlbWE/OiB6LlpvZFR5cGU8YW55LCBhbnksIGFueT5cbiAgKTogdm9pZCB7XG4gICAgdGhpcy50b29scy5zZXQodG9vbC5uYW1lLCB7XG4gICAgICBkZWZpbml0aW9uOiB0b29sLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHNjaGVtYSxcbiAgICAgIHN0YXRzOiB7XG4gICAgICAgIHRvdGFsQ2FsbHM6IDAsXG4gICAgICAgIHN1Y2Nlc3NmdWxDYWxsczogMCxcbiAgICAgICAgZmFpbGVkQ2FsbHM6IDAsXG4gICAgICAgIGF2ZXJhZ2VEdXJhdGlvbjogMCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmxvZ2dlci5kZWJ1ZygnVG9vbCByZWdpc3RlcmVkJywgeyB0b29sTmFtZTogdG9vbC5uYW1lIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVucmVnaXN0ZXIgYSB0b29sXG4gICAqL1xuICB1bnJlZ2lzdGVyKHRvb2xOYW1lOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLnRvb2xzLmRlbGV0ZSh0b29sTmFtZSk7XG4gICAgdGhpcy5sb2dnZXIuZGVidWcoJ1Rvb2wgdW5yZWdpc3RlcmVkJywgeyB0b29sTmFtZSB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYWxsIHJlZ2lzdGVyZWQgdG9vbHMgKGluY2x1ZGluZyBmcm9tIGRhdGFiYXNlKVxuICAgKi9cbiAgYXN5bmMgZ2V0VG9vbHMoKTogUHJvbWlzZTxUb29sRGVmaW5pdGlvbltdPiB7XG4gICAgLy8gR2V0IHRvb2xzIGZyb20gZGF0YWJhc2VcbiAgICBsZXQgZGJUb29sczogYW55W10gPSBbXTtcbiAgICB0cnkge1xuICAgICAgZGJUb29scyA9IGF3YWl0IHRoaXMucHJpc21hLnRvb2wuZmluZE1hbnkoe1xuICAgICAgICB3aGVyZTogeyBlbmFibGVkOiB0cnVlIH0sXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gR3JhY2VmdWxseSBoYW5kbGUgaWYgdGFibGUgZG9lc24ndCBleGlzdFxuICAgIH1cblxuICAgIC8vIE1lcmdlIHdpdGggcmVnaXN0ZXJlZCB0b29sc1xuICAgIGNvbnN0IHJlZ2lzdGVyZWRUb29scyA9IEFycmF5LmZyb20odGhpcy50b29scy52YWx1ZXMoKSkubWFwKHQgPT4gdC5kZWZpbml0aW9uKTtcblxuICAgIC8vIENvbWJpbmUgYW5kIGRlZHVwbGljYXRlXG4gICAgY29uc3QgYWxsVG9vbHMgPSBbLi4ucmVnaXN0ZXJlZFRvb2xzXTtcblxuICAgIGZvciAoY29uc3QgZGJUb29sIG9mIGRiVG9vbHMpIHtcbiAgICAgIGlmICghdGhpcy50b29scy5oYXMoZGJUb29sLm5hbWUpKSB7XG4gICAgICAgIGFsbFRvb2xzLnB1c2goe1xuICAgICAgICAgIG5hbWU6IGRiVG9vbC5uYW1lLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBkYlRvb2wuZGVzY3JpcHRpb24sXG4gICAgICAgICAgcGFyYW1ldGVyczogSlNPTi5wYXJzZShkYlRvb2wuc2NoZW1hKSxcbiAgICAgICAgICBlbmFibGVkOiBkYlRvb2wuZW5hYmxlZCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGFsbFRvb2xzO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHNwZWNpZmljIHRvb2wgYnkgbmFtZVxuICAgKi9cbiAgYXN5bmMgZ2V0VG9vbChuYW1lOiBzdHJpbmcpOiBQcm9taXNlPFRvb2xEZWZpbml0aW9uIHwgbnVsbD4ge1xuICAgIC8vIENoZWNrIHJlZ2lzdGVyZWQgdG9vbHMgZmlyc3RcbiAgICBjb25zdCByZWdpc3RlcmVkID0gdGhpcy50b29scy5nZXQobmFtZSk7XG4gICAgaWYgKHJlZ2lzdGVyZWQpIHtcbiAgICAgIHJldHVybiByZWdpc3RlcmVkLmRlZmluaXRpb247XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZGF0YWJhc2VcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGJUb29sID0gYXdhaXQgdGhpcy5wcmlzbWEudG9vbC5maW5kVW5pcXVlKHtcbiAgICAgICAgd2hlcmU6IHsgbmFtZSB9LFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghZGJUb29sKSByZXR1cm4gbnVsbDtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZTogZGJUb29sLm5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBkYlRvb2wuZGVzY3JpcHRpb24sXG4gICAgICAgIHBhcmFtZXRlcnM6IEpTT04ucGFyc2UoZGJUb29sLnNjaGVtYSksXG4gICAgICAgIGVuYWJsZWQ6IGRiVG9vbC5lbmFibGVkLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgYSB0b29sIHdpdGggdmFsaWRhdGlvbiwgdGltZW91dCwgYW5kIGVycm9yIGhhbmRsaW5nXG4gICAqL1xuICBhc3luYyBleGVjdXRlKFxuICAgIHRvb2xOYW1lOiBzdHJpbmcsXG4gICAgcGFyYW1ldGVyczogUGFyYW1ldGVycyxcbiAgICBjb250ZXh0PzogVG9vbEV4ZWN1dGlvbkNvbnRleHRcbiAgKTogUHJvbWlzZTxUb29sUmVzdWx0PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAgIHRoaXMubG9nZ2VyLmluZm8oJ1Rvb2wgZXhlY3V0aW9uIHN0YXJ0ZWQnLCB7XG4gICAgICB0b29sTmFtZSxcbiAgICAgIHNlc3Npb25JZDogY29udGV4dD8uc2Vzc2lvbklkLFxuICAgICAgdXNlcklkOiBjb250ZXh0Py51c2VySWQsXG4gICAgfSk7XG5cbiAgICAvLyBHZXQgdG9vbFxuICAgIGNvbnN0IHRvb2wgPSBhd2FpdCB0aGlzLmdldFRvb2wodG9vbE5hbWUpO1xuICAgIGlmICghdG9vbCkge1xuICAgICAgY29uc3QgZXJyb3IgPSBgVG9vbCBub3QgZm91bmQ6ICR7dG9vbE5hbWV9YDtcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oJ1Rvb2wgbm90IGZvdW5kJywgeyB0b29sTmFtZSB9KTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcixcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgdG9vbCBpcyBlbmFibGVkXG4gICAgaWYgKHRvb2wuZW5hYmxlZCA9PT0gZmFsc2UpIHtcbiAgICAgIGNvbnN0IGVycm9yID0gYFRvb2wgaXMgZGlzYWJsZWQ6ICR7dG9vbE5hbWV9YDtcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oJ1Rvb2wgaXMgZGlzYWJsZWQnLCB7IHRvb2xOYW1lIH0pO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycm9yLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBWYWxpZGF0ZSBwYXJhbWV0ZXJzIHdpdGggZW5oYW5jZWQgZXJyb3IgcmVwb3J0aW5nXG4gICAgY29uc3QgdmFsaWRhdGlvbiA9IGF3YWl0IHRoaXMudmFsaWRhdGVXaXRoU2NoZW1hKHRvb2xOYW1lLCBwYXJhbWV0ZXJzKTtcbiAgICBpZiAoIXZhbGlkYXRpb24uc3VjY2Vzcykge1xuICAgICAgdGhpcy5sb2dnZXIud2FybignVG9vbCBwYXJhbWV0ZXIgdmFsaWRhdGlvbiBmYWlsZWQnLCB7XG4gICAgICAgIHRvb2xOYW1lLFxuICAgICAgICBlcnJvcnM6IHZhbGlkYXRpb24uZXJyb3JzLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6IGBWYWxpZGF0aW9uIGZhaWxlZDpcXG4ke3ZhbGlkYXRpb24uZXJyb3JzPy5tYXAoKGU6IGFueSkgPT4gYCAgLSAke2UucGF0aH06ICR7ZS5tZXNzYWdlfWApLmpvaW4oJ1xcbicpfWAsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIENoZWNrIGNhY2hlXG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZUNhY2hlICYmIHRoaXMucmVzdWx0Q2FjaGUpIHtcbiAgICAgIGNvbnN0IGNhY2hlS2V5ID0gdGhpcy5nZXRDYWNoZUtleSh0b29sTmFtZSwgcGFyYW1ldGVycyk7XG4gICAgICBjb25zdCBjYWNoZWQgPSB0aGlzLnJlc3VsdENhY2hlLmdldChjYWNoZUtleSk7XG4gICAgICBpZiAoY2FjaGVkKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdUb29sIHJlc3VsdCBmcm9tIGNhY2hlJywgeyB0b29sTmFtZSB9KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi5jYWNoZWQsXG4gICAgICAgICAgbWV0YWRhdGE6IHsgLi4uY2FjaGVkLm1ldGFkYXRhLCBmcm9tQ2FjaGU6IHRydWUgfSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdG9vbCBjYWxsIHJlY29yZFxuICAgIGxldCB0b29sQ2FsbElkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHRvb2xDYWxsID0gYXdhaXQgdGhpcy5wcmlzbWEudG9vbENhbGwuY3JlYXRlKHtcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIHNlc3Npb25JZDogY29udGV4dD8uc2Vzc2lvbklkLFxuICAgICAgICAgIHRvb2xOYW1lLFxuICAgICAgICAgIHBhcmFtZXRlcnM6IEpTT04uc3RyaW5naWZ5KHBhcmFtZXRlcnMpLFxuICAgICAgICAgIHN0YXR1czogJ3J1bm5pbmcnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICB0b29sQ2FsbElkID0gdG9vbENhbGwuaWQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIEdyYWNlZnVsbHkgaGFuZGxlIGlmIHRhYmxlIGRvZXNuJ3QgZXhpc3RcbiAgICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdDb3VsZCBub3QgY3JlYXRlIHRvb2wgY2FsbCByZWNvcmQnKTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgLy8gR2V0IGhhbmRsZXJcbiAgICAgIGNvbnN0IHJlZ2lzdGVyZWQgPSB0aGlzLnRvb2xzLmdldCh0b29sTmFtZSk7XG4gICAgICBpZiAoIXJlZ2lzdGVyZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyBoYW5kbGVyIHJlZ2lzdGVyZWQgZm9yIHRvb2w6ICR7dG9vbE5hbWV9YCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEV4ZWN1dGUgd2l0aCB0aW1lb3V0IGFuZCByZXRyeVxuICAgICAgY29uc3QgdGltZW91dCA9IGNvbnRleHQ/LnRpbWVvdXQgfHwgdG9vbC50aW1lb3V0IHx8IHRoaXMuY29uZmlnLnRpbWVvdXQgfHwgMzAwMDA7XG4gICAgICBjb25zdCByZXRyeUF0dGVtcHRzID0gdG9vbC5yZXRyeUF0dGVtcHRzIHx8IHRoaXMuY29uZmlnLnJldHJ5QXR0ZW1wdHMgfHwgMDtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5leGVjdXRlV2l0aFJldHJ5KFxuICAgICAgICByZWdpc3RlcmVkLmhhbmRsZXIsXG4gICAgICAgIHZhbGlkYXRpb24uZGF0YSB8fCBwYXJhbWV0ZXJzLFxuICAgICAgICBjb250ZXh0LFxuICAgICAgICB0aW1lb3V0LFxuICAgICAgICByZXRyeUF0dGVtcHRzXG4gICAgICApO1xuXG4gICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG5cbiAgICAgIC8vIFVwZGF0ZSB0b29sIGNhbGwgcmVjb3JkXG4gICAgICBpZiAodG9vbENhbGxJZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMucHJpc21hLnRvb2xDYWxsLnVwZGF0ZSh7XG4gICAgICAgICAgICB3aGVyZTogeyBpZDogdG9vbENhbGxJZCB9LFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICBzdGF0dXM6ICdjb21wbGV0ZWQnLFxuICAgICAgICAgICAgICByZXN1bHQ6IEpTT04uc3RyaW5naWZ5KHJlc3VsdC5kYXRhKSxcbiAgICAgICAgICAgICAgY29tcGxldGVkQXQ6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIC8vIElnbm9yZSBlcnJvcnNcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgc3RhdGlzdGljc1xuICAgICAgdGhpcy51cGRhdGVTdGF0cyh0b29sTmFtZSwgZHVyYXRpb24sIHRydWUpO1xuXG4gICAgICAvLyBDYWNoZSByZXN1bHRcbiAgICAgIGlmICh0aGlzLmNvbmZpZy5lbmFibGVDYWNoZSAmJiB0aGlzLnJlc3VsdENhY2hlKSB7XG4gICAgICAgIGNvbnN0IGNhY2hlS2V5ID0gdGhpcy5nZXRDYWNoZUtleSh0b29sTmFtZSwgcGFyYW1ldGVycyk7XG4gICAgICAgIHRoaXMucmVzdWx0Q2FjaGUuc2V0KGNhY2hlS2V5LCByZXN1bHQpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmxvZ2dlci5pbmZvKCdUb29sIGV4ZWN1dGlvbiBjb21wbGV0ZWQnLCB7XG4gICAgICAgIHRvb2xOYW1lLFxuICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgc3VjY2VzczogcmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgIHNlc3Npb25JZDogY29udGV4dD8uc2Vzc2lvbklkLFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLnJlc3VsdCxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPVxuICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJztcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcblxuICAgICAgLy8gVXBkYXRlIHRvb2wgY2FsbCByZWNvcmRcbiAgICAgIGlmICh0b29sQ2FsbElkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wcmlzbWEudG9vbENhbGwudXBkYXRlKHtcbiAgICAgICAgICAgIHdoZXJlOiB7IGlkOiB0b29sQ2FsbElkIH0sXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIHN0YXR1czogJ2ZhaWxlZCcsXG4gICAgICAgICAgICAgIGVycm9yOiBlcnJvck1lc3NhZ2UsXG4gICAgICAgICAgICAgIGNvbXBsZXRlZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAvLyBJZ25vcmUgZXJyb3JzXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHN0YXRpc3RpY3NcbiAgICAgIHRoaXMudXBkYXRlU3RhdHModG9vbE5hbWUsIGR1cmF0aW9uLCBmYWxzZSk7XG5cbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdUb29sIGV4ZWN1dGlvbiBmYWlsZWQnLCBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IgOiBuZXcgRXJyb3IoZXJyb3JNZXNzYWdlKSwge1xuICAgICAgICB0b29sTmFtZSxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIHNlc3Npb25JZDogY29udGV4dD8uc2Vzc2lvbklkLFxuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogZXJyb3JNZXNzYWdlLFxuICAgICAgICBkdXJhdGlvbixcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFZhbGlkYXRlIHRvb2wgcGFyYW1ldGVyc1xuICAgKi9cbiAgYXN5bmMgdmFsaWRhdGUodG9vbE5hbWU6IHN0cmluZywgcGFyYW1ldGVyczogUGFyYW1ldGVycyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IHRvb2wgPSBhd2FpdCB0aGlzLmdldFRvb2wodG9vbE5hbWUpO1xuICAgIGlmICghdG9vbCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gQ2hlY2sgcmVxdWlyZWQgcGFyYW1ldGVyc1xuICAgIGZvciAoY29uc3QgW2tleSwgcGFyYW1dIG9mIE9iamVjdC5lbnRyaWVzKHRvb2wucGFyYW1ldGVycykpIHtcbiAgICAgIGNvbnN0IHR5cGVkUGFyYW0gPSBwYXJhbSBhcyBUb29sUGFyYW1ldGVyO1xuICAgICAgaWYgKHR5cGVkUGFyYW0ucmVxdWlyZWQgJiYgIShrZXkgaW4gcGFyYW1ldGVycykpIHtcbiAgICAgICAgdGhpcy5sb2dnZXIuZGVidWcoJ01pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVyJywge1xuICAgICAgICAgIHRvb2xOYW1lLFxuICAgICAgICAgIHBhcmFtZXRlcjoga2V5LFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBDaGVjayB0eXBlXG4gICAgICBpZiAoa2V5IGluIHBhcmFtZXRlcnMpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBwYXJhbWV0ZXJzW2tleV07XG4gICAgICAgIGNvbnN0IHR5cGUgPSB0eXBlZFBhcmFtLnR5cGU7XG5cbiAgICAgICAgaWYgKHR5cGUgPT09ICdzdHJpbmcnICYmIHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKHR5cGUgPT09ICdudW1iZXInICYmIHR5cGVvZiB2YWx1ZSAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKHR5cGUgPT09ICdib29sZWFuJyAmJiB0eXBlb2YgdmFsdWUgIT09ICdib29sZWFuJykgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodHlwZSA9PT0gJ29iamVjdCcgJiYgKHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcgfHwgdmFsdWUgPT09IG51bGwgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZSkpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICh0eXBlID09PSAnYXJyYXknICYmICFBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIENoZWNrIGVudW1cbiAgICAgICAgaWYgKHR5cGVkUGFyYW0uZW51bSAmJiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmICF0eXBlZFBhcmFtLmVudW0uaW5jbHVkZXModmFsdWUpKSB7XG4gICAgICAgICAgdGhpcy5sb2dnZXIuZGVidWcoJ0ludmFsaWQgZW51bSB2YWx1ZScsIHtcbiAgICAgICAgICAgIHRvb2xOYW1lLFxuICAgICAgICAgICAgcGFyYW1ldGVyOiBrZXksXG4gICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgIGFsbG93ZWQ6IHR5cGVkUGFyYW0uZW51bSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBhIHRvb2wgaXMgZW5hYmxlZFxuICAgKi9cbiAgYXN5bmMgaXNFbmFibGVkKHRvb2xOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCB0b29sID0gYXdhaXQgdGhpcy5nZXRUb29sKHRvb2xOYW1lKTtcbiAgICBpZiAoIXRvb2wpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdG9vbC5lbmFibGVkICE9PSBmYWxzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdG9vbCBzdGF0aXN0aWNzXG4gICAqL1xuICBhc3luYyBnZXRTdGF0cyh0b29sTmFtZTogc3RyaW5nKTogUHJvbWlzZTxUb29sU3RhdHMgfCBudWxsPiB7XG4gICAgY29uc3QgdG9vbCA9IHRoaXMudG9vbHMuZ2V0KHRvb2xOYW1lKTtcbiAgICByZXR1cm4gdG9vbD8uc3RhdHMgfHwgbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmhhbmNlZCB2YWxpZGF0aW9uIHVzaW5nIHNjaGVtYSBpZiBhdmFpbGFibGVcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVXaXRoU2NoZW1hKFxuICAgIHRvb2xOYW1lOiBzdHJpbmcsXG4gICAgcGFyYW1ldGVyczogUGFyYW1ldGVyc1xuICApOiBQcm9taXNlPFZhbGlkYXRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCByZWdpc3RlcmVkID0gdGhpcy50b29scy5nZXQodG9vbE5hbWUpO1xuXG4gICAgLy8gSWYgc2NoZW1hIGlzIHByb3ZpZGVkLCB1c2UgaXRcbiAgICBpZiAocmVnaXN0ZXJlZD8uc2NoZW1hKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBWYWxpZGF0b3Iuc2FmZVZhbGlkYXRlKHJlZ2lzdGVyZWQuc2NoZW1hLCBwYXJhbWV0ZXJzKTtcbiAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcnM6IHJlc3VsdC5lcnJvcnMsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiByZXN1bHQuZGF0YSBhcyBQYXJhbWV0ZXJzLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBGYWxsIGJhY2sgdG8gbGVnYWN5IHZhbGlkYXRpb25cbiAgICBjb25zdCBpc1ZhbGlkID0gYXdhaXQgdGhpcy52YWxpZGF0ZSh0b29sTmFtZSwgcGFyYW1ldGVycyk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IGlzVmFsaWQsXG4gICAgICBkYXRhOiBpc1ZhbGlkID8gcGFyYW1ldGVycyA6IHVuZGVmaW5lZCxcbiAgICAgIGVycm9yczogaXNWYWxpZCA/IHVuZGVmaW5lZCA6IFt7IHBhdGg6ICdwYXJhbWV0ZXJzJywgbWVzc2FnZTogJ0ludmFsaWQgcGFyYW1ldGVycycsIGNvZGU6ICdpbnZhbGlkJyB9XSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEV4ZWN1dGUgd2l0aCByZXRyeSBsb2dpY1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBleGVjdXRlV2l0aFJldHJ5KFxuICAgIGhhbmRsZXI6IFRvb2xIYW5kbGVyLFxuICAgIHBhcmFtZXRlcnM6IFBhcmFtZXRlcnMsXG4gICAgY29udGV4dDogVG9vbEV4ZWN1dGlvbkNvbnRleHQgfCB1bmRlZmluZWQsXG4gICAgdGltZW91dDogbnVtYmVyLFxuICAgIHJldHJ5QXR0ZW1wdHM6IG51bWJlclxuICApOiBQcm9taXNlPFRvb2xSZXN1bHQ+IHtcbiAgICBsZXQgbGFzdEVycm9yOiBFcnJvciB8IHVuZGVmaW5lZDtcblxuICAgIGZvciAobGV0IGF0dGVtcHQgPSAwOyBhdHRlbXB0IDw9IHJldHJ5QXR0ZW1wdHM7IGF0dGVtcHQrKykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZXhlY3V0ZVdpdGhUaW1lb3V0KGhhbmRsZXIsIHBhcmFtZXRlcnMsIGNvbnRleHQsIHRpbWVvdXQpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbGFzdEVycm9yID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFN0cmluZyhlcnJvcikpO1xuXG4gICAgICAgIGlmIChhdHRlbXB0IDwgcmV0cnlBdHRlbXB0cykge1xuICAgICAgICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdUb29sIGV4ZWN1dGlvbiBmYWlsZWQsIHJldHJ5aW5nJywge1xuICAgICAgICAgICAgYXR0ZW1wdDogYXR0ZW1wdCArIDEsXG4gICAgICAgICAgICBtYXhBdHRlbXB0czogcmV0cnlBdHRlbXB0cyArIDEsXG4gICAgICAgICAgICBlcnJvcjogbGFzdEVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBFeHBvbmVudGlhbCBiYWNrb2ZmXG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PlxuICAgICAgICAgICAgc2V0VGltZW91dChyZXNvbHZlLCBNYXRoLnBvdygyLCBhdHRlbXB0KSAqIDEwMDApXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IGxhc3RFcnJvciB8fCBuZXcgRXJyb3IoJ1Rvb2wgZXhlY3V0aW9uIGZhaWxlZCBhZnRlciByZXRyaWVzJyk7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZSB3aXRoIHRpbWVvdXQgY29udHJvbFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBleGVjdXRlV2l0aFRpbWVvdXQoXG4gICAgaGFuZGxlcjogVG9vbEhhbmRsZXIsXG4gICAgcGFyYW1ldGVyczogUGFyYW1ldGVycyxcbiAgICBjb250ZXh0OiBUb29sRXhlY3V0aW9uQ29udGV4dCB8IHVuZGVmaW5lZCxcbiAgICB0aW1lb3V0OiBudW1iZXJcbiAgKTogUHJvbWlzZTxUb29sUmVzdWx0PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFRvb2wgZXhlY3V0aW9uIHRpbWVvdXQgYWZ0ZXIgJHt0aW1lb3V0fW1zYCkpO1xuICAgICAgfSwgdGltZW91dCk7XG5cbiAgICAgIGhhbmRsZXIocGFyYW1ldGVycywgY29udGV4dClcbiAgICAgICAgLnRoZW4oKHJlc3VsdDogVG9vbFJlc3VsdCkgPT4ge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGVycm9yOiBFcnJvcikgPT4ge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRvb2wgc3RhdGlzdGljc1xuICAgKi9cbiAgcHJpdmF0ZSB1cGRhdGVTdGF0cyh0b29sTmFtZTogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyLCBzdWNjZXNzOiBib29sZWFuKTogdm9pZCB7XG4gICAgY29uc3QgdG9vbCA9IHRoaXMudG9vbHMuZ2V0KHRvb2xOYW1lKTtcbiAgICBpZiAoIXRvb2wpIHJldHVybjtcblxuICAgIHRvb2wuc3RhdHMudG90YWxDYWxscysrO1xuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICB0b29sLnN0YXRzLnN1Y2Nlc3NmdWxDYWxscysrO1xuICAgIH0gZWxzZSB7XG4gICAgICB0b29sLnN0YXRzLmZhaWxlZENhbGxzKys7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGF2ZXJhZ2UgZHVyYXRpb25cbiAgICBjb25zdCB0b3RhbER1cmF0aW9uID0gdG9vbC5zdGF0cy5hdmVyYWdlRHVyYXRpb24gKiAodG9vbC5zdGF0cy50b3RhbENhbGxzIC0gMSkgKyBkdXJhdGlvbjtcbiAgICB0b29sLnN0YXRzLmF2ZXJhZ2VEdXJhdGlvbiA9IHRvdGFsRHVyYXRpb24gLyB0b29sLnN0YXRzLnRvdGFsQ2FsbHM7XG5cbiAgICB0b29sLnN0YXRzLmxhc3RDYWxsZWQgPSBuZXcgRGF0ZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGNhY2hlIGtleSBmb3IgdG9vbCBleGVjdXRpb25cbiAgICovXG4gIHByaXZhdGUgZ2V0Q2FjaGVLZXkodG9vbE5hbWU6IHN0cmluZywgcGFyYW1ldGVyczogUGFyYW1ldGVycyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke3Rvb2xOYW1lfToke0pTT04uc3RyaW5naWZ5KHBhcmFtZXRlcnMpfWA7XG4gIH1cblxuICAvKipcbiAgICogQ2xlYXIgY2FjaGVcbiAgICovXG4gIGNsZWFyQ2FjaGUoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucmVzdWx0Q2FjaGUpIHtcbiAgICAgIHRoaXMucmVzdWx0Q2FjaGUuY2xlYXIoKTtcbiAgICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdUb29sIHJlc3VsdCBjYWNoZSBjbGVhcmVkJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBjYWNoZSBzdGF0aXN0aWNzXG4gICAqL1xuICBnZXRDYWNoZVN0YXRzKCk6IHsgc2l6ZTogbnVtYmVyOyBtYXhTaXplOiBudW1iZXIgfSB8IG51bGwge1xuICAgIGlmICghdGhpcy5yZXN1bHRDYWNoZSkgcmV0dXJuIG51bGw7XG4gICAgY29uc3Qgc3RhdHMgPSB0aGlzLnJlc3VsdENhY2hlLmdldFN0YXRzKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNpemU6IHN0YXRzLnNpemUsXG4gICAgICBtYXhTaXplOiBzdGF0cy5tYXhTaXplLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRGVzdHJveSB0aGUgZXhlY3V0b3IgYW5kIGNsZWFudXAgcmVzb3VyY2VzXG4gICAqL1xuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnJlc3VsdENhY2hlKSB7XG4gICAgICB0aGlzLnJlc3VsdENhY2hlLmRlc3Ryb3koKTtcbiAgICB9XG4gICAgdGhpcy50b29scy5jbGVhcigpO1xuICAgIHRoaXMubG9nZ2VyLmRlYnVnKCdUb29sIGV4ZWN1dG9yIGRlc3Ryb3llZCcpO1xuICB9XG59XG4iXX0=