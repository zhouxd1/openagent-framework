# @openagent/observability

Observability toolkit for OpenAgent Framework. Provides comprehensive monitoring capabilities including distributed tracing, metrics collection, structured logging, and dashboard/alerting configurations.

## Features

- ✅ **Distributed Tracing** - OpenTelemetry-compatible tracing with context propagation
- ✅ **Metrics Collection** - Prometheus-compatible metrics (Counter, Gauge, Histogram)
- ✅ **Structured Logging** - Flexible logging with multiple transports and formatters
- ✅ **Grafana Dashboards** - Automatic dashboard generation
- ✅ **Alert Rules** - Prometheus alerting rule generator
- ✅ **TypeScript** - Full type safety with comprehensive type definitions
- ✅ **Extensible** - Plugin architecture for custom exporters and transports

## Installation

```bash
npm install @openagent/observability
```

## Quick Start

### Complete Observability Setup

```typescript
import { createObservability } from '@openagent/observability';

// Create a complete observability stack
const { tracer, metrics, logger } = createObservability({
  serviceName: 'my-service',
  tracing: {
    enabled: true,
    samplingRate: 1.0,
    exporter: 'console',
  },
  metrics: {
    enabled: true,
    exporter: 'prometheus',
    defaultLabels: {
      service: 'my-service',
      env: 'production',
    },
  },
  logging: {
    level: 'info',
    format: 'json',
  },
});
```

### Distributed Tracing

```typescript
import { Tracer, JaegerExporter } from '@openagent/observability';

// Create tracer with Jaeger exporter
const tracer = new Tracer({
  name: 'my-service',
  exporter: new JaegerExporter({
    endpoint: 'http://localhost:14268/api/traces',
    serviceName: 'my-service',
  }),
  samplingRate: 1.0,
});

// Trace an operation
await tracer.withSpan('process-request', async (span) => {
  // Add attributes
  tracer.setAttribute(span, 'user.id', '123');
  tracer.setAttribute(span, 'request.id', 'abc');
  
  // Add events
  tracer.addEvent(span, 'validation-complete', {
    valid: true,
    duration: 50,
  });
  
  // Do work...
  await processRequest();
  
  // Span automatically ends and exports
});
```

### Metrics Collection

```typescript
import { MetricRegistry } from '@openagent/observability';

const registry = new MetricRegistry({
  defaultLabels: { service: 'my-app' },
});

// Counter - for counting events
const requestCounter = registry.createCounter('http_requests_total', {
  description: 'Total HTTP requests',
});
requestCounter.inc();
requestCounter.incWithLabels({ method: 'GET', status: '200' }, 5);

// Gauge - for current values
const activeConnections = registry.createGauge('active_connections', {
  description: 'Active connections',
});
activeConnections.inc();
activeConnections.dec();

// Histogram - for distributions
const responseTime = registry.createHistogram('http_request_duration_seconds', {
  description: 'HTTP request duration',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});
responseTime.observe(0.234);
responseTime.observeWithLabels({ endpoint: '/api/users' }, 0.456);

// Export metrics
const prometheusOutput = await registry.export('prometheus');
console.log(prometheusOutput);
```

### Structured Logging

```typescript
import { Logger, ConsoleTransport, FileTransport, JsonFormatter } from '@openagent/observability';

const logger = new Logger({
  name: 'my-app',
  level: 'info',
  transports: [
    new ConsoleTransport({
      formatter: new JsonFormatter(),
    }),
    // new FileTransport({ filePath: '/var/log/app.log' }),
  ],
  context: {
    service: 'my-app',
    version: '1.0.0',
  },
});

// Log at different levels
logger.debug('Debug message');
logger.info('Request received', { path: '/api/users', method: 'GET' });
logger.warn('Rate limit approaching', { limit: 1000, current: 950 });
logger.error('Database connection failed', { error: 'Connection timeout' });

// Create child logger with additional context
const requestLogger = logger.child({ requestId: 'req-123' });
requestLogger.info('Processing request');

// Time tracking
await logger.time('info', 'Database query', async () => {
  await executeQuery();
});
```

### Grafana Dashboard Generation

```typescript
import { GrafanaDashboardGenerator } from '@openagent/observability';

const generator = new GrafanaDashboardGenerator();

// Generate default dashboard
const dashboard = generator.generate({
  title: 'My Service Dashboard',
  refresh: '10s',
});

// Save to file for import into Grafana
fs.writeFileSync('dashboard.json', JSON.stringify(dashboard, null, 2));
```

### Alert Rules Generation

```typescript
import { AlertRulesGenerator } from '@openagent/observability';

const alertGenerator = new AlertRulesGenerator();

// Generate default OpenAgent alert rules
const alertYaml = alertGenerator.generateYAML();
fs.writeFileSync('alerts.yml', alertYaml);

// Or create custom alerts
alertGenerator.addGroup({
  name: 'custom_alerts',
  interval: '30s',
  rules: [
    alertGenerator.createCustomAlert({
      name: 'HighMemoryUsage',
      expr: 'process_resident_memory_bytes > 1000000000',
      for: '5m',
      severity: 'warning',
      summary: 'High memory usage detected',
      description: 'Memory usage is {{ $value }} bytes',
    }),
  ],
});
```

## API Reference

### Tracing

#### `Tracer`

- `startSpan(name: string, options?: SpanOptions): Span` - Start a new span
- `withSpan<T>(name: string, fn: (span: Span) => Promise<T>, options?: SpanOptions): Promise<T>` - Execute function with tracing
- `addEvent(span: Span, name: string, attributes?: Record<string, any>): void` - Add event to span
- `setAttribute(span: Span, key: string, value: any): void` - Set span attribute

#### Exporters

- `ConsoleSpanExporter` - Export spans to console (for development)
- `JaegerExporter` - Export to Jaeger via HTTP

### Metrics

#### `MetricRegistry`

- `createCounter(name: string, config?: MetricConfig): Counter` - Create a counter
- `createGauge(name: string, config?: MetricConfig): Gauge` - Create a gauge
- `createHistogram(name: string, config?: HistogramConfig): Histogram` - Create a histogram
- `export(format: 'prometheus' | 'json'): Promise<string>` - Export all metrics

#### Metric Types

- **Counter**: Only increases (requests, errors, tasks completed)
  - `inc(value?: number): void`
  - `incWithLabels(labels: Record<string, string>, value?: number): void`

- **Gauge**: Can increase and decrease (temperature, memory usage, active connections)
  - `set(value: number): void`
  - `inc(value?: number): void`
  - `dec(value?: number): void`

- **Histogram**: Observations in buckets (request durations, response sizes)
  - `observe(value: number): void`
  - `getPercentile(p: number): number | undefined`

### Logging

#### `Logger`

- `debug(message: string, meta?: Record<string, any>): void`
- `info(message: string, meta?: Record<string, any>): void`
- `warn(message: string, meta?: Record<string, any>): void`
- `error(message: string, meta?: Record<string, any>): void`
- `child(context: Record<string, any>): Logger` - Create child logger
- `time<T>(level: LogLevel, message: string, fn: () => Promise<T>): Promise<T>` - Time tracking

#### Transports

- `ConsoleTransport` - Log to console
- `FileTransport` - Log to file (Node.js only)
- `MemoryTransport` - Store in memory (for testing)

#### Formatters

- `JsonFormatter` - JSON format
- `TextFormatter` - Human-readable text
- `PrettyFormatter` - Indented format with colors

## Integration Examples

### Express.js Middleware

```typescript
import express from 'express';
import { Tracer, MetricRegistry, Logger } from '@openagent/observability';

const app = express();
const tracer = new Tracer({ name: 'express-app' });
const metrics = new MetricRegistry();
const logger = new Logger({ name: 'express-app' });

// Request counter
const requestCounter = metrics.createCounter('http_requests_total', {
  description: 'Total HTTP requests',
});

// Response time histogram
const responseTime = metrics.createHistogram('http_request_duration_seconds', {
  description: 'HTTP request duration',
});

// Middleware for tracing and metrics
app.use((req, res, next) => {
  const start = Date.now();
  
  tracer.withSpan(`${req.method} ${req.path}`, async (span) => {
    tracer.setAttribute(span, 'http.method', req.method);
    tracer.setAttribute(span, 'http.path', req.path);
    
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      
      requestCounter.incWithLabels({
        method: req.method,
        status: res.statusCode.toString(),
      });
      
      responseTime.observeWithLabels(
        { method: req.method, path: req.path },
        duration
      );
      
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}s`,
      });
    });
    
    next();
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metrics.exportPrometheus());
});

app.listen(3000);
```

### Background Job Processing

```typescript
import { Tracer, Logger, MetricRegistry } from '@openagent/observability';

class JobProcessor {
  private tracer: Tracer;
  private logger: Logger;
  private metrics: MetricRegistry;
  private jobsProcessed: Counter;
  private processingTime: Histogram;

  constructor() {
    this.tracer = new Tracer({ name: 'job-processor' });
    this.logger = new Logger({ name: 'job-processor' });
    this.metrics = new MetricRegistry();
    
    this.jobsProcessed = this.metrics.createCounter('jobs_processed_total', {
      description: 'Total jobs processed',
    });
    
    this.processingTime = this.metrics.createHistogram('job_processing_seconds', {
      description: 'Job processing duration',
      buckets: [1, 5, 10, 30, 60, 120],
    });
  }

  async processJob(job: any): Promise<void> {
    await this.tracer.withSpan('process-job', async (span) => {
      const start = Date.now();
      
      this.tracer.setAttribute(span, 'job.id', job.id);
      this.tracer.setAttribute(span, 'job.type', job.type);
      
      try {
        await this.doWork(job);
        
        this.jobsProcessed.incWithLabels({ status: 'success', type: job.type });
        
        this.logger.info('Job completed', { jobId: job.id, type: job.type });
      } catch (error: any) {
        this.tracer.addEvent(span, 'error', {
          'error.message': error.message,
        });
        
        this.jobsProcessed.incWithLabels({ status: 'error', type: job.type });
        
        this.logger.error('Job failed', {
          jobId: job.id,
          type: job.type,
          error: error.message,
        });
        
        throw error;
      } finally {
        const duration = (Date.now() - start) / 1000;
        this.processingTime.observeWithLabels({ type: job.type }, duration);
      }
    });
  }

  private async doWork(job: any): Promise<void> {
    // Job processing logic
  }
}
```

## Best Practices

### Tracing

1. **Use meaningful span names** - They should describe the operation
2. **Add relevant attributes** - Include IDs, types, and other context
3. **Record errors** - Let `withSpan` capture exceptions automatically
4. **Use sampling in production** - Set `samplingRate` to reduce overhead

### Metrics

1. **Follow Prometheus naming conventions** - Use `_total` for counters, `_seconds` for times
2. **Use labels wisely** - High cardinality labels can cause performance issues
3. **Set appropriate buckets** - For histograms, choose buckets based on expected values
4. **Document your metrics** - Always include descriptions

### Logging

1. **Use appropriate log levels** - debug for development, info for important events, warn/error for issues
2. **Include context** - Use child loggers for request/job context
3. **Use structured logging** - JSON format for production
4. **Don't log sensitive data** - Be careful with passwords, tokens, etc.

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Documentation

For full documentation, see:
- [Tracing Guide](../../docs/observability/tracing.md)
- [Metrics Guide](../../docs/observability/metrics.md)
- [Logging Guide](../../docs/observability/logging.md)
- [Dashboard Setup](../../docs/observability/dashboards.md)

## License

MIT
