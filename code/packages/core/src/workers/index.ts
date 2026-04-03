/**
 * Workers module - High-performance task execution
 */

export {
  WorkerPool,
  getWorkerPool,
  terminateWorkerPool,
  type Task,
  type TaskResult,
  type WorkerStats,
  type WorkerPoolConfig,
} from './worker-pool';
