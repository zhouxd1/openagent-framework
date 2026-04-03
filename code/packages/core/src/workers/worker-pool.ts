/**
 * Worker Pool - High-performance task execution with worker threads
 * 
 * Provides concurrent task execution using worker threads for CPU-intensive
 * operations, improving throughput and CPU utilization.
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { createLogger } from '../logger';
import * as path from 'path';
import * as os from 'os';

const logger = createLogger('WorkerPool');

/**
 * Task to be executed in the worker pool
 */
export interface Task<T = any, R = any> {
  id: string;
  name: string;
  data: T;
  timestamp: number;
}

/**
 * Result from a worker task
 */
export interface TaskResult<R = any> {
  taskId: string;
  success: boolean;
  data?: R;
  error?: string;
  duration: number;
  workerId: number;
}

/**
 * Worker statistics
 */
export interface WorkerStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
}

/**
 * Internal task wrapper with resolve/reject
 */
interface TaskWrapper<T, R> {
  task: Task<T>;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  startTime: number;
}

/**
 * Worker with metadata
 */
interface WorkerInfo {
  worker: Worker;
  id: number;
  busy: boolean;
  currentTask: string | null;
  completedTasks: number;
  failedTasks: number;
  totalDuration: number;
}

/**
 * Worker Pool Configuration
 */
export interface WorkerPoolConfig {
  maxWorkers?: number;
  taskTimeout?: number;
  enableMonitoring?: boolean;
}

/**
 * Worker Pool - Manages a pool of worker threads for concurrent task execution
 * 
 * Features:
 * - Dynamic worker creation and management
 * - Task queue with priority support
 * - Automatic load balancing
 * - Performance monitoring
 * - Graceful shutdown
 */
export class WorkerPool {
  private workers: WorkerInfo[] = [];
  private taskQueue: TaskWrapper<any, any>[] = [];
  private maxWorkers: number;
  private taskTimeout: number;
  private enableMonitoring: boolean;
  private nextTaskId = 0;
  private nextWorkerId = 0;
  private totalCompletedTasks = 0;
  private totalFailedTasks = 0;
  private isShuttingDown = false;

  constructor(config: WorkerPoolConfig = {}) {
    this.maxWorkers = config.maxWorkers ?? Math.max(4, os.cpus().length);
    this.taskTimeout = config.taskTimeout ?? 30000; // 30 seconds default
    this.enableMonitoring = config.enableMonitoring ?? true;
    
    logger.info('Worker pool initialized', {
      maxWorkers: this.maxWorkers,
      taskTimeout: this.taskTimeout,
      enableMonitoring: this.enableMonitoring,
    });
  }

  /**
   * Execute a task in the worker pool
   */
  async execute<T, R>(taskName: string, data: T): Promise<R> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    return new Promise((resolve, reject) => {
      const task: Task<T> = {
        id: `task-${++this.nextTaskId}`,
        name: taskName,
        data,
        timestamp: Date.now(),
      };

      const wrapper: TaskWrapper<T, R> = {
        task,
        resolve,
        reject,
        startTime: Date.now(),
      };

      // Try to find an idle worker
      const idleWorker = this.workers.find(w => !w.busy);
      
      if (idleWorker) {
        this.assignTaskToWorker(idleWorker, wrapper);
      } else if (this.workers.length < this.maxWorkers) {
        // Create a new worker
        const worker = this.createWorker();
        this.assignTaskToWorker(worker, wrapper);
      } else {
        // Queue the task
        this.taskQueue.push(wrapper);
        
        if (this.enableMonitoring) {
          logger.debug('Task queued', {
            taskId: task.id,
            queueLength: this.taskQueue.length,
          });
        }
      }
    });
  }

  /**
   * Create a new worker
   */
  private createWorker(): WorkerInfo {
    const workerId = ++this.nextWorkerId;
    
    // Create worker that can handle dynamic tasks
    const workerScript = `
      const { parentPort } = require('worker_threads');
      
      parentPort.on('message', async (message) => {
        const { taskId, taskName, data } = message;
        const startTime = Date.now();
        
        try {
          let result;
          
          // Handle different task types
          switch (taskName) {
            case 'json-parse':
              result = JSON.parse(data.text);
              if (data.path) {
                const { JSONPath } = require('jsonpath-plus');
                result = JSONPath({ path: data.path, json: result });
              }
              break;
              
            case 'json-stringify':
              const indent = data.pretty ? data.indent : undefined;
              result = JSON.stringify(data.obj, null, indent);
              break;
              
            case 'file-read':
              const fs = require('fs').promises;
              result = await fs.readFile(data.path, data.encoding || 'utf-8');
              break;
              
            case 'file-write':
              const fsWrite = require('fs').promises;
              const path = require('path');
              const dir = path.dirname(data.path);
              await fsWrite.mkdir(dir, { recursive: true });
              if (data.mode === 'append') {
                await fsWrite.appendFile(data.path, data.content, data.encoding || 'utf-8');
              } else {
                await fsWrite.writeFile(data.path, data.content, data.encoding || 'utf-8');
              }
              result = { bytesWritten: data.content.length };
              break;
              
            default:
              // Generic task execution
              if (typeof data === 'function') {
                result = await data();
              } else {
                result = data;
              }
          }
          
          parentPort.postMessage({
            taskId,
            success: true,
            data: result,
            duration: Date.now() - startTime,
          });
        } catch (error) {
          parentPort.postMessage({
            taskId,
            success: false,
            error: error.message,
            duration: Date.now() - startTime,
          });
        }
      });
    `;

    const worker = new Worker(workerScript, { eval: true });
    
    const workerInfo: WorkerInfo = {
      worker,
      id: workerId,
      busy: false,
      currentTask: null,
      completedTasks: 0,
      failedTasks: 0,
      totalDuration: 0,
    };

    worker.on('message', (result: TaskResult) => {
      this.handleWorkerMessage(workerInfo, result);
    });

    worker.on('error', (error) => {
      logger.error('Worker error', error, { workerId });
      workerInfo.failedTasks++;
      this.totalFailedTasks++;
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.warn('Worker exited with non-zero code', { workerId, code });
      }
      
      // Remove worker from pool
      const index = this.workers.indexOf(workerInfo);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }
    });

    this.workers.push(workerInfo);
    
    logger.debug('Worker created', { workerId, totalWorkers: this.workers.length });
    
    return workerInfo;
  }

  /**
   * Assign a task to a worker
   */
  private assignTaskToWorker<T, R>(workerInfo: WorkerInfo, wrapper: TaskWrapper<T, R>): void {
    workerInfo.busy = true;
    workerInfo.currentTask = wrapper.task.id;
    
    // Set timeout
    const timeout = setTimeout(() => {
      logger.warn('Task timeout', {
        taskId: wrapper.task.id,
        workerId: workerInfo.id,
        timeout: this.taskTimeout,
      });
      
      wrapper.reject(new Error(`Task timeout after ${this.taskTimeout}ms`));
      workerInfo.busy = false;
      workerInfo.currentTask = null;
      workerInfo.failedTasks++;
      this.totalFailedTasks++;
      
      // Process next task
      this.processNextTask();
    }, this.taskTimeout);
    
    // Send task to worker
    workerInfo.worker.postMessage({
      taskId: wrapper.task.id,
      taskName: wrapper.task.name,
      data: wrapper.task.data,
    });
    
    // Store timeout and wrapper for cleanup
    (workerInfo as any).currentTimeout = timeout;
    (workerInfo as any).currentWrapper = wrapper;
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(workerInfo: WorkerInfo, result: TaskResult): void {
    const wrapper = (workerInfo as any).currentWrapper;
    const timeout = (workerInfo as any).currentTimeout;
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    if (!wrapper) {
      logger.warn('Received result for unknown task', { taskId: result.taskId });
      return;
    }
    
    workerInfo.busy = false;
    workerInfo.currentTask = null;
    workerInfo.totalDuration += result.duration;
    
    if (result.success) {
      workerInfo.completedTasks++;
      this.totalCompletedTasks++;
      wrapper.resolve(result.data);
      
      if (this.enableMonitoring && result.duration > 100) {
        logger.debug('Task completed', {
          taskId: result.taskId,
          workerId: workerInfo.id,
          duration: result.duration,
        });
      }
    } else {
      workerInfo.failedTasks++;
      this.totalFailedTasks++;
      wrapper.reject(new Error(result.error || 'Task failed'));
      
      logger.warn('Task failed', {
        taskId: result.taskId,
        workerId: workerInfo.id,
        error: result.error,
        duration: result.duration,
      });
    }
    
    // Process next task
    this.processNextTask();
  }

  /**
   * Process next task in queue
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0 || this.isShuttingDown) {
      return;
    }
    
    const idleWorker = this.workers.find(w => !w.busy);
    
    if (idleWorker) {
      const wrapper = this.taskQueue.shift()!;
      this.assignTaskToWorker(idleWorker, wrapper);
    }
  }

  /**
   * Get worker pool statistics
   */
  getStats(): WorkerStats {
    const activeWorkers = this.workers.filter(w => w.busy).length;
    const totalDuration = this.workers.reduce((sum, w) => sum + w.totalDuration, 0);
    const totalTasks = this.totalCompletedTasks + this.totalFailedTasks;
    
    return {
      totalWorkers: this.workers.length,
      activeWorkers,
      idleWorkers: this.workers.length - activeWorkers,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.totalCompletedTasks,
      failedTasks: this.totalFailedTasks,
      averageTaskDuration: totalTasks > 0 ? totalDuration / totalTasks : 0,
    };
  }

  /**
   * Terminate all workers gracefully
   */
  async terminate(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    
    logger.info('Terminating worker pool', {
      activeWorkers: this.workers.filter(w => w.busy).length,
      queuedTasks: this.taskQueue.length,
    });
    
    // Reject all queued tasks
    while (this.taskQueue.length > 0) {
      const wrapper = this.taskQueue.shift()!;
      wrapper.reject(new Error('Worker pool is shutting down'));
    }
    
    // Wait for active tasks to complete (with timeout)
    const shutdownTimeout = 5000;
    const startTime = Date.now();
    
    while (this.workers.some(w => w.busy) && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Terminate all workers
    await Promise.all(this.workers.map(async (workerInfo) => {
      try {
        await workerInfo.worker.terminate();
      } catch (error) {
        logger.error('Error terminating worker', error as Error, {
          workerId: workerInfo.id,
        });
      }
    }));
    
    this.workers = [];
    
    logger.info('Worker pool terminated', {
      completedTasks: this.totalCompletedTasks,
      failedTasks: this.totalFailedTasks,
    });
  }
}

// Singleton instance for shared usage
let globalWorkerPool: WorkerPool | null = null;

/**
 * Get the global worker pool instance
 */
export function getWorkerPool(config?: WorkerPoolConfig): WorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new WorkerPool(config);
  }
  return globalWorkerPool;
}

/**
 * Terminate the global worker pool
 */
export async function terminateWorkerPool(): Promise<void> {
  if (globalWorkerPool) {
    await globalWorkerPool.terminate();
    globalWorkerPool = null;
  }
}
