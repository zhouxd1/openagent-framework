/**
 * 性能测试辅助函数
 * Performance testing utility functions
 */

/**
 * 性能指标数据结构
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'MB' | 'count' | 'percentage';
  p50?: number;
  p95?: number;
  p99?: number;
  min?: number;
  max?: number;
  avg?: number;
  samples?: number[];
}

/**
 * 计算百分位数
 * @param arr 排序后的数组
 * @param p 百分位数 (0-1)
 */
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 计算统计指标
 */
export function calculateStats(samples: number[]): Omit<PerformanceMetric, 'name' | 'unit'> {
  if (samples.length === 0) {
    return {
      value: 0,
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      samples: [],
    };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const avg = sum / samples.length;

  return {
    value: avg,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    samples,
  };
}

/**
 * 高精度计时器
 */
export class Timer {
  private startTime: number;
  private endTime?: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * 标记时间点
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * 获取标记时间
   */
  getMark(name: string): number | undefined {
    return this.marks.get(name);
  }

  /**
   * 停止计时
   */
  stop(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  /**
   * 获取已用时间
   */
  elapsed(): number {
    const end = this.endTime || performance.now();
    return end - this.startTime;
  }

  /**
   * 重置计时器
   */
  reset(): void {
    this.startTime = performance.now();
    this.endTime = undefined;
    this.marks.clear();
  }
}

/**
 * 测量函数执行时间
 * @param fn 要测量的函数
 * @param iterations 迭代次数
 */
export async function measure<T>(
  fn: () => T | Promise<T>,
  iterations: number = 100
): Promise<{ result: T; duration: number; samples: number[] }> {
  const samples: number[] = [];
  let result: T;

  // 预热
  await fn();

  // 正式测量
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = await fn();
    const end = performance.now();
    samples.push(end - start);
  }

  return {
    result: result!,
    duration: samples.reduce((a, b) => a + b, 0),
    samples,
  };
}

/**
 * 批量测量
 */
export async function measureBatch<T>(
  fn: () => T | Promise<T>,
  batchSize: number,
  parallelBatches: number
): Promise<{ samples: number[]; totalDuration: number }> {
  const samples: number[] = [];
  const start = performance.now();

  for (let batch = 0; batch < parallelBatches; batch++) {
    const batchStart = performance.now();
    const promises = Array.from({ length: batchSize }, () => fn());
    await Promise.all(promises);
    const batchEnd = performance.now();
    samples.push(batchEnd - batchStart);
  }

  const end = performance.now();

  return {
    samples,
    totalDuration: end - start,
  };
}

/**
 * 并发测试
 */
export async function measureConcurrency<T>(
  fn: () => T | Promise<T>,
  concurrency: number,
  totalOperations: number
): Promise<{ samples: number[]; throughput: number }> {
  const samples: number[] = [];
  const start = performance.now();
  let completed = 0;

  const executeOne = async () => {
    const opStart = performance.now();
    await fn();
    const opEnd = performance.now();
    samples.push(opEnd - opStart);
    completed++;
  };

  // 并发执行
  const workers: Promise<void>[] = [];
  let index = 0;

  while (index < totalOperations) {
    // 填充到并发数
    while (workers.length < concurrency && index < totalOperations) {
      workers.push(executeOne());
      index++;
    }

    // 等待任意一个完成
    if (workers.length >= concurrency) {
      await Promise.race(workers.map(p => p.then(() => p, () => p)));
      // 移除已完成的
      for (let i = workers.length - 1; i >= 0; i--) {
        const promise = workers[i];
        const result = await Promise.race([promise, Promise.resolve('pending')]);
        if (result !== 'pending') {
          workers.splice(i, 1);
        }
      }
    }
  }

  // 等待所有完成
  await Promise.all(workers);

  const end = performance.now();
  const throughput = (totalOperations / (end - start)) * 1000;

  return { samples, throughput };
}

/**
 * 内存快照
 */
export function getMemoryUsage(): {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
} {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed / 1024 / 1024, // MB
    heapTotal: usage.heapTotal / 1024 / 1024,
    external: usage.external / 1024 / 1024,
    rss: usage.rss / 1024 / 1024,
  };
}

/**
 * 强制垃圾回收（需要 --expose-gc 标志）
 */
export function forceGC(): void {
  if (global.gc) {
    global.gc();
  } else {
    console.warn('GC not exposed. Run with --expose-gc flag for accurate memory tests.');
  }
}

/**
 * 等待指定毫秒
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成测试数据
 */
export function generateTestData(size: number): any[] {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    name: `test-${i}`,
    timestamp: Date.now(),
    data: {
      value: Math.random(),
      tags: ['tag1', 'tag2', 'tag3'],
      nested: {
        field1: 'value1',
        field2: i * 2,
      },
    },
  }));
}

/**
 * 格式化输出
 */
export function formatMetric(metric: PerformanceMetric): string {
  const parts: string[] = [`${metric.name}: ${metric.value.toFixed(2)} ${metric.unit}`];

  if (metric.min !== undefined) {
    parts.push(`min=${metric.min.toFixed(2)}`);
  }
  if (metric.max !== undefined) {
    parts.push(`max=${metric.max.toFixed(2)}`);
  }
  if (metric.avg !== undefined) {
    parts.push(`avg=${metric.avg.toFixed(2)}`);
  }
  if (metric.p50 !== undefined) {
    parts.push(`p50=${metric.p50.toFixed(2)}`);
  }
  if (metric.p95 !== undefined) {
    parts.push(`p95=${metric.p95.toFixed(2)}`);
  }
  if (metric.p99 !== undefined) {
    parts.push(`p99=${metric.p99.toFixed(2)}`);
  }

  return parts.join(', ');
}

/**
 * 性能目标检查
 */
export interface PerformanceTarget {
  metric: string;
  target: number;
  actual: number;
  unit: string;
  passed: boolean;
}

export function checkPerformanceTarget(
  metricName: string,
  actual: number,
  target: number,
  unit: string,
  operator: '<' | '<=' | '>' | '>=' | '=' = '<='
): PerformanceTarget {
  let passed: boolean;
  switch (operator) {
    case '<':
      passed = actual < target;
      break;
    case '<=':
      passed = actual <= target;
      break;
    case '>':
      passed = actual > target;
      break;
    case '>=':
      passed = actual >= target;
      break;
    case '=':
      passed = actual === target;
      break;
    default:
      passed = actual <= target;
  }

  return {
    metric: metricName,
    target,
    actual,
    unit,
    passed,
  };
}

/**
 * 事件循环延迟监控
 */
export class EventLoopMonitor {
  private interval?: NodeJS.Timeout;
  private samples: number[] = [];
  private lastCheck: number = 0;

  start(sampleIntervalMs: number = 100): void {
    this.samples = [];
    this.lastCheck = performance.now();

    this.interval = setInterval(() => {
      const now = performance.now();
      const delay = now - this.lastCheck - sampleIntervalMs;
      this.samples.push(delay);
      this.lastCheck = now;
    }, sampleIntervalMs);
  }

  stop(): { avg: number; max: number; min: number; p95: number } {
    if (this.interval) {
      clearInterval(this.interval);
    }

    if (this.samples.length === 0) {
      return { avg: 0, max: 0, min: 0, p95: 0 };
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;

    return {
      avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: percentile(sorted, 0.95),
    };
  }
}
