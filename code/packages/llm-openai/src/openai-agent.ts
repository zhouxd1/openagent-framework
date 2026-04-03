/**
 * OpenAI Agent Implementation
 * 
 * An agent implementation that uses OpenAI's chat completion API
 * with full support for function calling and multi-turn conversations.
 * 
 * @packageDocumentation
 */

import { 
  BaseAgent, 
  Tool, 
  AgentContext, 
  AgentResponse, 
  createLogger,
  Logger,
  generateId,
} from '@openagent/core';
import { OpenAIProvider } from './openai-provider';
import { OpenAIAgentConfig, Message, ToolCall, ToolDefinition } from './types';

const logger = createLogger('OpenAIAgent');

/**
 * OpenAI Agent
 * 
 * An intelligent agent that uses OpenAI's chat completion API with support
 * for function calling, multi-turn conversations, and tool execution.
 * 
 * @example
 * ```typescript
 * const agent = new OpenAIAgent({
 *   id: 'my-agent',
 *   name: 'WeatherBot',
 *   provider: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4',
 * });
 * 
 * await agent.initialize();
 * 
 * const response = await agent.run('What is the weather in Tokyo?');
 * console.log(response.message);
 * ```
 */
export class OpenAIAgent extends BaseAgent {
  readonly id: string;
  readonly name: string;
  readonly provider = 'openai' as const;
  
  private openaiProvider: OpenAIProvider;
  private agentLogger: Logger;

  /**
   * Create a new OpenAI agent instance
   * 
   * @param config - Agent configuration
   */
  constructor(config: OpenAIAgentConfig) {
    super(config);
    
    this.id = config.id || `agent-${generateId()}`;
    this.name = config.name || 'OpenAI Agent';
    this.agentLogger = createLogger('OpenAIAgent', { agentId: this.id, agentName: this.name });

    // Initialize OpenAI provider
    this.openaiProvider = new OpenAIProvider({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      organization: config.organization,
    });

    this.agentLogger.info('OpenAI agent created', {
      model: config.model,
      toolCount: this.getTools().length,
    });
  }

  /**
   * Execute the agent with input
   * 
   * This method:
   * 1. Builds the message history with system prompt
   * 2. Converts tools to OpenAI function format
   * 3. Calls the OpenAI API with tool support
   * 4. Handles tool calls and continues conversation
   * 5. Returns the final response
   * 
   * @param input - User input or task description
   * @param context - Optional execution context
   * @returns Agent response
   */
  async run(input: string, context?: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    
    this.agentLogger.info('Agent execution started', {
      input: input.substring(0, 100),
      sessionId: context?.sessionId,
      userId: context?.userId,
    });

    this.updateState({ status: 'running' });

    try {
      // Emit start event
      await this.emitEvent('agent.started' as any, { input });

      // Build messages with conversation history
      const messages = this.buildMessages(input);

      // Convert tools to OpenAI format
      const tools = this.getTools().length > 0 ? this.convertTools(this.getTools()) : undefined;

      // Execute with tools support
      const response = await this.openaiProvider.executeWithTools(
        {
          messages,
          tools,
          toolChoice: tools ? 'auto' : undefined,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
        },
        async (toolCall: ToolCall) => {
          return this.handleToolCall(toolCall, context);
        },
        context?.maxIterations || this.config.maxIterations || 5
      );

      const duration = Date.now() - startTime;

      // Build agent response
      const agentResponse: AgentResponse = {
        success: true,
        message: response.content,
        metadata: {
          provider: this.provider,
          model: response.model || this.config.model,
          tokensUsed: response.usage ? {
            prompt: response.usage.promptTokens,
            completion: response.usage.completionTokens,
            total: response.usage.totalTokens,
          } : undefined,
          duration,
          finishReason: response.finishReason as any,
        },
      };

      // Add message to history
      this.addMessage({
        role: 'user',
        content: input,
      });

      this.addMessage({
        role: 'assistant',
        content: response.content,
      });

      this.updateState({ status: 'idle' });

      // Emit completion event - only include summary data
      await this.emitEvent('agent.completed' as any, { 
        success: true,
        duration,
        tokensUsed: response.usage?.totalTokens,
        finishReason: response.finishReason,
      });

      this.agentLogger.info('Agent execution completed', {
        duration,
        tokensUsed: response.usage?.totalTokens,
        finishReason: response.finishReason,
      });

      return agentResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.updateState({ status: 'error' });

      // Emit error event
      await this.emitEvent('agent.error' as any, { 
        error: errorMessage,
        duration 
      });

      this.agentLogger.error('Agent execution failed', error instanceof Error ? error : new Error(errorMessage), {
        duration,
      });

      return this.createErrorResponse(error instanceof Error ? error : errorMessage, {
        duration,
        provider: this.provider,
      });
    }
  }

  /**
   * Build messages array with conversation history and system prompt
   */
  private buildMessages(input: string): Message[] {
    const messages: Message[] = [];

    // Add system prompt
    const systemPrompt = this.buildSystemPrompt();
    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // Add conversation history
    const history = this.getMessageHistory();
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
        name: msg.name,
        toolCallId: msg.toolCallId,
        toolCalls: msg.toolCalls,
      });
    }

    // Add current input
    messages.push({
      role: 'user',
      content: input,
    });

    return messages;
  }

  /**
   * Convert internal tools to OpenAI function format
   */
  private convertTools(tools: Tool[]): ToolDefinition[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.convertParameters(tool.parameters),
          required: Object.entries(tool.parameters)
            .filter(([, param]) => param.required)
            .map(([name]) => name),
        },
      },
    }));
  }

  /**
   * Convert tool parameters to JSON Schema format
   */
  private convertParameters(
    parameters: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [name, param] of Object.entries(parameters)) {
      result[name] = {
        type: param.type,
        description: param.description,
        enum: param.enum,
        default: param.default,
      };

      if (param.type === 'object' && param.properties) {
        result[name].properties = this.convertParameters(param.properties);
        if (param.required) {
          result[name].required = param.required;
        }
      }

      if (param.type === 'array' && param.items) {
        result[name].items = {
          type: param.items.type,
          description: param.items.description,
        };
      }
    }

    return result;
  }

  /**
   * Handle a tool call from the LLM
   */
  private async handleToolCall(
    toolCall: ToolCall,
    context?: AgentContext
  ): Promise<string> {
    this.agentLogger.debug('Executing tool call', {
      toolName: toolCall.function.name,
      toolCallId: toolCall.id,
    });

    try {
      // Parse arguments
      const args = JSON.parse(toolCall.function.arguments);

      // Execute tool
      const result = await this.executeTool(
        toolCall.function.name,
        args,
        context
      );

      // Return result as JSON string
      const resultString = result.success
        ? JSON.stringify(result.data)
        : JSON.stringify({ error: result.error });

      this.agentLogger.debug('Tool execution completed', {
        toolName: toolCall.function.name,
        success: result.success,
      });

      return resultString;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.agentLogger.error('Tool call failed', error instanceof Error ? error : new Error(errorMessage), {
        toolName: toolCall.function.name,
        toolCallId: toolCall.id,
      });

      return JSON.stringify({ error: errorMessage });
    }
  }

  /**
   * Stream agent response (optional method)
   * 
   * Provides a streaming interface for real-time response generation.
   * 
   * @param input - User input
   * @param context - Optional execution context
   * @yields Response chunks as they arrive
   */
  async *stream(
    input: string,
    context?: AgentContext
  ): AsyncGenerator<string, void, unknown> {
    this.agentLogger.info('Starting streaming execution', {
      input: input.substring(0, 100),
    });

    const messages = this.buildMessages(input);
    const tools = this.getTools().length > 0 ? this.convertTools(this.getTools()) : undefined;

    try {
      for await (const chunk of this.openaiProvider.stream({
        messages,
        tools,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      })) {
        if (chunk.delta) {
          yield chunk.delta;
        }
      }

      this.agentLogger.debug('Streaming completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.agentLogger.error('Streaming failed', error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }
}
