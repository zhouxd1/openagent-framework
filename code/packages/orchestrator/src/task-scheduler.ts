/**
 * @fileoverview Task Scheduler
 * @description Manages task scheduling and execution
 */

import { Task, TaskNotFoundError, OrchestratorConfig } from './types';

/**
 * Scheduled task with execution details
 */
interface ScheduledTask extends Task {
  /** Execution timer (if scheduled) */
  timer?: NodeJS.Timeout;
}

/**
 * Task scheduler configuration
 */
export interface SchedulerConfig {
  /** Maximum concurrent tasks */
  maxConcurrent?: number;
  /** Task timeout in milliseconds */
  taskTimeout?: number;
  /** Enable task retries */
  enableRetries?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * Task execution callback
 */
export type TaskExecutor = (task: Task) => Promise<any>;

/**
 * Task scheduler statistics
 */
export interface SchedulerStats {
  /** Total scheduled tasks */
  totalScheduled: number;
  /** Pending tasks */
  pending: number;
  /** Running tasks */
  running: number;
  /** Completed tasks */
  completed: number;
  /** Failed tasks */
  failed: number;
}

/**
 * Task scheduler for managing task execution
 */
export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private taskQueue: string[] = [];
  private runningTasks: Set<string> = new Set();
  private executor?: TaskExecutor;
  private config: SchedulerConfig;
  private stats: SchedulerStats;

  constructor(config: SchedulerConfig = {}) {
    this.config = {
      maxConcurrent: 10,
      taskTimeout: 30000,
      enableRetries: true,
      maxRetries: 3,
      ...config,
    };

    this.stats = {
      totalScheduled: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };
  }

  /**
   * Set the task executor function
   */
  setExecutor(executor: TaskExecutor): void {
    this.executor = executor;
  }

  /**
   * Schedule a new task
   */
  scheduleTask(
    description: string,
    agentId: string,
    options?: {
      priority?: number;
      scheduledAt?: Date;
      metadata?: Record<string, any>;
    }
  ): Task {
    const task: ScheduledTask = {
      id: this.generateTaskId(),
      description,
      agentId,
      priority: options?.priority || 0,
      status: 'pending',
      scheduledAt: options?.scheduledAt,
      createdAt: new Date(),
      metadata: options?.metadata,
    };

    this.tasks.set(task.id, task);
    this.stats.totalScheduled++;
    this.stats.pending++;

    // Add to queue (sorted by priority)
    this.addToQueue(task.id);

    // If scheduled for future, set timer
    if (task.scheduledAt && task.scheduledAt > new Date()) {
      this.scheduleForLater(task);
    } else {
      // Try to execute immediately
      this.tryExecuteNext();
    }

    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.timer) {
      clearTimeout(task.timer);
    }

    // Remove from queue
    const queueIndex = this.taskQueue.indexOf(taskId);
    if (queueIndex > -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    // Update status
    if (task.status === 'pending') {
      this.stats.pending--;
    } else if (task.status === 'running') {
      this.stats.running--;
      this.runningTasks.delete(taskId);
    }

    this.tasks.delete(taskId);
    return true;
  }

  /**
   * Get all tasks with a specific status
   */
  getTasksByStatus(status: Task['status']): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  /**
   * Get tasks for a specific agent
   */
  getTasksByAgent(agentId: string): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.agentId === agentId);
  }

  /**
   * Start the scheduler
   */
  start(): void {
    // Process the queue
    this.processQueue();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    // Clear all timers
    this.tasks.forEach(task => {
      if (task.timer) {
        clearTimeout(task.timer);
      }
    });

    // Clear queue
    this.taskQueue = [];
    this.runningTasks.clear();
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Add task to priority queue
   */
  private addToQueue(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Insert in priority order
    let inserted = false;
    for (let i = 0; i < this.taskQueue.length; i++) {
      const queuedTask = this.tasks.get(this.taskQueue[i]);
      if (queuedTask && queuedTask.priority < task.priority) {
        this.taskQueue.splice(i, 0, taskId);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.taskQueue.push(taskId);
    }
  }

  /**
   * Schedule a task for later execution
   */
  private scheduleForLater(task: ScheduledTask): void {
    if (!task.scheduledAt) return;

    const delay = task.scheduledAt.getTime() - Date.now();
    if (delay <= 0) return;

    task.timer = setTimeout(() => {
      this.tryExecuteTask(task.id);
    }, delay);
  }

  /**
   * Try to execute the next task in the queue
   */
  private tryExecuteNext(): void {
    if (!this.executor) return;

    // Check if we can run more tasks
    if (this.runningTasks.size >= this.config.maxConcurrent!) {
      return;
    }

    // Get next task from queue
    const taskId = this.taskQueue.shift();
    if (!taskId) return;

    this.tryExecuteTask(taskId);
  }

  /**
   * Try to execute a specific task
   */
  private async tryExecuteTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') return;

    if (!this.executor) {
      console.warn('No executor set for task scheduler');
      return;
    }

    // Update task status
    task.status = 'running';
    this.stats.pending--;
    this.stats.running++;
    this.runningTasks.add(taskId);

    let attempts = 0;
    const maxAttempts = this.config.enableRetries ? this.config.maxRetries! : 1;

    while (attempts < maxAttempts) {
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(task);
        
        task.status = 'completed';
        task.metadata = { ...task.metadata, result };
        this.stats.running--;
        this.stats.completed++;
        this.runningTasks.delete(taskId);
        
        break;
      } catch (error) {
        attempts++;
        
        if (attempts >= maxAttempts) {
          task.status = 'failed';
          task.metadata = {
            ...task.metadata,
            error: error instanceof Error ? error.message : String(error),
            attempts,
          };
          this.stats.running--;
          this.stats.failed++;
          this.runningTasks.delete(taskId);
        }
      }
    }

    // Try to execute next task
    this.tryExecuteNext();
  }

  /**
   * Execute a task with timeout
   */
  private async executeWithTimeout(task: ScheduledTask): Promise<any> {
    if (!this.executor) {
      throw new Error('No executor set');
    }

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error('Task timeout'));
      }, this.config.taskTimeout);

      // Execute task
      this.executor!(task)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    while (
      this.taskQueue.length > 0 &&
      this.runningTasks.size < this.config.maxConcurrent!
    ) {
      this.tryExecuteNext();
    }
  }

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
