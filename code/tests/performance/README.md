# OpenAgent Framework Performance Test Suite

性能测试和优化工具套件，用于确保框架达到生产就绪的性能标准。

## 📊 目标性能指标

| 指标 | 目标 | 描述 |
|------|------|------|
| CLI 启动 | < 200ms (P95) | 命令行工具启动时间 |
| 会话创建 | < 100ms (P95) | 创建新会话的时间 |
| 消息响应（非流式） | < 5s (P95) | 完整消息生成时间 |
| 流式首字节 | < 500ms (P95) | 流式响应的首个字节 |
| 工具执行（简单） | < 300ms (P95) | 简单工具执行时间 |
| 并发会话 | 10,000+ | 最大并发会话数 |
| 内存占用 | < 500MB | 单实例内存使用 |

## 🚀 快速开始

### 运行完整性能测试

```bash
# 使用 Node.js 直接运行
npx ts-node tests/performance/index.ts

# 或者使用 npm script
npm run test:performance
```

### 快速性能检查（用于 CI/CD）

```typescript
import { quickPerformanceCheck } from './tests/performance';

const passed = await quickPerformanceCheck();
if (!passed) {
  process.exit(1);
}
```

## 📁 文件结构

```
tests/performance/
├── index.ts                    # 主入口
├── benchmark-suite.ts          # 基准测试套件
├── helpers.ts                  # 辅助函数
├── memory-monitor.ts           # 内存监控工具
├── optimization-tools.ts       # 优化工具
└── report-generator.ts         # 报告生成器
```

## 🔧 核心功能

### 1. 基准测试套件 (benchmark-suite.ts)

完整的性能基准测试，包括：
- 工具执行性能测试
- 会话管理性能测试
- LLM 请求性能测试（模拟）
- 并发性能测试
- 内存使用测试
- 启动性能测试
- 事件循环延迟测试

```typescript
import { runBenchmarks } from './tests/performance';

const report = await runBenchmarks();
console.log(`Passed: ${report.summary.passed}/${report.summary.totalTests}`);
```

### 2. 性能辅助函数 (helpers.ts)

提供各种性能测量工具：

```typescript
import { measure, Timer, EventLoopMonitor } from './tests/performance';

// 测量函数执行时间
const { samples, duration } = await measure(asyncFunction, 1000);

// 高精度计时器
const timer = new Timer();
timer.mark('start');
// ... 执行操作
timer.mark('end');
console.log(`Elapsed: ${timer.elapsed()}ms`);

// 事件循环监控
const monitor = new EventLoopMonitor();
monitor.start();
// ... 执行操作
const stats = monitor.stop();
console.log(`Avg delay: ${stats.avg}ms, P95: ${stats.p95}ms`);
```

### 3. 内存监控 (memory-monitor.ts)

持续监控内存使用并检测泄漏：

```typescript
import { MemoryMonitor } from './tests/performance';

const monitor = new MemoryMonitor();
monitor.start(1000); // 每秒采样

// ... 运行测试代码

monitor.stop();
const analysis = monitor.analyze();

console.log(`Peak memory: ${analysis.peak.heapUsed} MB`);
console.log(`Memory growth: ${analysis.growth} MB`);
console.log(`Detected leaks: ${analysis.leaks.length}`);
```

### 4. 报告生成器 (report-generator.ts)

生成多种格式的性能报告：

```typescript
import { ReportGenerator } from './tests/performance';

const generator = new ReportGenerator({
  outputDir: './reports',
  formats: ['json', 'markdown', 'html'],
});

generator.generate(report);
```

### 5. 优化工具 (optimization-tools.ts)

提供各种性能优化工具：

#### 对象池（减少 GC 压力）

```typescript
import { ObjectPool } from './tests/performance';

const pool = new ObjectPool(
  () => ({ data: new Array(1000) }),
  (obj) => { obj.data.fill(0); },
  100
);

const obj = pool.acquire();
// 使用对象...
pool.release(obj);
```

#### 批处理器

```typescript
import { BatchProcessor } from './tests/performance';

const batcher = new BatchProcessor(
  async (items) => {
    // 批量处理
    return items.map(processItem);
  },
  10,  // 批大小
  100  // 延迟
);

const result = await batcher.add(item);
```

#### 查询分析器

```typescript
import { QueryProfiler } from './tests/performance';

const profiler = new QueryProfiler();

const result = await profiler.measureQuery(
  'SELECT * FROM sessions WHERE id = ?',
  async () => db.query(...)
);

const slowQueries = profiler.getSlowQueries(100);
console.log(`Slow queries: ${slowQueries.length}`);
```

#### 缓存监控

```typescript
import { CacheMonitor } from './tests/performance';

const cacheMonitor = new CacheMonitor();

// 在缓存操作中
if (cache.get(key)) {
  cacheMonitor.recordHit();
  return cache.get(key);
} else {
  cacheMonitor.recordMiss();
  const value = await fetchValue();
  cache.set(key, value);
  cacheMonitor.recordSet();
  return value;
}

// 检查缓存效率
const stats = cacheMonitor.getStats();
console.log(`Hit rate: ${stats.hitRate}%`);
```

## 📈 报告示例

### Markdown 报告

```markdown
# OpenAgent Framework Performance Report

## 📊 Test Summary
- **Timestamp**: 2024-01-15T10:30:00.000Z
- **Node.js Version**: v20.11.0
- **Total Tests**: 7
- **✅ Passed**: 6
- **❌ Failed**: 1

## ✅ Tool Execution Performance
**Duration**: 1250ms

| Metric | Value | P95 |
|--------|-------|-----|
| Simple Tool Execution | 1.23ms | 2.45ms |
| Complex Tool Execution | 12.5ms | 25.3ms |

**Targets**:
- ✅ Tool Execution (P95): 2.45ms < 300ms
```

### HTML 报告

生成交互式 HTML 报告，包含：
- 彩色编码的性能指标
- 表格化的统计数据
- 视觉化的目标检查结果
- 优化建议列表

## 🔍 性能分析技巧

### 1. 识别热点

使用 CPU 分析器识别性能瓶颈：

```typescript
import { CPUProfiler } from './tests/performance';

const profiler = new CPUProfiler();
profiler.start();

// ... 运行代码

const stats = profiler.stop();
console.log(`User time: ${stats.totalUserTime}µs`);
console.log(`System time: ${stats.totalSystemTime}µs`);
```

### 2. 检测内存泄漏

```typescript
import { MemoryMonitor } from './tests/performance';

const monitor = new MemoryMonitor();
monitor.start();

// 执行操作...

monitor.stop();
const leaks = monitor.analyze().leaks;

leaks.forEach(leak => {
  console.log(`${leak.severity}: ${leak.description}`);
});
```

### 3. 监控事件循环

```typescript
import { EventLoopMonitor } from './tests/performance';

const monitor = new EventLoopMonitor();
monitor.start();

// ... 运行代码

const stats = monitor.stop();
if (stats.p95 > 10) {
  console.warn(`Event loop blocked! P95 delay: ${stats.p95}ms`);
}
```

## ⚠️ 注意事项

### 运行性能测试

1. **使用生产构建**: 确保测试的是优化后的代码
   ```bash
   npm run build
   NODE_ENV=production npm run test:performance
   ```

2. **多次运行**: 运行多次以获得稳定的结果
   ```bash
   for i in {1..5}; do npm run test:performance; done
   ```

3. **隔离环境**: 在专用机器上运行，避免其他进程干扰

4. **监控资源**: 使用系统监控工具观察 CPU 和内存使用

### 内存测试

对于准确的内存测试，需要启用 GC 暴露：

```bash
node --expose-gc tests/performance/index.ts
```

## 📚 性能优化最佳实践

### 1. 先测量，再优化

不要基于猜测优化。始终先测量实际性能：

```typescript
// ❌ 错误：盲目优化
const cached = new Map(); // 不确定是否需要

// ✅ 正确：测量后决定
const { samples } = await measure(() => expensiveOperation(), 1000);
if (calculateStats(samples).avg > threshold) {
  // 添加缓存
}
```

### 2. 关注 P95 和 P99

不要只看平均值，关注尾部延迟：

```typescript
const stats = calculateStats(samples);
console.log(`Avg: ${stats.avg}ms`);
console.log(`P95: ${stats.p95}ms`); // 更重要！
console.log(`P99: ${stats.p99}ms`);
```

### 3. 渐进式优化

一次只优化一个瓶颈，验证效果：

```typescript
// 1. 运行基准测试
const before = await runBenchmarks();

// 2. 应用优化
applyOptimization();

// 3. 再次测试
const after = await runBenchmarks();

// 4. 对比结果
compareReports(before, after);
```

### 4. 保持可读性

性能优化不应牺牲代码质量：

```typescript
// ❌ 过度优化，难以理解
const x=a?b?c?d:e:f:g;

// ✅ 清晰且高效
if (a) {
  if (b) {
    return c ? d : e;
  }
  return f;
}
return g;
```

## 🎯 下一步

1. 运行基准测试获取当前性能数据
2. 分析报告中的瓶颈
3. 使用优化工具逐步改进
4. 重复测试验证改进效果
5. 在 CI/CD 中集成性能测试

## 📖 参考资料

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [V8 Performance](https://v8.dev/blog)
- [Understanding Event Loop](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/)
