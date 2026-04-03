/**
 * 性能优化工具
 * Performance Optimization Utilities
 */

import type { PerformanceMetric } from './helpers';

/**
 * CPU 分析器
 */
export class CPUProfiler {
  private samples: Array<{
    timestamp: number;
    cpuUsage: NodeJS.CpuUsage;
  }> = [];

  /**
   * 开始 CPU 分析
   */
  start(): void {
    this.samples = [];
    this.recordSample();
  }

  /**
   * 记录样本
   */
  private recordSample(): void {
    this.samples.push({
      timestamp: Date.now(),
      cpuUsage: process.cpuUsage(),
    });
  }

  /**
   * 停止分析并获取结果
   */
  stop(): {
    totalUserTime: number;
    totalSystemTime: number;
    samples: number;
    avgUserTime: number;
    avgSystemTime: number;
  } {
    this.recordSample();

    const userTimes = this.samples.map(s => s.cpuUsage.user);
    const systemTimes = this.samples.map(s => s.cpuUsage.system);

    const totalUserTime = userTimes.reduce((a, b) => a + b, 0);
    const totalSystemTime = systemTimes.reduce((a, b) => a + b, 0);

    return {
      totalUserTime,
      totalSystemTime,
      samples: this.samples.length,
      avgUserTime: totalUserTime / this.samples.length,
      avgSystemTime: totalSystemTime / this.samples.length,
    };
  }
}

/**
 * 查询分析器
 */
export class QueryProfiler {
  private queries: Array<{
    query: string;
    duration: number;
    timestamp: number;
  }> = [];

  /**
   * 记录查询
   */
  recordQuery(query: string, duration: number): void {
    this.queries.push({
      query,
      duration,
      timestamp: Date.now(),
    });
  }

  /**
   * 测量查询
   */
  async measureQuery<T>(query: string, fn: () => T | Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    this.recordQuery(query, end - start);
    return result;
  }

  /**
   * 获取慢查询
   */
  getSlowQueries(thresholdMs: number = 100): Array<{
    query: string;
    duration: number;
    timestamp: number;
  }> {
    return this.queries.filter(q => q.duration > thresholdMs);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalQueries: number;
    totalDuration: number;
    avgDuration: number;
    maxDuration: number;
    slowQueryCount: number;
  } {
    const durations = this.queries.map(q => q.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    return {
      totalQueries: this.queries.length,
      totalDuration,
      avgDuration: this.queries.length > 0 ? totalDuration / this.queries.length : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      slowQueryCount: this.getSlowQueries().length,
    };
  }

  /**
   * 清空记录
   */
  clear(): void {
    this.queries = [];
  }
}

/**
 * 缓存性能监控
 */
export class CacheMonitor {
  private hits: number = 0;
  private misses: number = 0;
  private sets: number = 0;
  private deletes: number = 0;

  /**
   * 记录缓存命中
   */
  recordHit(): void {
    this.hits++;
  }

  /**
   * 记录缓存未命中
   */
  recordMiss(): void {
    this.misses++;
  }

  /**
   * 记录缓存设置
   */
  recordSet(): void {
    this.sets++;
  }

  /**
   * 记录缓存删除
   */
  recordDelete(): void {
    this.deletes++;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    hitRate: number;
    missRate: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      hitRate,
      missRate: 100 - hitRate,
    };
  }

  /**
   * 重置计数
   */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.deletes = 0;
  }
}

/**
 * 对象池
 * 用于减少 GC 压力
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(factory: () => T, reset: (obj: T) => void, maxSize: number = 100) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  /**
   * 获取对象
   */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /**
   * 释放对象
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  /**
   * 获取池大小
   */
  size(): number {
    return this.pool.length;
  }

  /**
   * 清空池
   */
  clear(): void {
    this.pool = [];
  }
}

/**
 * 节流器
 * 限制函数执行频率
 */
export class ThrottleManager {
  private lastExecution: Map<string, number> = new Map();

  /**
   * 节流执行
   */
  throttle<T>(key: string, fn: () => T, intervalMs: number): T | null {
    const last = this.lastExecution.get(key) || 0;
    const now = Date.now();

    if (now - last >= intervalMs) {
      this.lastExecution.set(key, now);
      return fn();
    }

    return null;
  }

  /**
   * 清除节流记录
   */
  clear(key?: string): void {
    if (key) {
      this.lastExecution.delete(key);
    } else {
      this.lastExecution.clear();
    }
  }
}

/**
 * 防抖器
 * 延迟执行函数
 */
export class DebounceManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 防抖执行
   */
  debounce(key: string, fn: () => void, delayMs: number): void {
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      fn();
      this.timers.delete(key);
    }, delayMs);

    this.timers.set(key, timer);
  }

  /**
   * 取消防抖
   */
  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * 清除所有
   */
  clearAll(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

/**
 * 批处理器
 * 合并多个操作为批量操作
 */
export class BatchProcessor<T, R> {
  private queue: Array<{
    item: T;
    resolve: (result: R) => void;
    reject: (error: Error) => void;
  }> = [];
  private processor: (items: T[]) => Promise<R[]>;
  private batchSize: number;
  private delayMs: number;
  private timer?: NodeJS.Timeout;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    batchSize: number = 10,
    delayMs: number = 100
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.delayMs = delayMs;
  }

  /**
   * 添加项目
   */
  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });

      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.delayMs);
      }
    });
  }

  /**
   * 立即处理队列
   */
  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    const batch = this.queue.splice(0, this.batchSize);
    if (batch.length === 0) return;

    try {
      const items = batch.map(b => b.item);
      const results = await this.processor(items);

      batch.forEach((b, i) => {
        b.resolve(results[i]);
      });
    } catch (error: any) {
      batch.forEach(b => b.reject(error));
    }
  }

  /**
   * 等待所有完成
   */
  async drain(): Promise<void> {
    while (this.queue.length > 0) {
      await this.flush();
    }
  }
}

/**
 * 性能监控装饰器
 */
export function measurePerformance(
  metricName?: string,
  logger?: (metric: PerformanceMetric) => void
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = metricName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      try {
        const result = await originalMethod.apply(this, args);
        const end = performance.now();
        const duration = end - start;

        const metric: PerformanceMetric = {
          name,
          value: duration,
          unit: 'ms',
        };

        if (logger) {
          logger(metric);
        } else {
          console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
        }

        return result;
      } catch (error) {
        const end = performance.now();
        const duration = end - start;

        console.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms:`, error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 懒加载器
 */
export class LazyLoader<T> {
  private value?: T;
  private loader: () => Promise<T>;
  private loading: boolean = false;
  private loadPromise?: Promise<T>;

  constructor(loader: () => Promise<T>) {
    this.loader = loader;
  }

  /**
   * 获取值（懒加载）
   */
  async get(): Promise<T> {
    if (this.value !== undefined) {
      return this.value;
    }

    if (this.loading && this.loadPromise) {
      return this.loadPromise;
    }

    this.loading = true;
    this.loadPromise = this.loader().then(value => {
      this.value = value;
      this.loading = false;
      return value;
    });

    return this.loadPromise;
  }

  /**
   * 重置（清除缓存）
   */
  reset(): void {
    this.value = undefined;
    this.loading = false;
    this.loadPromise = undefined;
  }
}

/**
 * 资源限制器
 */
export class ResourceLimiter {
  private currentUsage: number = 0;

  constructor(private maxConcurrent: number = 10) {}

  /**
   * 执行受限操作
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    while (this.currentUsage >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.currentUsage++;
    try {
      return await fn();
    } finally {
      this.currentUsage--;
    }
  }

  /**
   * 获取当前使用量
   */
  getCurrentUsage(): number {
    return this.currentUsage;
  }

  /**
   * 获取可用资源数
   */
  getAvailable(): number {
    return this.maxConcurrent - this.currentUsage;
  }
}
