/**
 * Span status codes
 */
export type SpanStatusCode = 'UNSET' | 'OK' | 'ERROR';

/**
 * Span status
 */
export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

/**
 * Span event
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, any>;
}

/**
 * Span represents a unit of work in a trace
 */
export interface Span {
  /** Unique identifier for this span */
  id: string;
  /** Trace ID that this span belongs to */
  traceId: string;
  /** Parent span ID if this is a child span */
  parentSpanId?: string;
  /** Name of the operation */
  name: string;
  /** Start time in milliseconds since epoch */
  startTime: number;
  /** End time in milliseconds since epoch */
  endTime?: number;
  /** Key-value pairs attached to the span */
  attributes: Record<string, any>;
  /** Events that occurred during the span */
  events: SpanEvent[];
  /** Status of the span */
  status: SpanStatus;
}

/**
 * Options for creating a new span
 */
export interface SpanOptions {
  /** Initial attributes for the span */
  attributes?: Record<string, any>;
  /** Explicit parent span (overrides active span) */
  parent?: Span;
}

/**
 * Span exporter interface
 */
export interface SpanExporter {
  /**
   * Export a batch of spans
   */
  export(spans: Span[]): Promise<void>;
}

/**
 * Tracer interface
 */
export interface ITracer {
  /**
   * Start a new span
   */
  startSpan(name: string, options?: SpanOptions): Span;

  /**
   * Execute a function with tracing
   */
  withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: SpanOptions
  ): Promise<T>;

  /**
   * Add an event to a span
   */
  addEvent(span: Span, name: string, attributes?: Record<string, any>): void;

  /**
   * Set an attribute on a span
   */
  setAttribute(span: Span, key: string, value: any): void;
}

/**
 * Tracer configuration
 */
export interface TracerConfig {
  /** Name of the tracer/service */
  name: string;
  /** Exporter for completed spans */
  exporter?: SpanExporter;
  /** Sampling rate (0.0 - 1.0) */
  samplingRate?: number;
}

/**
 * Jaeger exporter configuration
 */
export interface JaegerConfig {
  /** Jaeger collector endpoint */
  endpoint?: string;
  /** Service name */
  serviceName?: string;
}
