/**
 * Complete Observability Setup Example
 * 
 * This example demonstrates how to set up a complete observability stack
 * with distributed tracing, metrics collection, and structured logging.
 * 
 * Run with: npx ts-node examples/complete-setup.ts
 */

import {
  createObservability,
  Tracer,
  MetricRegistry,
  Logger,
  ConsoleSpanExporter,
  JaegerExporter,
  ConsoleTransport,
  JsonFormatter,
  PrettyFormatter,
  GrafanaDashboardGenerator,
  AlertRulesGenerator,
} from '../src';

/**
 * Example 1: Quick Setup with createObservability
 * 
 * The easiest way to get started with all three pillars of observability
 */
async function quickSetup() {
  console.log('=== Example 1: Quick Setup ===\n');

  // Create a complete observability stack in one call
  const { tracer, metrics, logger } = createObservability({
    serviceName: 'my-service',
    tracing: {
      enabled: true,
      samplingRate: 1.0,
      exporter: 'console',
    },
    metrics: {
      enabled: true,
      exporter: 'console',
      defaultLabels: {
        service: 'my-service',
        version: '1.0.0',
      },
    },
    logging: {
      level: 'info',
      format: 'pretty',
    },
  });

  // Use tracing
  await tracer.withSpan('user-registration', async (span) => {
    tracer.setAttribute(span, 'user.id', 'user-123');
    tracer.setAttribute(span, 'user.email', 'user@example.com');

    logger.info('Processing user registration', { userId: 'user-123' });

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));

    tracer.addEvent(span, 'email-sent', { emailType: 'welcome' });

    // Record metrics
    const counter = metrics.getOrCreateCounter('registrations_total');
    counter.inc();
  });

  logger.info('Quick setup example completed');
  console.log('\n');
}

/**
 * Example 2: Manual Configuration
 * 
 * For more control, configure each component separately
 */
async function manualSetup() {
  console.log('=== Example 2: Manual Configuration ===\n');

  // Configure Tracer with custom exporter
  const tracer = new Tracer({
    name: 'manual-service',
    exporter: new ConsoleSpanExporter({ prettyPrint: true }),
    samplingRate: 1.0,
  });

  // Configure Metrics Registry
  const metrics = new MetricRegistry({
    defaultLabels: {
      service: 'manual-service',
      environment: 'development',
    },
  });

  // Configure Logger with custom transport
  const logger = new Logger({
    name: 'manual-service',
    level: 'debug',
    transports: [
      new ConsoleTransport({
        formatter: new PrettyFormatter(),
      }),
    ],
    context: {
      version: '1.0.0',
      hostname: 'localhost',
    },
  });

  // Create metrics
  const requestCounter = metrics.createCounter('api_requests_total', {
    description: 'Total API requests',
  });

  const responseTime = metrics.createHistogram('api_response_time_seconds', {
    description: 'API response time',
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
  });

  const activeUsers = metrics.createGauge('active_users', {
    description: 'Number of active users',
  });

  // Simulate API request
  await tracer.withSpan('api-request', async (span) => {
    const start = Date.now();

    logger.debug('API request started', { endpoint: '/api/users' });
    tracer.setAttribute(span, 'http.method', 'GET');
    tracer.setAttribute(span, 'http.path', '/api/users');

    // Simulate work
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Update metrics
    requestCounter.incWithLabels({ method: 'GET', status: '200' });
    const duration = (Date.now() - start) / 1000;
    responseTime.observe(duration);

    activeUsers.set(42);

    logger.info('API request completed', {
      endpoint: '/api/users',
      duration: `${duration}s`,
    });
  });

  // Export metrics
  console.log('\nMetrics (Prometheus format):');
  console.log(metrics.exportPrometheus());

  console.log('\n');
}

/**
 * Example 3: Production Configuration
 * 
 * A more realistic setup for production environments
 */
async function productionSetup() {
  console.log('=== Example 3: Production Configuration ===\n');

  // Production tracer with Jaeger exporter
  const tracer = new Tracer({
    name: 'production-service',
    exporter: new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      serviceName: 'production-service',
    }),
    samplingRate: 0.1, // 10% sampling in production
  });

  // Production metrics
  const metrics = new MetricRegistry({
    defaultLabels: {
      service: 'production-service',
      environment: 'production',
      region: 'us-east-1',
    },
  });

  // Production logger with JSON format
  const logger = new Logger({
    name: 'production-service',
    level: 'info', // Only info and above in production
    transports: [
      new ConsoleTransport({
        formatter: new JsonFormatter(), // Structured logs for production
      }),
    ],
    context: {
      service: 'production-service',
      version: process.env.APP_VERSION || '1.0.0',
      deployment: process.env.DEPLOYMENT_ID || 'unknown',
    },
  });

  // Create business metrics
  const ordersTotal = metrics.createCounter('orders_total', {
    description: 'Total orders processed',
  });

  const orderValue = metrics.createHistogram('order_value_dollars', {
    description: 'Order value distribution',
    buckets: [10, 25, 50, 100, 250, 500, 1000],
  });

  const queueSize = metrics.createGauge('queue_size', {
    description: 'Current queue size',
  });

  // Simulate order processing
  await tracer.withSpan('process-order', async (span) => {
    const orderId = 'order-789';
    const value = 149.99;

    tracer.setAttributes(span, {
      'order.id': orderId,
      'order.value': value,
      'customer.id': 'customer-456',
    });

    logger.info('Processing order', { orderId, value });

    // Simulate processing steps
    tracer.addEvent(span, 'validation-started');
    await new Promise((resolve) => setTimeout(resolve, 20));
    tracer.addEvent(span, 'validation-completed', { valid: true });

    tracer.addEvent(span, 'payment-started');
    await new Promise((resolve) => setTimeout(resolve, 30));
    tracer.addEvent(span, 'payment-completed', { paymentId: 'pay-123' });

    // Update metrics
    ordersTotal.incWithLabels({ status: 'success' });
    orderValue.observe(value);
    queueSize.dec();

    logger.info('Order processed successfully', {
      orderId,
      value,
      duration: '50ms',
    });
  });

  console.log('\nMetrics would be exposed at /metrics endpoint for Prometheus');
  console.log('Traces would be sent to Jaeger');
  console.log('Logs would be collected by log aggregator\n');
  console.log('\n');
}

/**
 * Example 4: Dashboard and Alert Generation
 */
function generateDashboardsAndAlerts() {
  console.log('=== Example 4: Dashboard and Alert Generation ===\n');

  // Generate Grafana dashboard
  const dashboardGenerator = new GrafanaDashboardGenerator();
  const dashboard = dashboardGenerator.generate({
    title: 'My Service Dashboard',
    refresh: '10s',
  });

  console.log('Grafana Dashboard JSON:');
  console.log(JSON.stringify(dashboard, null, 2));

  // Generate alert rules
  const alertGenerator = new AlertRulesGenerator();
  
  // Add custom alert
  alertGenerator.addGroup({
    name: 'my_service_alerts',
    interval: '30s',
    rules: [
      alertGenerator.createCustomAlert({
        name: 'HighErrorRate',
        expr: 'rate(http_requests_total{status=~"5.."}[5m]) > 0.1',
        for: '5m',
        severity: 'critical',
        summary: 'High error rate detected',
        description: 'Error rate is {{ $value }} requests/s',
      }),
    ],
  });

  const alertYaml = alertGenerator.generateYAML();
  console.log('\nAlert Rules (Prometheus format):');
  console.log(alertYaml);

  console.log('\n');
}

/**
 * Example 5: Error Handling and Recovery
 */
async function errorHandlingExample() {
  console.log('=== Example 5: Error Handling and Recovery ===\n');

  const { tracer, metrics, logger } = createObservability({
    serviceName: 'error-handling-example',
    tracing: { samplingRate: 1.0 },
    logging: { level: 'debug' },
  });

  const errorCounter = metrics.getOrCreateCounter('errors_total', {
    description: 'Total errors',
  });

  const retryCounter = metrics.getOrCreateCounter('retries_total', {
    description: 'Total retries',
  });

  // Simulate operation with retry logic
  async function unreliableOperation(attempt: number): Promise<void> {
    if (attempt < 3) {
      throw new Error(`Operation failed on attempt ${attempt}`);
    }
  }

  await tracer.withSpan('retry-operation', async (span) => {
    let attempt = 0;
    const maxAttempts = 5;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        tracer.addEvent(span, `attempt-${attempt}`, { attempt });
        logger.debug(`Attempt ${attempt}`, { attempt });

        await unreliableOperation(attempt);

        logger.info('Operation succeeded', { attempts: attempt });
        tracer.setAttribute(span, 'success', true);
        tracer.setAttribute(span, 'attempts', attempt);
        return;
      } catch (error: any) {
        logger.warn(`Attempt ${attempt} failed`, {
          attempt,
          error: error.message,
        });

        errorCounter.inc();
        retryCounter.inc();

        if (attempt >= maxAttempts) {
          tracer.setAttribute(span, 'success', false);
          logger.error('All attempts exhausted', {
            maxAttempts,
            lastError: error.message,
          });
          throw error;
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );
      }
    }
  });

  console.log('\n');
}

/**
 * Example 6: Context Propagation
 */
async function contextPropagationExample() {
  console.log('=== Example 6: Context Propagation ===\n');

  const tracer = new Tracer({
    name: 'context-example',
    exporter: new ConsoleSpanExporter({ prettyPrint: true }),
  });

  const logger = new Logger({
    name: 'context-example',
    level: 'debug',
  });

  // Simulate a request flow with context propagation
  await tracer.withSpan('http-request', async (parentSpan) => {
    logger.info('Received HTTP request', { traceId: parentSpan.traceId });

    // Service A: Validation
    await tracer.withSpan(
      'validate-request',
      async (childSpan) => {
        tracer.setAttribute(childSpan, 'service', 'validator');
        logger.debug('Validating request', {
          traceId: childSpan.traceId,
          spanId: childSpan.id,
          parentSpanId: childSpan.parentSpanId,
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
      },
      { parent: parentSpan }
    );

    // Service B: Processing
    await tracer.withSpan(
      'process-request',
      async (childSpan) => {
        tracer.setAttribute(childSpan, 'service', 'processor');
        logger.debug('Processing request', {
          traceId: childSpan.traceId,
          spanId: childSpan.id,
          parentSpanId: childSpan.parentSpanId,
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
      },
      { parent: parentSpan }
    );

    logger.info('Request completed', { traceId: parentSpan.traceId });
  });

  console.log('\n');
}

/**
 * Main function - run all examples
 */
async function main() {
  console.log('==============================================================');
  console.log('   Complete Observability Setup Examples                      ');
  console.log('==============================================================\n');

  try {
    await quickSetup();
    await manualSetup();
    await productionSetup();
    generateDashboardsAndAlerts();
    await errorHandlingExample();
    await contextPropagationExample();

    console.log('All examples completed successfully!\n');
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run the examples
main();
