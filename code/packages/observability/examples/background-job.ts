/**
 * Background Job Processing Example
 * 
 * This example demonstrates how to use observability in background job
 * processing scenarios, including task tracing, execution time statistics,
 * and error handling.
 * 
 * Run with: npx ts-node examples/background-job.ts
 */

import {
  Tracer,
  MetricRegistry,
  Logger,
  ConsoleSpanExporter,
  ConsoleTransport,
  JsonFormatter,
  PrettyFormatter,
  Span,
  Counter,
  Histogram,
  Gauge,
} from '../src';

/**
 * Job definition
 */
interface Job {
  id: string;
  type: string;
  payload: any;
  priority: 'high' | 'normal' | 'low';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

/**
 * Job result
 */
interface JobResult {
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

/**
 * Job Queue with Observability
 * 
 * Features:
 * - Distributed tracing for each job execution
 * - Job processing metrics (duration, success/failure rates)
 * - Structured logging with job context
 * - Automatic retry with exponential backoff
 */
class ObservableJobQueue {
  private tracer: Tracer;
  private metrics: MetricRegistry;
  private logger: Logger;

  // Job metrics
  private jobsProcessed: Counter;
  private jobDuration: Histogram;
  private jobErrors: Counter;
  private queueSize: Gauge;
  private activeJobs: Gauge;
  private retryCount: Counter;

  private queue: Job[] = [];
  private processing: Map<string, Job> = new Map();
  private handlers: Map<string, (job: Job) => Promise<any>> = new Map();

  constructor(config: { serviceName: string }) {
    // Initialize Tracer
    this.tracer = new Tracer({
      name: `${config.serviceName}-jobs`,
      exporter: new ConsoleSpanExporter({ prettyPrint: false }),
      samplingRate: 1.0,
    });

    // Initialize Metrics
    this.metrics = new MetricRegistry({
      defaultLabels: {
        service: config.serviceName,
        component: 'job-queue',
      },
    });

    // Initialize Logger
    this.logger = new Logger({
      name: `${config.serviceName}-jobs`,
      level: 'debug',
      transports: [
        new ConsoleTransport({
          formatter: new PrettyFormatter(),
        }),
      ],
      context: {
        component: 'job-queue',
      },
    });

    // Create metrics
    this.jobsProcessed = this.metrics.createCounter('jobs_processed_total', {
      description: 'Total number of jobs processed',
    });

    this.jobDuration = this.metrics.createHistogram('job_duration_seconds', {
      description: 'Job processing duration',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
    });

    this.jobErrors = this.metrics.createCounter('job_errors_total', {
      description: 'Total number of job errors',
    });

    this.queueSize = this.metrics.createGauge('queue_size', {
      description: 'Current queue size',
    });

    this.activeJobs = this.metrics.createGauge('active_jobs', {
      description: 'Number of jobs currently being processed',
    });

    this.retryCount = this.metrics.createCounter('job_retries_total', {
      description: 'Total number of job retries',
    });
  }

  /**
   * Register a job handler
   */
  registerHandler(
    jobType: string,
    handler: (job: Job) => Promise<any>
  ): void {
    this.handlers.set(jobType, handler);
    this.logger.info('Job handler registered', { jobType });
  }

  /**
   * Add a job to the queue
   */
  enqueue(job: Omit<Job, 'id' | 'attempts' | 'createdAt'>): string {
    const fullJob: Job = {
      ...job,
      id: this.generateJobId(),
      attempts: 0,
      createdAt: new Date(),
    };

    this.queue.push(fullJob);
    this.queueSize.inc();

    this.logger.info('Job enqueued', {
      jobId: fullJob.id,
      type: fullJob.type,
      priority: fullJob.priority,
    });

    return fullJob.id;
  }

  /**
   * Process a single job with full observability
   */
  async processJob(job: Job): Promise<JobResult> {
    const start = Date.now();
    const jobLogger = this.logger.child({
      jobId: job.id,
      jobType: job.type,
    });

    // Update metrics
    this.activeJobs.inc();
    this.processing.set(job.id, job);

    try {
      const result = await this.tracer.withSpan(
        `job:${job.type}`,
        async (span) => {
          // Set span attributes
          this.tracer.setAttributes(span, {
            'job.id': job.id,
            'job.type': job.type,
            'job.priority': job.priority,
            'job.attempt': job.attempts + 1,
            'job.max_attempts': job.maxAttempts,
          });

          jobLogger.info('Processing job', {
            attempt: job.attempts + 1,
            maxAttempts: job.maxAttempts,
          });

          // Get handler
          const handler = this.handlers.get(job.type);
          if (!handler) {
            throw new Error(`No handler registered for job type: ${job.type}`);
          }

          // Add event: job started
          this.tracer.addEvent(span, 'job-started', {
            payload: JSON.stringify(job.payload),
          });

          // Execute job handler
          const data = await handler(job);

          // Add event: job completed
          this.tracer.addEvent(span, 'job-completed');

          // Update metrics
          const duration = (Date.now() - start) / 1000;
          this.jobsProcessed.incWithLabels({
            type: job.type,
            status: 'success',
          });
          this.jobDuration.observeWithLabels({ type: job.type }, duration);

          jobLogger.info('Job completed', {
            duration: `${duration}s`,
            status: 'success',
          });

          return { success: true, duration, data };
        }
      );

      return result;
    } catch (error: any) {
      const duration = (Date.now() - start) / 1000;

      // Update error metrics
      this.jobErrors.incWithLabels({
        type: job.type,
        error: error.name,
      });
      this.jobsProcessed.incWithLabels({
        type: job.type,
        status: 'error',
      });

      jobLogger.error('Job failed', {
        duration: `${duration}s`,
        error: error.message,
        attempt: job.attempts + 1,
      });

      // Check if we should retry
      if (job.attempts + 1 < job.maxAttempts) {
        return { success: false, duration, error: error.message };
      }

      return { success: false, duration, error: error.message };
    } finally {
      this.activeJobs.dec();
      this.processing.delete(job.id);
    }
  }

  /**
   * Process job with automatic retry
   */
  async processWithRetry(job: Job): Promise<JobResult> {
    let attempt = 0;
    let lastError: string | undefined;

    while (attempt < job.maxAttempts) {
      attempt++;
      job.attempts = attempt - 1;

      const result = await this.processJob(job);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      if (attempt < job.maxAttempts) {
        // Record retry
        this.retryCount.incWithLabels({ type: job.type });

        this.logger.warn('Retrying job', {
          jobId: job.id,
          attempt,
          maxAttempts: job.maxAttempts,
          error: lastError,
        });

        // Exponential backoff
        const backoffMs = Math.pow(2, attempt) * 1000;
        await this.sleep(backoffMs);
      }
    }

    return {
      success: false,
      duration: 0,
      error: lastError || 'Max attempts exceeded',
    };
  }

  /**
   * Process all jobs in the queue
   */
  async processQueue(concurrency: number = 1): Promise<void> {
    this.logger.info('Processing queue', {
      queueSize: this.queue.length,
      concurrency,
    });

    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push(this.worker());
    }

    await Promise.all(workers);

    this.logger.info('Queue processing completed');
  }

  /**
   * Worker that processes jobs from the queue
   */
  private async worker(): Promise<void> {
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      this.queueSize.dec();
      await this.processWithRetry(job);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueSize: number;
    activeJobs: number;
    totalProcessed: number;
  } {
    return {
      queueSize: this.queue.length,
      activeJobs: this.processing.size,
      totalProcessed: 0, // Would need to track this separately
    };
  }

  /**
   * Export metrics
   */
  exportMetrics(): string {
    return this.metrics.exportPrometheus();
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Example job handlers
 */

// Email sending job
async function sendEmailJob(job: Job): Promise<{ messageId: string }> {
  const { to, subject, body } = job.payload;

  // Simulate email sending
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  // Simulate occasional failures
  if (Math.random() < 0.2) {
    throw new Error('SMTP connection failed');
  }

  return {
    messageId: `msg_${Date.now()}`,
  };
}

// Data processing job
async function processDataJob(job: Job): Promise<{ recordsProcessed: number }> {
  const { records } = job.payload;

  // Simulate data processing
  await new Promise((resolve) =>
    setTimeout(resolve, records.length * 10 + Math.random() * 100)
  );

  // Simulate occasional failures
  if (Math.random() < 0.1) {
    throw new Error('Database timeout');
  }

  return {
    recordsProcessed: records.length,
  };
}

// Image processing job
async function processImageJob(job: Job): Promise<{ thumbnailUrl: string }> {
  const { imageUrl, width, height } = job.payload;

  // Simulate image processing
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

  // Simulate occasional failures
  if (Math.random() < 0.15) {
    throw new Error('Image format not supported');
  }

  return {
    thumbnailUrl: imageUrl.replace('.jpg', '_thumbnail.jpg'),
  };
}

// Report generation job
async function generateReportJob(job: Job): Promise<{ reportUrl: string }> {
  const { reportType, dateRange } = job.payload;

  // Simulate report generation
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

  return {
    reportUrl: `/reports/${reportType}_${Date.now()}.pdf`,
  };
}

/**
 * Example: Batch job processing
 */
async function batchProcessingExample() {
  console.log('=== Example 1: Batch Job Processing ===\n');

  const queue = new ObservableJobQueue({ serviceName: 'batch-processor' });

  // Register handlers
  queue.registerHandler('send-email', sendEmailJob);
  queue.registerHandler('process-data', processDataJob);
  queue.registerHandler('process-image', processImageJob);

  // Enqueue batch of jobs
  console.log('Enqueueing jobs...\n');

  // Email jobs
  for (let i = 0; i < 5; i++) {
    queue.enqueue({
      type: 'send-email',
      payload: {
        to: `user${i}@example.com`,
        subject: `Welcome User ${i}`,
        body: 'Welcome to our service!',
      },
      priority: 'normal',
      maxAttempts: 3,
    });
  }

  // Data processing jobs
  queue.enqueue({
    type: 'process-data',
    payload: {
      records: Array.from({ length: 100 }, (_, i) => ({ id: i, value: Math.random() })),
    },
    priority: 'high',
    maxAttempts: 2,
  });

  // Image processing jobs
  for (let i = 0; i < 3; i++) {
    queue.enqueue({
      type: 'process-image',
      payload: {
        imageUrl: `https://example.com/image${i}.jpg`,
        width: 200,
        height: 200,
      },
      priority: 'low',
      maxAttempts: 3,
    });
  }

  // Process queue
  console.log('Processing queue...\n');
  await queue.processQueue(2); // Process with concurrency of 2

  console.log('\nMetrics:');
  console.log(queue.exportMetrics());
  console.log('\n');
}

/**
 * Example: Job with retries and failure
 */
async function retryExample() {
  console.log('=== Example 2: Job Retry Behavior ===\n');

  const queue = new ObservableJobQueue({ serviceName: 'retry-example' });

  // Register a handler that always fails
  queue.registerHandler('failing-job', async (_job: Job) => {
    throw new Error('This job always fails');
  });

  // Enqueue a job that will fail
  queue.enqueue({
    type: 'failing-job',
    payload: { data: 'test' },
    priority: 'normal',
    maxAttempts: 3,
  });

  // Process queue
  console.log('Processing job with retries...\n');
  await queue.processQueue();

  console.log('\nRetry behavior demonstrated!');
  console.log('\n');
}

/**
 * Example: Scheduled job simulation
 */
async function scheduledJobExample() {
  console.log('=== Example 3: Scheduled Jobs ===\n');

  const queue = new ObservableJobQueue({ serviceName: 'scheduled-jobs' });

  // Register handler
  queue.registerHandler('generate-report', generateReportJob);

  // Simulate scheduled reports
  const scheduledJobs = [
    { reportType: 'daily-sales', dateRange: '2024-01-01' },
    { reportType: 'weekly-analytics', dateRange: '2024-W01' },
    { reportType: 'monthly-summary', dateRange: '2024-01' },
  ];

  console.log('Scheduling report generation jobs...\n');

  for (const job of scheduledJobs) {
    queue.enqueue({
      type: 'generate-report',
      payload: job,
      priority: 'low',
      maxAttempts: 2,
    });
  }

  // Process jobs
  await queue.processQueue();

  console.log('\nScheduled jobs completed!');
  console.log('\n');
}

/**
 * Example: Priority-based processing
 */
async function priorityExample() {
  console.log('=== Example 4: Priority-Based Processing ===\n');

  const queue = new ObservableJobQueue({ serviceName: 'priority-queue' });

  // Register simple handler
  queue.registerHandler('test-job', async (job: Job) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { processed: true };
  });

  // Enqueue jobs with different priorities
  console.log('Enqueueing jobs with different priorities...\n');

  // Low priority jobs
  for (let i = 0; i < 3; i++) {
    queue.enqueue({
      type: 'test-job',
      payload: { priority: 'low', index: i },
      priority: 'low',
      maxAttempts: 1,
    });
  }

  // High priority job (should be processed first in a real priority queue)
  queue.enqueue({
    type: 'test-job',
    payload: { priority: 'high', urgent: true },
    priority: 'high',
    maxAttempts: 1,
  });

  // Normal priority jobs
  for (let i = 0; i < 2; i++) {
    queue.enqueue({
      type: 'test-job',
      payload: { priority: 'normal', index: i },
      priority: 'normal',
      maxAttempts: 1,
    });
  }

  // Process queue
  await queue.processQueue();

  console.log('\nNote: In this simple example, jobs are processed in FIFO order.');
  console.log('For true priority processing, implement a priority queue.\n');
  console.log('\n');
}

/**
 * Example: Job metrics and monitoring
 */
async function metricsExample() {
  console.log('=== Example 5: Job Metrics and Monitoring ===\n');

  const queue = new ObservableJobQueue({ serviceName: 'metrics-demo' });

  // Register handler
  queue.registerHandler('mixed-job', async (job: Job) => {
    // Simulate variable processing time
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 150)
    );

    // Simulate occasional failures
    if (Math.random() < 0.3) {
      throw new Error('Random failure');
    }

    return { success: true };
  });

  // Enqueue many jobs
  console.log('Enqueueing 20 jobs...\n');

  for (let i = 0; i < 20; i++) {
    queue.enqueue({
      type: 'mixed-job',
      payload: { index: i },
      priority: 'normal',
      maxAttempts: 2,
    });
  }

  // Process jobs
  await queue.processQueue(3); // Higher concurrency

  // Show metrics
  console.log('\nFinal Metrics:');
  console.log(queue.exportMetrics());

  console.log('\nKey metrics to monitor:');
  console.log('  - jobs_processed_total: Total jobs by type and status');
  console.log('  - job_duration_seconds: Processing time distribution');
  console.log('  - job_errors_total: Error count by type');
  console.log('  - job_retries_total: Retry count by type');
  console.log('\n');
}

/**
 * Main function
 */
async function main() {
  console.log('==============================================================');
  console.log('   Background Job Processing with Observability               ');
  console.log('==============================================================\n');

  try {
    await batchProcessingExample();
    await retryExample();
    await scheduledJobExample();
    await priorityExample();
    await metricsExample();

    console.log('All examples completed successfully!\n');
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run the examples
main();

export { ObservableJobQueue, Job, JobResult };
