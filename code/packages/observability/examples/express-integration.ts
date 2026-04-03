/**
 * Express.js Integration Example
 * 
 * This example demonstrates how to integrate observability into an Express.js
 * application with request tracing, performance monitoring, and structured logging.
 * 
 * Run with: npx ts-node examples/express-integration.ts
 */

import express, { Request, Response, NextFunction } from 'express';
import {
  Tracer,
  MetricRegistry,
  Logger,
  ConsoleSpanExporter,
  ConsoleTransport,
  JsonFormatter,
  PrettyFormatter,
  Span,
} from '../src';

/**
 * Observability Middleware for Express
 * 
 * Provides:
 * - Distributed tracing for each request
 * - Request/response metrics
 * - Structured logging with request context
 * - Error tracking
 */
class ObservabilityMiddleware {
  private tracer: Tracer;
  private metrics: MetricRegistry;
  private logger: Logger;

  // Metrics
  private requestCounter: ReturnType<typeof this.metrics.createCounter>;
  private responseTimeHistogram: ReturnType<typeof this.metrics.createHistogram>;
  private activeRequestsGauge: ReturnType<typeof this.metrics.createGauge>;
  private errorCounter: ReturnType<typeof this.metrics.createCounter>;

  constructor(config: { serviceName: string }) {
    // Initialize Tracer
    this.tracer = new Tracer({
      name: config.serviceName,
      exporter: new ConsoleSpanExporter({ prettyPrint: false }),
      samplingRate: 1.0,
    });

    // Initialize Metrics
    this.metrics = new MetricRegistry({
      defaultLabels: {
        service: config.serviceName,
      },
    });

    // Initialize Logger
    this.logger = new Logger({
      name: config.serviceName,
      level: 'info',
      transports: [
        new ConsoleTransport({
          formatter: new PrettyFormatter(),
        }),
      ],
      context: {
        service: config.serviceName,
      },
    });

    // Create metrics
    this.requestCounter = this.metrics.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
    });

    this.responseTimeHistogram = this.metrics.createHistogram(
      'http_request_duration_seconds',
      {
        description: 'HTTP request duration in seconds',
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      }
    );

    this.activeRequestsGauge = this.metrics.createGauge('http_active_requests', {
      description: 'Number of active HTTP requests',
    });

    this.errorCounter = this.metrics.createCounter('http_errors_total', {
      description: 'Total number of HTTP errors',
    });
  }

  /**
   * Get Express middleware for observability
   */
  getMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const requestId = this.generateRequestId();

      // Increment active requests
      this.activeRequestsGauge.inc();

      // Create request logger with context
      const requestLogger = this.logger.child({
        requestId,
        method: req.method,
        path: req.path,
      });

      // Attach logger to request for use in route handlers
      (req as any).logger = requestLogger;
      (req as any).requestId = requestId;

      // Start tracing span
      const spanName = `${req.method} ${req.path}`;

      try {
        await this.tracer.withSpan(spanName, async (span) => {
          // Set span attributes
          this.tracer.setAttributes(span, {
            'http.method': req.method,
            'http.url': req.url,
            'http.path': req.path,
            'http.host': req.hostname,
            'http.scheme': req.protocol,
            'http.user_agent': req.get('user-agent') || '',
            'request.id': requestId,
          });

          // Add trace ID to response headers for debugging
          res.setHeader('X-Trace-Id', span.traceId);
          res.setHeader('X-Request-Id', requestId);

          requestLogger.debug('Request started');

          // Track response finish
          const originalEnd = res.end;
          res.end = ((...args: any[]) => {
            const duration = (Date.now() - start) / 1000;

            // Update metrics
            this.requestCounter.incWithLabels({
              method: req.method,
              status: res.statusCode.toString(),
              path: this.normalizePath(req.path),
            });

            this.responseTimeHistogram.observeWithLabels(
              {
                method: req.method,
                status: res.statusCode.toString(),
              },
              duration
            );

            // Decrement active requests
            this.activeRequestsGauge.dec();

            // Set span status
            if (res.statusCode >= 400) {
              this.tracer.setAttribute(span, 'http.status_code', res.statusCode);
              this.tracer.addEvent(span, 'error', {
                'error.type': 'http_error',
                'http.status_code': res.statusCode,
              });

              this.errorCounter.incWithLabels({
                method: req.method,
                status: res.statusCode.toString(),
              });

              requestLogger.warn('Request completed with error', {
                status: res.statusCode,
                duration: `${duration}s`,
              });
            } else {
              this.tracer.setAttribute(span, 'http.status_code', res.statusCode);
              requestLogger.info('Request completed', {
                status: res.statusCode,
                duration: `${duration}s`,
              });
            }

            // Call original end
            return (originalEnd as any).apply(res, args);
          }) as any;

          // Store span in request for use in route handlers
          (req as any).span = span;

          // Continue to next middleware
          next();
        });
      } catch (error) {
        // Handle any errors that occur in middleware
        this.activeRequestsGauge.dec();
        next(error);
      }
    };
  }

  /**
   * Error handling middleware
   */
  getErrorMiddleware() {
    return (
      err: Error,
      req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      const span: Span | undefined = (req as any).span;
      const requestLogger: Logger = (req as any).logger || this.logger;

      // Record error in span
      if (span) {
        this.tracer.addEvent(span, 'exception', {
          'exception.type': err.name,
          'exception.message': err.message,
          'exception.stacktrace': err.stack || '',
        });
      }

      // Log error
      requestLogger.error('Request failed with error', {
        error: err.message,
        stack: err.stack,
      });

      // Increment error counter
      this.errorCounter.incWithLabels({
        method: req.method,
        type: err.name,
      });

      // Send error response
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        requestId: (req as any).requestId,
      });
    };
  }

  /**
   * Metrics endpoint for Prometheus scraping
   */
  getMetricsHandler() {
    return (_req: Request, res: Response) => {
      const metrics = this.metrics.exportPrometheus();
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(metrics);
    };
  }

  /**
   * Health check endpoint
   */
  getHealthHandler() {
    return (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Normalize path for metrics (replace dynamic segments)
   */
  private normalizePath(path: string): string {
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/gi, '/:uuid');
  }

  /**
   * Get tracer instance
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Get logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get metrics registry
   */
  getMetrics(): MetricRegistry {
    return this.metrics;
  }
}

/**
 * Example Application
 */
async function createApp() {
  const app = express();

  // Initialize observability
  const observability = new ObservabilityMiddleware({
    serviceName: 'express-example-api',
  });

  // Apply middleware
  app.use(express.json());
  app.use(observability.getMiddleware());

  // Example route: GET /api/users
  app.get('/api/users', async (req: Request, res: Response) => {
    const logger: Logger = (req as any).logger;
    const span: Span = (req as any).span;
    const tracer = observability.getTracer();

    logger.info('Fetching users');
    tracer.addEvent(span, 'db-query-start', { query: 'SELECT * FROM users' });

    // Simulate database query
    await new Promise((resolve) => setTimeout(resolve, 50));

    tracer.addEvent(span, 'db-query-end', { rows: 3 });

    const users = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ];

    res.json({ users, total: users.length });
  });

  // Example route: GET /api/users/:id
  app.get('/api/users/:id', async (req: Request, res: Response) => {
    const logger: Logger = (req as any).logger;
    const span: Span = (req as any).span;
    const tracer = observability.getTracer();
    const userId = req.params.id;

    tracer.setAttribute(span, 'user.id', userId);
    logger.info('Fetching user', { userId });

    // Simulate database query
    await new Promise((resolve) => setTimeout(resolve, 30));

    const user = {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date().toISOString(),
    };

    res.json({ user });
  });

  // Example route: POST /api/users
  app.post('/api/users', async (req: Request, res: Response) => {
    const logger: Logger = (req as any).logger;
    const span: Span = (req as any).span;
    const tracer = observability.getTracer();

    const { name, email } = req.body;

    // Validation
    if (!name || !email) {
      tracer.addEvent(span, 'validation-failed', { reason: 'missing_fields' });
      logger.warn('Validation failed', { name: !!name, email: !!email });
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    tracer.setAttributes(span, {
      'user.name': name,
      'user.email': email,
    });

    logger.info('Creating user', { name, email });

    // Simulate user creation
    await new Promise((resolve) => setTimeout(resolve, 100));

    const newUser = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email,
      createdAt: new Date().toISOString(),
    };

    // Increment custom business metric
    const userCounter = observability.getMetrics().getOrCreateCounter('users_created_total');
    userCounter.inc();

    logger.info('User created', { userId: newUser.id });

    res.status(201).json({ user: newUser });
  });

  // Example route: Simulated error
  app.get('/api/error', (_req: Request, _res: Response) => {
    throw new Error('Simulated error for testing');
  });

  // Example route: Slow endpoint
  app.get('/api/slow', async (req: Request, res: Response) => {
    const logger: Logger = (req as any).logger;

    logger.info('Processing slow request');

    // Simulate slow operation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    res.json({ message: 'Slow operation completed' });
  });

  // Health check endpoint
  app.get('/health', observability.getHealthHandler());

  // Metrics endpoint for Prometheus
  app.get('/metrics', observability.getMetricsHandler());

  // Error handling middleware (must be last)
  app.use(observability.getErrorMiddleware());

  return { app, observability };
}

/**
 * Main function
 */
async function main() {
  console.log('==============================================================');
  console.log('   Express.js Observability Integration Example               ');
  console.log('==============================================================\n');

  const { app } = await createApp();

  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('\nAvailable endpoints:');
    console.log('  GET  /health         - Health check');
    console.log('  GET  /metrics        - Prometheus metrics');
    console.log('  GET  /api/users      - List users');
    console.log('  GET  /api/users/:id  - Get user by ID');
    console.log('  POST /api/users      - Create user');
    console.log('  GET  /api/error      - Simulated error');
    console.log('  GET  /api/slow       - Slow endpoint (2s)');
    console.log('\nTry these commands:');
    console.log(`  curl http://localhost:${PORT}/health`);
    console.log(`  curl http://localhost:${PORT}/metrics`);
    console.log(`  curl http://localhost:${PORT}/api/users`);
    console.log(`  curl -X POST -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com"}' http://localhost:${PORT}/api/users`);
    console.log(`  curl http://localhost:${PORT}/api/error`);
    console.log('\nPress Ctrl+C to stop\n');
  });
}

// Run the example
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { ObservabilityMiddleware, createApp };
