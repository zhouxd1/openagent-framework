/**
 * 性能测试运行脚本
 * 独立运行，不需要编译整个项目
 */

// 直接运行模拟的性能测试
import { 
  measure, 
  calculateStats, 
  Timer, 
  EventLoopMonitor,
  getMemoryUsage,
  generateTestData,
  PerformanceMetric,
  formatMetric
} from './helpers';

import { MemoryMonitor } from './memory-monitor';

async function main() {
  console.log('🚀 OpenAgent Framework Performance Test Suite\n');
  console.log('=' .repeat(80));

  const results: Array<{
    category: string;
    metrics: PerformanceMetric[];
  }> = [];

  // 1. 工具执行性能测试
  console.log('\n📊 Testing: Tool Execution Performance');
  {
    const metrics: PerformanceMetric[] = [];
    
    // 简单操作测试
    const simpleOp = async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return { result: 'ok' };
    };

    const { samples } = await measure(simpleOp, 1000);
    const stats = calculateStats(samples);
    
    metrics.push({
      name: '简单操作',
      unit: 'ms',
      ...stats,
    });

    // 工具注册测试
    const registry = new Map<string, any>();
    const registerOp = () => {
      const id = `tool-${Math.random()}`;
      registry.set(id, { name: id });
      return id;
    };

    const { samples: regSamples } = await measure(registerOp, 10000);
    const regStats = calculateStats(regSamples);
    
    metrics.push({
      name: '工具注册',
      unit: 'ms',
      ...regStats,
    });

    // 工具查找测试
    const lookupOp = () => {
      const keys = Array.from(registry.keys());
      return registry.get(keys[Math.floor(Math.random() * keys.length)]);
    };

    const { samples: lookupSamples } = await measure(lookupOp, 10000);
    const lookupStats = calculateStats(lookupSamples);
    
    metrics.push({
      name: '工具查找',
      unit: 'ms',
      ...lookupStats,
    });

    results.push({ category: '工具执行', metrics });
    metrics.forEach(m => console.log(`  ${formatMetric(m)}`));
  }

  // 2. 会话管理性能测试
  console.log('\n📊 Testing: Session Management Performance');
  {
    const metrics: PerformanceMetric[] = [];
    const sessions = new Map<string, any>();

    // 会话创建测试
    const createSession = async () => {
      const id = `session-${Date.now()}-${Math.random()}`;
      sessions.set(id, {
        id,
        userId: 'user-1',
        createdAt: new Date(),
        messages: [],
      });
      return id;
    };

    const { samples } = await measure(createSession, 1000);
    const stats = calculateStats(samples);
    
    metrics.push({
      name: '会话创建',
      unit: 'ms',
      ...stats,
    });

    // 会话查询测试
    const getSession = () => {
      const keys = Array.from(sessions.keys());
      return sessions.get(keys[Math.floor(Math.random() * keys.length)]);
    };

    const { samples: getSamples } = await measure(getSession, 10000);
    const getStats = calculateStats(getSamples);
    
    metrics.push({
      name: '会话查询',
      unit: 'ms',
      ...getStats,
    });

    // 消息添加测试
    const addMessage = async () => {
      const keys = Array.from(sessions.keys());
      const session = sessions.get(keys[Math.floor(Math.random() * keys.length)]);
      if (session) {
        session.messages.push({
          id: `msg-${Date.now()}`,
          role: 'user',
          content: 'test',
        });
      }
      return session;
    };

    const { samples: msgSamples } = await measure(addMessage, 1000);
    const msgStats = calculateStats(msgSamples);
    
    metrics.push({
      name: '消息添加',
      unit: 'ms',
      ...msgStats,
    });

    results.push({ category: '会话管理', metrics });
    metrics.forEach(m => console.log(`  ${formatMetric(m)}`));
  }

  // 3. 并发性能测试
  console.log('\n📊 Testing: Concurrency Performance');
  {
    const metrics: PerformanceMetric[] = [];
    
    // 并发创建测试
    const concurrentCreate = async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return { id: Date.now() };
    };

    // 测试 100 并发
    const start100 = Date.now();
    const promises100 = Array.from({ length: 100 }, () => concurrentCreate());
    await Promise.all(promises100);
    const duration100 = Date.now() - start100;

    metrics.push({
      name: '100 并发创建',
      value: duration100,
      unit: 'ms',
    });

    // 测试 1000 并发
    const start1000 = Date.now();
    const promises1000 = Array.from({ length: 1000 }, () => concurrentCreate());
    await Promise.all(promises1000);
    const duration1000 = Date.now() - start1000;

    metrics.push({
      name: '1000 并发创建',
      value: duration1000,
      unit: 'ms',
    });

    // 测试 5000 并发
    const start5000 = Date.now();
    const promises5000 = Array.from({ length: 5000 }, () => concurrentCreate());
    await Promise.all(promises5000);
    const duration5000 = Date.now() - start5000;

    metrics.push({
      name: '5000 并发创建',
      value: duration5000,
      unit: 'ms',
    });

    results.push({ category: '并发性能', metrics });
    metrics.forEach(m => console.log(`  ${formatMetric(m)}`));
  }

  // 4. 内存使用测试
  console.log('\n📊 Testing: Memory Usage');
  {
    const metrics: PerformanceMetric[] = [];
    
    const initialMem = getMemoryUsage();
    
    // 创建大量对象
    const objects: any[] = [];
    for (let i = 0; i < 10000; i++) {
      objects.push({
        id: i,
        data: generateTestData(10),
        timestamp: Date.now(),
      });
    }

    const peakMem = getMemoryUsage();
    
    metrics.push({
      name: '初始内存',
      value: initialMem.heapUsed,
      unit: 'MB',
    });

    metrics.push({
      name: '峰值内存',
      value: peakMem.heapUsed,
      unit: 'MB',
    });

    metrics.push({
      name: '内存增长',
      value: peakMem.heapUsed - initialMem.heapUsed,
      unit: 'MB',
    });

    // 清理
    objects.length = 0;
    if (global.gc) {
      global.gc();
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const afterCleanup = getMemoryUsage();
    
    metrics.push({
      name: '清理后内存',
      value: afterCleanup.heapUsed,
      unit: 'MB',
    });

    metrics.push({
      name: '潜在泄漏',
      value: afterCleanup.heapUsed - initialMem.heapUsed,
      unit: 'MB',
    });

    results.push({ category: '内存使用', metrics });
    metrics.forEach(m => console.log(`  ${formatMetric(m)}`));
  }

  // 5. 事件循环延迟测试
  console.log('\n📊 Testing: Event Loop Latency');
  {
    const monitor = new EventLoopMonitor();
    monitor.start(10);

    // 执行一些工作
    for (let i = 0; i < 100; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const stats = monitor.stop();

    const metrics: PerformanceMetric[] = [
      {
        name: '平均延迟',
        value: stats.avg,
        unit: 'ms',
      },
      {
        name: '最大延迟',
        value: stats.max,
        unit: 'ms',
      },
      {
        name: 'P95 延迟',
        value: stats.p95,
        unit: 'ms',
      },
    ];

    results.push({ category: '事件循环', metrics });
    metrics.forEach(m => console.log(`  ${formatMetric(m)}`));
  }

  // 打印总结
  console.log('\n' + '='.repeat(80));
  console.log('📊 Performance Test Summary');
  console.log('='.repeat(80));

  for (const result of results) {
    console.log(`\n${result.category}:`);
    result.metrics.forEach(m => {
      const status = m.p95 !== undefined && m.p95 < 100 ? '✅' : 
                     m.p95 !== undefined && m.p95 < 500 ? '⚠️' : 'ℹ️';
      console.log(`  ${status} ${formatMetric(m)}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Performance testing complete!');
  console.log('='.repeat(80));
}

// 运行测试
main().catch(console.error);
