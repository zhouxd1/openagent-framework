/**
 * @openagent/observability
 * 
 * Observability toolkit for OpenAgent Framework
 * Provides distributed tracing, metrics, and logging capabilities
 */

// Types
export * from './types';

// Tracing
export { Tracer } from './tracing/tracer';
export { SpanUtils } from './tracing/span';
export { ContextManager } from './tracing/context';
export { ConsoleSpanExporter } from './tracing/exporters/console';
export { JaegerExporter } from './tracing/exporters/jaeger';

// Metrics
export { MetricRegistry } from './metrics/registry';
export { Counter } from './metrics/counter';
export { Gauge } from './metrics/gauge';
export { Histogram } from './metrics/histogram';
export { PrometheusExporter } from './metrics/exporters/prometheus';
export { ConsoleMetricExporter } from './metrics/exporters/console';

// Logging
export { Logger } from './logging/logger';
export type { LogEntry, LoggerConfig } from './logging/logger';
export { LogLevelUtils } from './logging/level';
export type { LogLevel } from './logging/level';
export { ConsoleTransport, FileTransport, MemoryTransport } from './logging/transport';
export type { Transport } from './logging/transport';
export { JsonFormatter, TextFormatter, PrettyFormatter } from './logging/formatter';
export type { Formatter } from './logging/formatter';

// Dashboard
export { GrafanaDashboardGenerator } from './dashboard/grafana';
export type { DashboardConfig, PanelConfig } from './dashboard/grafana';
export { AlertRulesGenerator } from './dashboard/alerts';
export type { AlertRule, AlertGroup } from './dashboard/alerts';

// Convenience exports for common use cases
import { Tracer } from './tracing/tracer';
import { MetricRegistry } from './metrics/registry';
import { Logger } from './logging/logger';
import { ObservabilityConfig } from './types';

/**
 * Create a complete observability setup with tracing, metrics, and logging
 */
export function createObservability(config: ObservabilityConfig): {
  tracer: Tracer;
  metrics: MetricRegistry;
  logger: Logger;
} {
  return {
    tracer: new Tracer({
      name: config.serviceName,
      samplingRate: config.tracing?.samplingRate,
    }),
    metrics: new MetricRegistry({
      defaultLabels: config.metrics?.defaultLabels,
    }),
    logger: new Logger({
      name: config.serviceName,
      level: config.logging?.level,
      context: config.logging?.context,
    }),
  };
}
