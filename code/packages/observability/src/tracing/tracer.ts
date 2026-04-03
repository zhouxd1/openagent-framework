import {
  Span,
  SpanOptions,
  ITracer,
  TracerConfig,
  SpanExporter,
} from './types';
import { ContextManager } from './context';
import { ConsoleSpanExporter } from './exporters/console';

/**
 * Tracer implements distributed tracing functionality
 * Compatible with OpenTelemetry concepts
 */
export class Tracer implements ITracer {
  private name: string;
  private exporter: SpanExporter;
  private contextManager: ContextManager;
  private samplingRate: number;

  constructor(config: TracerConfig) {
    this.name = config.name;
    this.exporter = config.exporter || new ConsoleSpanExporter();
    this.contextManager = new ContextManager();
    this.samplingRate = config.samplingRate ?? 1.0;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, options?: SpanOptions): Span {
    // Check sampling
    if (!this.shouldSample()) {
      // Return a no-op span that won't be exported
      return this.createNoopSpan(name);
    }

    const parentContext = options?.parent
      ? { traceId: options.parent.traceId, spanId: options.parent.id }
      : this.contextManager.getActive();

    const span: Span = {
      id: this.generateSpanId(),
      traceId: parentContext?.traceId || this.generateTraceId(),
      parentSpanId: parentContext?.spanId,
      name,
      startTime: Date.now(),
      attributes: options?.attributes || {},
      events: [],
      status: { code: 'UNSET' },
    };

    return span;
  }

  /**
   * Execute a function with tracing
   * Automatically handles span lifecycle and error capture
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: SpanOptions
  ): Promise<T> {
    const span = this.startSpan(name, options);

    // Set as active span
    this.contextManager.setActive({
      traceId: span.traceId,
      spanId: span.id,
    });

    try {
      const result = await fn(span);
      span.status = { code: 'OK' };
      return result;
    } catch (error: any) {
      // Record exception
      span.status = {
        code: 'ERROR',
        message: error.message,
      };

      span.events.push({
        name: 'exception',
        timestamp: Date.now(),
        attributes: {
          'exception.type': error.name,
          'exception.message': error.message,
          'exception.stacktrace': error.stack || '',
        },
      });

      throw error;
    } finally {
      span.endTime = Date.now();

      // Export span
      await this.exporter.export([span]);

      // Restore parent context
      this.contextManager.restore();
    }
  }

  /**
   * Add an event to a span
   */
  addEvent(span: Span, name: string, attributes?: Record<string, any>): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes: attributes || {},
    });
  }

  /**
   * Set an attribute on a span
   */
  setAttribute(span: Span, key: string, value: any): void {
    span.attributes[key] = value;
  }

  /**
   * Set multiple attributes on a span
   */
  setAttributes(span: Span, attributes: Record<string, any>): void {
    Object.assign(span.attributes, attributes);
  }

  /**
   * Get the context manager for manual context manipulation
   */
  getContextManager(): ContextManager {
    return this.contextManager;
  }

  /**
   * Check if this trace should be sampled
   */
  private shouldSample(): boolean {
    if (this.samplingRate >= 1.0) return true;
    if (this.samplingRate <= 0.0) return false;
    return Math.random() < this.samplingRate;
  }

  /**
   * Create a no-op span that won't be exported
   */
  private createNoopSpan(name: string): Span {
    return {
      id: 'noop',
      traceId: 'noop',
      name,
      startTime: Date.now(),
      attributes: {},
      events: [],
      status: { code: 'UNSET' },
    };
  }

  /**
   * Generate a unique trace ID
   */
  private generateTraceId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Generate a unique span ID
   */
  private generateSpanId(): string {
    return Math.random().toString(36).substr(2, 16);
  }
}
