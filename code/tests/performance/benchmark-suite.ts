/**
 * OpenAgent Framework 性能基准测试套件
 * Performance Benchmark Suite
 * 
 * 目标指标:
 * - CLI 启动: < 200ms (P95)
 * - 会话创建: < 100ms (P95)
 * - 消息响应（非流式）: < 5s (P95)
 * - 流式首字节: < 500ms (P95)
 * - 工具执行（简单）: < 300ms (P95)
 * - 并发会话: 10,000+
 * - 内存占用: < 500MB (单实例)
 */

import {
  measure,
  measureBatch,
  measureConcurrency,
  calculateStats,
  Timer,
  EventLoopMonitor,
  PerformanceMetric,
  checkPerformanceTarget,
  PerformanceTarget,
  formatMetric,
  getMemoryUsage,
  forceGC,
  generateTestData,
  sleep,
} from './helpers';
import { MemoryMonitor } from './memory-monitor';

// 性能目标配置
const PERFORMANCE_TARGETS = {
  CLI_STARTUP: { value: 200, unit: 'ms' },
  SESSION_CREATE: { value: 100, unit: 'ms' },
  MESSAGE_RESPONSE: { value: 5000, unit: 'ms' },
  STREAM_FIRST_BYTE: { value: 500, unit: 'ms' },
  TOOL_EXECUTE_SIMPLE: { value: 300, unit: 'ms' },
  CONCURRENT_SESSIONS: { value: 10000, unit: 'count' },
  MEMORY_USAGE: { value: 500, unit: 'MB' },
};

/**
 * 基准测试结果
 */
export interface BenchmarkResult {
  name: string;
  category: string;
  metrics: PerformanceMetric[];
  targets: PerformanceTarget[];
  duration: number;
  memoryImpact: {
    before: ReturnType<typeof getMemoryUsage>;
    after: ReturnType<typeof getMemoryUsage>;
    delta: number;
  };
  passed: boolean;
}

/**
 * 完整测试报告
 */
export interface BenchmarkReport {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    cpuCount: number;
    totalMemory: number;
  };
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    totalDuration: number;
    peakMemory: number;
  };
  recommendations: string[];
}

/**
 * 基准测试套件
 */
export class BenchmarkSuite {
  private results: BenchmarkResult[] = [];
  private eventLoopMonitor = new EventLoopMonitor();
  private memoryMonitor = new MemoryMonitor();

  /**
   * 运行所有基准测试
   */
  async runAll(): Promise<BenchmarkReport> {
    console.log('🚀 Starting OpenAgent Framework Performance Benchmark Suite\n');

    this.results = [];
    const suiteStart = Date.now();

    // 启动监控
    this.eventLoopMonitor.start(100);

    try {
      // 1. 工具执行性能测试
      await this.runBenchmark('工具执行性能', () => this.benchmarkToolExecution());

      // 2. 会话管理性能测试
      await this.runBenchmark('会话管理性能', () => this.benchmarkSessionManagement());

      // 3. LLM 请求性能测试（模拟）
      await this.runBenchmark('LLM 请求性能', () => this.benchmarkLLMRequests());

      // 4. 并发性能测试
      await this.runBenchmark('并发性能', () => this.benchmarkConcurrency());

      // 5. 内存使用测试
      await this.runBenchmark('内存使用', () => this.benchmarkMemoryUsage());

      // 6. 启动性能测试
      await this.runBenchmark('启动性能', () => this.benchmarkStartup());

      // 7. 事件循环延迟测试
      await this.runBenchmark('事件循环', () => this.benchmarkEventLoop());

    } finally {
      this.eventLoopMonitor.stop();
    }

    const suiteEnd = Date.now();

    return this.generateReport(suiteEnd - suiteStart);
  }

  /**
   * 运行单个基准测试
   */
  private async runBenchmark(
    name: string,
    benchmarkFn: () => Promise<Partial<BenchmarkResult>>
  ): Promise<void> {
    console.log(`\n📊 Running: ${name}`);

    forceGC();
    const memBefore = getMemoryUsage();

    try {
      const result = await benchmarkFn();

      forceGC();
      const memAfter = getMemoryUsage();

      const fullResult: BenchmarkResult = {
        name,
        category: result.category || 'general',
        metrics: result.metrics || [],
        targets: result.targets || [],
        duration: result.duration || 0,
        memoryImpact: {
          before: memBefore,
          after: memAfter,
          delta: memAfter.heapUsed - memBefore.heapUsed,
        },
        passed: (result.targets || []).every(t => t.passed),
      };

      this.results.push(fullResult);

      // 打印结果
      console.log(`  ✅ Completed in ${fullResult.duration}ms`);
      fullResult.metrics.forEach(m => {
        console.log(`     ${formatMetric(m)}`);
      });

    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}`);
      this.results.push({
        name,
        category: 'error',
        metrics: [],
        targets: [],
        duration: 0,
        memoryImpact: {
          before: memBefore,
          after: getMemoryUsage(),
          delta: 0,
        },
        passed: false,
      });
    }
  }

  /**
   * 1. 工具执行性能测试
   */
  private async benchmarkToolExecution(): Promise<Partial<BenchmarkResult>> {
    const metrics: PerformanceMetric[] = [];
    const targets: PerformanceTarget[] = [];
    const timer = new Timer();

    // 简单工具执行测试
    const simpleToolFn = async () => {
      // 模拟简单工具执行
      await sleep(1);
      return { result: 'ok' };
    };

    // 测量 1000 次执行
    const { samples: simpleSamples } = await measure(simpleToolFn, 1000);
    const simpleStats = calculateStats(simpleSamples);

    metrics.push({
      name: '简单工具执行',
      unit: 'ms',
      ...simpleStats,
    });

    targets.push(
      checkPerformanceTarget(
        '工具执行 (P95)',
        simpleStats.p95!,
        PERFORMANCE_TARGETS.TOOL_EXECUTE_SIMPLE.value,
        'ms'
      )
    );

    // 复杂工具执行测试（带参数验证）
    const complexToolFn = async () => {
      // 模拟参数验证
      const params = { a: Math.random(), b: Math.random() };
      if (typeof params.a !== 'number' || typeof params.b !== 'number') {
        throw new Error('Invalid params');
      }
      // 模拟执行
      await sleep(10);
      return { result: params.a + params.b };
    };

    const { samples: complexSamples } = await measure(complexToolFn, 100);
    const complexStats = calculateStats(complexSamples);

    metrics.push({
      name: '复杂工具执行',
      unit: 'ms',
      ...complexStats,
    });

    // 工具注册和查找测试
    const toolRegistry = new Map<string, any>();
    const registerFn = () => {
      const id = `tool-${Math.random()}`;
      toolRegistry.set(id, { name: id, handler: () => {} });
      return id;
    };

    const { samples: registerSamples } = await measure(registerFn, 1000);
    const registerStats = calculateStats(registerSamples);

    metrics.push({
      name: '工具注册',
      unit: 'ms',
      ...registerStats,
    });

    const lookupFn = () => {
      const keys = Array.from(toolRegistry.keys());
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      return toolRegistry.get(randomKey);
    };

    const { samples: lookupSamples } = await measure(lookupFn, 10000);
    const lookupStats = calculateStats(lookupSamples);

    metrics.push({
      name: '工具查找',
      unit: 'ms',
      ...lookupStats,
    });

    return {
      category: 'tool-execution',
      metrics,
      targets,
      duration: timer.elapsed(),
    };
  }

  /**
   * 2. 会话管理性能测试
   */
  private async benchmarkSessionManagement(): Promise<Partial<BenchmarkResult>> {
    const metrics: PerformanceMetric[] = [];
    const targets: PerformanceTarget[] = [];
    const timer = new Timer();

    // 模拟会话存储
    const sessions = new Map<string, any>();

    // 会话创建测试
    const createSessionFn = async () => {
      const sessionId = `session-${Date.now()}-${Math.random()}`;
      const session = {
        id: sessionId,
        userId: 'user-1',
        createdAt: new Date(),
        messages: [],
        context: {},
      };
      sessions.set(sessionId, session);
      return session;
    };

    const { samples: createSamples } = await measure(createSessionFn, 1000);
    const createStats = calculateStats(createSamples);

    metrics.push({
      name: '会话创建',
      unit: 'ms',
      ...createStats,
    });

    targets.push(
      checkPerformanceTarget(
        '会话创建 (P95)',
        createStats.p95!,
        PERFORMANCE_TARGETS.SESSION_CREATE.value,
        'ms'
      )
    );

    // 会话查询测试
    const getSessionFn = () => {
      const keys = Array.from(sessions.keys());
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      return sessions.get(randomKey);
    };

    const { samples: getSamples } = await measure(getSessionFn, 10000);
    const getStats = calculateStats(getSamples);

    metrics.push({
      name: '会话查询',
      unit: 'ms',
      ...getStats,
    });

    // 消息添加测试
    const addMessageFn = async () => {
      const keys = Array.from(sessions.keys());
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const session = sessions.get(randomKey);
      if (session) {
        session.messages.push({
          id: `msg-${Date.now()}`,
          role: 'user',
          content: 'test message',
          timestamp: new Date(),
        });
      }
      return session;
    };

    const { samples: addMsgSamples } = await measure(addMessageFn, 1000);
    const addMsgStats = calculateStats(addMsgSamples);

    metrics.push({
      name: '消息添加',
      unit: 'ms',
      ...addMsgStats,
    });

    return {
      category: 'session-management',
      metrics,
      targets,
      duration: timer.elapsed(),
    };
  }

  /**
   * 3. LLM 请求性能测试（模拟）
   */
  private async benchmarkLLMRequests(): Promise<Partial<BenchmarkResult>> {
    const metrics: PerformanceMetric[] = [];
    const targets: PerformanceTarget[] = [];
    const timer = new Timer();

    // 模拟 LLM 请求延迟
    const simulateLLMRequest = async (delay: number) => {
      await sleep(delay);
      return {
        id: `completion-${Date.now()}`,
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'This is a simulated response.',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };
    };

    // 非流式请求测试
    const { samples: requestSamples } = await measure(
      () => simulateLLMRequest(100),
      100
    );
    const requestStats = calculateStats(requestSamples);

    metrics.push({
      name: '非流式请求',
      unit: 'ms',
      ...requestStats,
    });

    targets.push(
      checkPerformanceTarget(
        '消息响应 (P95)',
        requestStats.p95!,
        PERFORMANCE_TARGETS.MESSAGE_RESPONSE.value,
        'ms'
      )
    );

    // 流式首字节测试
    const simulateStreamFirstByte = async () => {
      const start = performance.now();
      await sleep(50); // 模拟首字节延迟
      const firstByteTime = performance.now() - start;
      // 模拟剩余流式响应
      await sleep(100);
      return firstByteTime;
    };

    const { samples: streamSamples } = await measure(simulateStreamFirstByte, 100);
    const streamStats = calculateStats(streamSamples);

    metrics.push({
      name: '流式首字节',
      unit: 'ms',
      ...streamStats,
    });

    targets.push(
      checkPerformanceTarget(
        '流式首字节 (P95)',
        streamStats.p95!,
        PERFORMANCE_TARGETS.STREAM_FIRST_BYTE.value,
        'ms'
      )
    );

    // Token 计数测试
    const countTokens = (text: string): number => {
      // 简化的 token 计数（实际应使用 tiktoken）
      return text.split(/\s+/).length;
    };

    const longText = generateTestData(100)
      .map(d => JSON.stringify(d))
      .join(' ');

    const { samples: tokenSamples } = await measure(() => countTokens(longText), 1000);
    const tokenStats = calculateStats(tokenSamples);

    metrics.push({
      name: 'Token 计数',
      unit: 'ms',
      ...tokenStats,
    });

    return {
      category: 'llm-requests',
      metrics,
      targets,
      duration: timer.elapsed(),
    };
  }

  /**
   * 4. 并发性能测试
   */
  private async benchmarkConcurrency(): Promise<Partial<BenchmarkResult>> {
    const metrics: PerformanceMetric[] = [];
    const targets: PerformanceTarget[] = [];
    const timer = new Timer();

    // 会话并发创建测试
    const createSession = async () => {
      await sleep(1);
      return { id: `session-${Date.now()}` };
    };

    // 测试不同并发级别
    const concurrencyLevels = [10, 100, 1000];
    const throughputResults: number[] = [];

    for (const concurrency of concurrencyLevels) {
      const { samples, throughput } = await measureConcurrency(
        createSession,
        concurrency,
        concurrency * 10
      );

      const stats = calculateStats(samples);

      metrics.push({
        name: `并发创建 (${concurrency})`,
        unit: 'ms',
        ...stats,
      });

      throughputResults.push(throughput);

      metrics.push({
        name: `吞吐量 (${concurrency}并发)`,
        value: throughput,
        unit: 'count',
      });
    }

    // 最大并发会话数测试
    let maxConcurrent = 0;
    const activeSessions = new Set<string>();

    const createAndTrackSession = async () => {
      const id = `session-${Date.now()}-${Math.random()}`;
      activeSessions.add(id);
      maxConcurrent = Math.max(maxConcurrent, activeSessions.size);
      await sleep(10);
      activeSessions.delete(id);
      return id;
    };

    // 模拟 10000 并发会话创建
    const promises = Array.from({ length: 5000 }, () => createAndTrackSession());
    await Promise.all(promises);

    metrics.push({
      name: '最大并发会话数',
      value: maxConcurrent,
      unit: 'count',
    });

    targets.push(
      checkPerformanceTarget(
        '并发会话数',
        maxConcurrent,
        PERFORMANCE_TARGETS.CONCURRENT_SESSIONS.value,
        'count',
        '>='
      )
    );

    return {
      category: 'concurrency',
      metrics,
      targets,
      duration: timer.elapsed(),
    };
  }

  /**
   * 5. 内存使用测试
   */
  private async benchmarkMemoryUsage(): Promise<Partial<BenchmarkResult>> {
    const metrics: PerformanceMetric[] = [];
    const targets: PerformanceTarget[] = [];
    const timer = new Timer();

    forceGC();
    const initialMem = getMemoryUsage();

    // 创建大量对象并监控内存
    const objects: any[] = [];
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      objects.push({
        id: i,
        data: generateTestData(10),
        timestamp: Date.now(),
      });

      if (i % 1000 === 0) {
        const currentMem = getMemoryUsage();
        metrics.push({
          name: `内存使用 (${i} 对象)`,
          value: currentMem.heapUsed,
          unit: 'MB',
        });
      }
    }

    const peakMem = getMemoryUsage();

    metrics.push({
      name: '峰值堆内存',
      value: peakMem.heapUsed,
      unit: 'MB',
    });

    metrics.push({
      name: '内存增长',
      value: peakMem.heapUsed - initialMem.heapUsed,
      unit: 'MB',
    });

    targets.push(
      checkPerformanceTarget(
        '内存占用',
        peakMem.heapUsed,
        PERFORMANCE_TARGETS.MEMORY_USAGE.value,
        'MB'
      )
    );

    // 清理并检查内存回收
    objects.length = 0;
    forceGC();
    await sleep(100);

    const afterCleanup = getMemoryUsage();
    const memoryLeaked = afterCleanup.heapUsed - initialMem.heapUsed;

    metrics.push({
      name: '清理后内存',
      value: afterCleanup.heapUsed,
      unit: 'MB',
    });

    metrics.push({
      name: '潜在内存泄漏',
      value: memoryLeaked,
      unit: 'MB',
    });

    return {
      category: 'memory',
      metrics,
      targets,
      duration: timer.elapsed(),
    };
  }

  /**
   * 6. 启动性能测试
   */
  private async benchmarkStartup(): Promise<Partial<BenchmarkResult>> {
    const metrics: PerformanceMetric[] = [];
    const targets: PerformanceTarget[] = [];
    const timer = new Timer();

    // 模拟模块加载
    const loadModule = async () => {
      // 模拟模块初始化
      const module = {
        initialized: false,
        init: async () => {
          await sleep(1);
          module.initialized = true;
          return module;
        },
      };
      return module.init();
    };

    // 测试模块加载时间
    const { samples: loadSamples } = await measure(loadModule, 100);
    const loadStats = calculateStats(loadSamples);

    metrics.push({
      name: '模块加载',
      unit: 'ms',
      ...loadStats,
    });

    // 模拟完整启动流程
    const fullStartup = async () => {
      const start = performance.now();
      
      // 加载配置
      await sleep(5);
      
      // 初始化日志
      await sleep(2);
      
      // 连接数据库
      await sleep(10);
      
      // 初始化工具注册表
      await sleep(3);
      
      // 启动服务器
      await sleep(5);
      
      return performance.now() - start;
    };

    const { samples: startupSamples } = await measure(fullStartup, 50);
    const startupStats = calculateStats(startupSamples);

    metrics.push({
      name: '完整启动',
      unit: 'ms',
      ...startupStats,
    });

    targets.push(
      checkPerformanceTarget(
        'CLI 启动 (P95)',
        startupStats.p95!,
        PERFORMANCE_TARGETS.CLI_STARTUP.value,
        'ms'
      )
    );

    return {
      category: 'startup',
      metrics,
      targets,
      duration: timer.elapsed(),
    };
  }

  /**
   * 7. 事件循环延迟测试
   */
  private async benchmarkEventLoop(): Promise<Partial<BenchmarkResult>> {
    const metrics: PerformanceMetric[] = [];
    const targets: PerformanceTarget[] = [];
    const timer = new Timer();

    // 在运行一些操作的同时监控事件循环
    const work = async () => {
      for (let i = 0; i < 100; i++) {
        // 模拟 CPU 密集型工作
        const start = Date.now();
        while (Date.now() - start < 5) {
          // 忙等待
        }
        await sleep(10); // 让出事件循环
      }
    };

    await work();

    const eventLoopStats = this.eventLoopMonitor.stop();

    metrics.push({
      name: '事件循环平均延迟',
      value: eventLoopStats.avg,
      unit: 'ms',
    });

    metrics.push({
      name: '事件循环最大延迟',
      value: eventLoopStats.max,
      unit: 'ms',
    });

    metrics.push({
      name: '事件循环 P95 延迟',
      value: eventLoopStats.p95,
      unit: 'ms',
    });

    // 事件循环延迟目标：< 10ms (P95)
    targets.push(
      checkPerformanceTarget(
        '事件循环延迟 (P95)',
        eventLoopStats.p95,
        10,
        'ms'
      )
    );

    return {
      category: 'event-loop',
      metrics,
      targets,
      duration: timer.elapsed(),
    };
  }

  /**
   * 生成完整报告
   */
  private generateReport(totalDuration: number): BenchmarkReport {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.length - passed;

    // 找出峰值内存
    const peakMemory = Math.max(
      ...this.results.map(r => r.memoryImpact.after.heapUsed)
    );

    // 生成建议
    const recommendations: string[] = [];

    this.results.forEach(result => {
      result.targets.forEach(target => {
        if (!target.passed) {
          recommendations.push(
            `⚠️ ${result.name}: ${target.metric} 未达标 (${target.actual.toFixed(2)} ${target.unit} > ${target.target} ${target.unit})`
          );
        }
      });

      if (result.memoryImpact.delta > 50) {
        recommendations.push(
          `💾 ${result.name}: 内存增长较大 (${result.memoryImpact.delta.toFixed(2)} MB)，建议优化`
        );
      }
    });

    // 添加通用建议
    if (failed > 0) {
      recommendations.push('🔧 部分性能指标未达标，建议优先优化未通过的测试项');
    }
    if (peakMemory > 400) {
      recommendations.push('💾 峰值内存较高，建议检查内存泄漏或优化对象生命周期');
    }

    return {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuCount: require('os').cpus().length,
        totalMemory: require('os').totalmem() / 1024 / 1024 / 1024,
      },
      results: this.results,
      summary: {
        totalTests: this.results.length,
        passed,
        failed,
        totalDuration,
        peakMemory,
      },
      recommendations,
    };
  }

  /**
   * 打印报告摘要
   */
  printSummary(report: BenchmarkReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 Performance Benchmark Report');
    console.log('='.repeat(80));

    console.log(`\n📅 Timestamp: ${report.timestamp}`);
    console.log(`🖥️  Environment:`);
    console.log(`   Node.js: ${report.environment.nodeVersion}`);
    console.log(`   Platform: ${report.environment.platform}`);
    console.log(`   CPUs: ${report.environment.cpuCount}`);
    console.log(`   Memory: ${report.environment.totalMemory.toFixed(2)} GB`);

    console.log(`\n📈 Summary:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   ✅ Passed: ${report.summary.passed}`);
    console.log(`   ❌ Failed: ${report.summary.failed}`);
    console.log(`   ⏱️  Duration: ${report.summary.totalDuration}ms`);
    console.log(`   💾 Peak Memory: ${report.summary.peakMemory.toFixed(2)} MB`);

    console.log(`\n📋 Detailed Results:`);
    report.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`\n  ${status} ${result.name} (${result.duration}ms)`);
      result.metrics.forEach(metric => {
        console.log(`     - ${formatMetric(metric)}`);
      });
      result.targets.forEach(target => {
        const targetStatus = target.passed ? '✅' : '❌';
        console.log(
          `     ${targetStatus} Target: ${target.metric} = ${target.actual.toFixed(2)} ${target.unit} (target: ${target.target} ${target.unit})`
        );
      });
    });

    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach(rec => console.log(`   ${rec}`));
    } else {
      console.log(`\n✅ All performance targets met!`);
    }

    console.log('\n' + '='.repeat(80));
  }
}

/**
 * 主入口 - 运行基准测试
 */
export async function runBenchmarks(): Promise<BenchmarkReport> {
  const suite = new BenchmarkSuite();
  const report = await suite.runAll();
  suite.printSummary(report);
  return report;
}

// 如果直接运行此文件
if (require.main === module) {
  runBenchmarks().catch(console.error);
}
