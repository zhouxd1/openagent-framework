// Re-export all types from sub-modules
export * from './tracing/types';
export * from './metrics/types';
export { LogLevel } from './logging/level';

/**
 * Main observability configuration
 */
export interface ObservabilityConfig {
  /** Service name */
  serviceName: string;
  /** Tracing configuration */
  tracing?: TracingConfig;
  /** Metrics configuration */
  metrics?: MetricsConfig;
  /** Logging configuration */
  logging?: LoggingConfig;
}

/**
 * Tracing configuration
 */
export interface TracingConfig {
  /** Enable tracing */
  enabled?: boolean;
  /** Sampling rate (0.0 - 1.0) */
  samplingRate?: number;
  /** Exporter type */
  exporter?: 'console' | 'jaeger' | 'otlp';
  /** Jaeger endpoint URL */
  jaegerEndpoint?: string;
  /** Jaeger service name */
  jaegerServiceName?: string;
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  /** Enable metrics collection */
  enabled?: boolean;
  /** Exporter type */
  exporter?: 'console' | 'prometheus';
  /** Port for Prometheus metrics endpoint */
  prometheusPort?: number;
  /** Default labels for all metrics */
  defaultLabels?: Record<string, string>;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Minimum log level */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Log format */
  format?: 'json' | 'text' | 'pretty';
  /** Transport types */
  transports?: ('console' | 'file')[];
  /** File path for file transport */
  filePath?: string;
  /** Default context/metadata */
  context?: Record<string, any>;
}
