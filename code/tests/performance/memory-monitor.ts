/**
 * 内存监控工具
 * Memory monitoring utilities
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers?: number;
  label?: string;
}

export interface MemoryLeak {
  type: 'growth' | 'spike' | 'fragmentation';
  severity: 'low' | 'medium' | 'high';
  description: string;
  details: {
    startValue?: number;
    endValue?: number;
    growth?: number;
    duration?: number;
  };
}

/**
 * 内存监控器
 * 持续监控内存使用情况并检测泄漏
 */
export class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private interval?: NodeJS.Timeout;
  private baseline: MemorySnapshot | null = null;

  /**
   * 开始监控
   */
  start(sampleIntervalMs: number = 1000, label?: string): void {
    this.snapshots = [];
    this.baseline = this.takeSnapshot('baseline');

    this.interval = setInterval(() => {
      this.takeSnapshot(label);
    }, sampleIntervalMs);
  }

  /**
   * 停止监控
   */
  stop(): MemorySnapshot[] {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    return this.snapshots;
  }

  /**
   * 获取内存快照
   */
  takeSnapshot(label?: string): MemorySnapshot {
    const usage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed / 1024 / 1024, // MB
      heapTotal: usage.heapTotal / 1024 / 1024,
      external: usage.external / 1024 / 1024,
      rss: usage.rss / 1024 / 1024,
      arrayBuffers: usage.arrayBuffers ? usage.arrayBuffers / 1024 / 1024 : undefined,
      label,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * 分析内存使用
   */
  analyze(): {
    peak: MemorySnapshot;
    average: { heapUsed: number; heapTotal: number; rss: number };
    growth: number;
    leaks: MemoryLeak[];
  } {
    if (this.snapshots.length === 0) {
      return {
        peak: this.takeSnapshot(),
        average: { heapUsed: 0, heapTotal: 0, rss: 0 },
        growth: 0,
        leaks: [],
      };
    }

    // 找到峰值
    const peak = this.snapshots.reduce((max, snap) =>
      snap.heapUsed > max.heapUsed ? snap : max
    );

    // 计算平均值
    const avgHeapUsed = this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / this.snapshots.length;
    const avgHeapTotal = this.snapshots.reduce((sum, s) => sum + s.heapTotal, 0) / this.snapshots.length;
    const avgRss = this.snapshots.reduce((sum, s) => sum + s.rss, 0) / this.snapshots.length;

    // 计算增长
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const growth = last.heapUsed - first.heapUsed;

    // 检测泄漏
    const leaks = this.detectLeaks();

    return {
      peak,
      average: {
        heapUsed: avgHeapUsed,
        heapTotal: avgHeapTotal,
        rss: avgRss,
      },
      growth,
      leaks,
    };
  }

  /**
   * 检测内存泄漏
   */
  private detectLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    if (this.snapshots.length < 2) {
      return leaks;
    }

    // 1. 持续增长检测
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const growth = last.heapUsed - first.heapUsed;
    const growthPercent = (growth / first.heapUsed) * 100;

    if (growth > 10 && growthPercent > 20) {
      // 增长超过 10MB 且超过 20%
      leaks.push({
        type: 'growth',
        severity: growth > 50 ? 'high' : growth > 20 ? 'medium' : 'low',
        description: `堆内存持续增长 ${growth.toFixed(2)} MB (${growthPercent.toFixed(2)}%)`,
        details: {
          startValue: first.heapUsed,
          endValue: last.heapUsed,
          growth,
          duration: last.timestamp - first.timestamp,
        },
      });
    }

    // 2. 突增检测
    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1];
      const curr = this.snapshots[i];
      const spike = curr.heapUsed - prev.heapUsed;

      if (spike > 20) {
        // 突增超过 20MB
        leaks.push({
          type: 'spike',
          severity: spike > 50 ? 'high' : 'medium',
          description: `内存突增 ${spike.toFixed(2)} MB`,
          details: {
            startValue: prev.heapUsed,
            endValue: curr.heapUsed,
            growth: spike,
          },
        });
      }
    }

    return leaks;
  }

  /**
   * 导出报告
   */
  exportReport(outputPath: string): void {
    const analysis = this.analyze();

    const report = {
      summary: {
        totalSnapshots: this.snapshots.length,
        duration: this.snapshots.length > 1
          ? this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp
          : 0,
        peakMemory: analysis.peak.heapUsed,
        avgMemory: analysis.average.heapUsed,
        memoryGrowth: analysis.growth,
        leakCount: analysis.leaks.length,
      },
      analysis,
      snapshots: this.snapshots,
    };

    writeFileSync(outputPath, JSON.stringify(report, null, 2));
  }
}

/**
 * 堆快照分析（简化版）
 * 完整的堆分析需要使用 v8 模块或 heapdump
 */
export class HeapAnalyzer {
  private objects: Map<string, { count: number; size: number }> = new Map();

  /**
   * 记录对象分配（手动调用）
   */
  trackObject(obj: any, label?: string): void {
    const type = label || obj?.constructor?.name || typeof obj;
    const entry = this.objects.get(type) || { count: 0, size: 0 };
    entry.count++;
    entry.size += this.estimateSize(obj);
    this.objects.set(type, entry);
  }

  /**
   * 估算对象大小
   */
  private estimateSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;

    const type = typeof obj;

    switch (type) {
      case 'number':
        return 8;
      case 'string':
        return obj.length * 2;
      case 'boolean':
        return 4;
      case 'object':
        if (Array.isArray(obj)) {
          return obj.reduce((sum, item) => sum + this.estimateSize(item), 0);
        }
        return Object.keys(obj).reduce((sum, key) => {
          return sum + key.length * 2 + this.estimateSize(obj[key]);
        }, 0);
      default:
        return 0;
    }
  }

  /**
   * 获取对象统计
   */
  getStats(): Array<{ type: string; count: number; size: number }> {
    return Array.from(this.objects.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.size - a.size);
  }

  /**
   * 清空追踪
   */
  clear(): void {
    this.objects.clear();
  }
}

/**
 * GC 监控
 */
export class GCMonitor {
  private samples: Array<{
    type: 'scavenge' | 'mark-sweep' | 'mark-sweep-compact' | 'unknown';
    duration: number;
    timestamp: number;
  }> = [];

  /**
   * 开始监控（需要 --trace-gc 标志）
   */
  start(): void {
    // 注意：Node.js 原生 GC 监控需要 v8 模块
    // 这里提供一个简化的接口
    console.log('GC monitoring started. Note: For accurate GC metrics, use --trace-gc flag.');
  }

  /**
   * 手动记录 GC 事件
   */
  recordGC(type: string, duration: number): void {
    this.samples.push({
      type: type as any,
      duration,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取 GC 统计
   */
  getStats(): {
    totalCollections: number;
    totalDuration: number;
    avgDuration: number;
    maxDuration: number;
    byType: Record<string, { count: number; totalDuration: number }>;
  } {
    const byType: Record<string, { count: number; totalDuration: number }> = {};

    for (const sample of this.samples) {
      const type = sample.type;
      if (!byType[type]) {
        byType[type] = { count: 0, totalDuration: 0 };
      }
      byType[type].count++;
      byType[type].totalDuration += sample.duration;
    }

    const durations = this.samples.map(s => s.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    return {
      totalCollections: this.samples.length,
      totalDuration,
      avgDuration: this.samples.length > 0 ? totalDuration / this.samples.length : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      byType,
    };
  }

  /**
   * 清空记录
   */
  clear(): void {
    this.samples = [];
  }
}

/**
 * 内存压力测试
 */
export class MemoryPressureTest {
  /**
   * 分配指定大小的内存
   */
  allocateMemory(sizeInMB: number): Buffer {
    return Buffer.alloc(sizeInMB * 1024 * 1024);
  }

  /**
   * 测试内存限制
   */
  async testLimit(maxMemoryMB: number): Promise<{
    reachedLimit: boolean;
    maxAllocated: number;
    error?: string;
  }> {
    const buffers: Buffer[] = [];
    let totalAllocated = 0;
    const chunkSize = 1; // 1MB chunks

    try {
      while (totalAllocated < maxMemoryMB) {
        const buffer = this.allocateMemory(chunkSize);
        buffers.push(buffer);
        totalAllocated += chunkSize;
        await new Promise(resolve => setImmediate(resolve));
      }

      return {
        reachedLimit: false,
        maxAllocated: totalAllocated,
      };
    } catch (error: any) {
      return {
        reachedLimit: true,
        maxAllocated: totalAllocated,
        error: error.message,
      };
    } finally {
      // 释放内存
      buffers.length = 0;
      if (global.gc) {
        global.gc();
      }
    }
  }
}
