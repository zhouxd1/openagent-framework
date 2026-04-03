# 性能优化指南

本文档提供 OpenAgent Framework 性能优化的最佳实践，包括并发控制、缓存策略、内存管理和数据库优化。

---

## 📋 目录

1. [并发控制](#并发控制)
2. [缓存策略](#缓存策略)
3. [内存管理](#内存管理)
4. [数据库优化](#数据库优化)
5. [监控和告警](#监控和告警)

---

## 🔄 并发控制

### Worker Pool 配置

```typescript
// 配置 Worker Pool
const workerPoolConfig = {
  // 根据可用资源调整
  maxWorkers: process.env.NODE_ENV === 'production' 
    ? os.cpus().length * 2 
    : 4,
  
  // 任务队列大小
  maxQueueSize: 1000,
  
  // 任务超时
  taskTimeout: 30000,
  
  // 空闲超时
  idleTimeout: 60000,
};

const workerPool = new WorkerPool(workerPoolConfig.maxWorkers);

// 监控 Worker Pool 状态
setInterval(() => {
  const stats = workerPool.getStats();
  console.log('Worker Pool Stats:', stats);
}, 5000);
```

### 限流策略

```typescript
// 限流器实现
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  /**
   * 检查是否允许请求
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // 移除过期请求
    const validRequests = requests.filter(
      time => time > now - this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // 记录新请求
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }
  
  /**
   * 获取剩余配额
   */
  getRemaining(key: string): number {
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(
      time => time > Date.now() - this.windowMs
    );
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

// 使用限流器
const limiter = new RateLimiter(100, 60000); // 每分钟 100 个请求

// 应用到 Agent
const rateLimitedAgent = new Proxy(agent, {
  get(target, prop) {
    if (prop === 'run') {
      return async function(...args: any[]) {
        const key = args[1]?.userId || 'default';
        
        if (!limiter.isAllowed(key)) {
          throw new Error('Rate limit exceeded');
        }
        
        return target.run(...args);
      };
    }
    return target[prop];
  },
});
```

---

## 📦 缓存策略

### 多层缓存

```typescript
// 多层缓存实现
class MultiLayerCache {
  private l1Cache: LRUCache<any>;  // 内存缓存
  private l2Cache: RedisCache;      // Redis 缓存
  private logger: Logger;
  
  constructor() {
    this.l1Cache = createLRUCache({ maxSize: 1000 });
    this.l2Cache = new RedisCache();
    this.logger = createLogger('cache');
  }
  
  /**
   * 获取数据
   */
  async get<T>(key: string): Promise<T | null> {
    // L1 缓存
    const l1Data = this.l1Cache.get(key);
    if (l1Data !== undefined) {
      this.logger.debug('L1 cache hit', { key });
      return l1Data;
    }
    
    // L2 缓存
    const l2Data = await this.l2Cache.get<T>(key);
    if (l2Data !== null) {
      this.logger.debug('L2 cache hit', { key });
      // 回填 L1
      this.l1Cache.set(key, l2Data);
      return l2Data;
    }
    
    this.logger.debug('Cache miss', { key });
    return null;
  }
  
  /**
   * 设置数据
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void> {
    const ttl = options?.ttl || 300000; // 默认 5 分钟
    
    // 设置 L1
    this.l1Cache.set(key, value, { ttl: Math.min(ttl, 60000) });
    
    // 设置 L2
    await this.l2Cache.set(key, value, { ttl });
  }
  
  /**
   * 删除数据
   */
  async delete(key: string): Promise<void> {
    this.l1Cache.delete(key);
    await this.l2Cache.delete(key);
  }
  
  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    await this.l2Cache.clear();
  }
}
```

### 缓存预热

```typescript
// 缓存预热策略
class CacheWarmup {
  private cache: MultiLayerCache;
  
  constructor(cache: MultiLayerCache) {
    this.cache = cache;
  }
  
  /**
   * 预热常用数据
   */
  async warmup(): Promise<void> {
    console.log('Starting cache warmup...');
    
    // 预热系统配置
    await this.warmupSystemConfig();
    
    // 预热热门工具
    await this.warmupPopularTools();
    
    // 预热活跃用户
    await this.warmupActiveUsers();
    
    console.log('Cache warmup completed');
  }
  
  private async warmupSystemConfig(): Promise<void> {
    const configs = await db.query('SELECT * FROM system_config');
    
    for (const config of configs) {
      await this.cache.set(
        `config:${config.key}`,
        config.value,
        { ttl: 3600000 } // 1 小时
      );
    }
  }
  
  private async warmupPopularTools(): Promise<void> {
    const tools = await db.query(`
      SELECT tool_name, COUNT(*) as usage_count
      FROM tool_usage
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY tool_name
      ORDER BY usage_count DESC
      LIMIT 20
    `);
    
    for (const tool of tools) {
      const toolDef = await registry.get(tool.tool_name);
      await this.cache.set(`tool:${tool.tool_name}`, toolDef);
    }
  }
  
  private async warmupActiveUsers(): Promise<void> {
    const users = await db.query(`
      SELECT user_id, preferences
      FROM users
      WHERE last_active > NOW() - INTERVAL '1 day'
    `);
    
    for (const user of users) {
      await this.cache.set(
        `user:${user.user_id}:prefs`,
        user.preferences,
        { ttl: 1800000 } // 30 分钟
      );
    }
  }
}
```

---

## 💾 内存管理

### 内存泄漏检测

```typescript
// 内存监控
class MemoryMonitor {
  private interval: NodeJS.Timeout;
  private logger: Logger;
  
  constructor() {
    this.logger = createLogger('memory-monitor');
  }
  
  /**
   * 开始监控
   */
  start(intervalMs: number = 60000): void {
    this.interval = setInterval(() => {
      this.check();
    }, intervalMs);
  }
  
  /**
   * 停止监控
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
  
  /**
   * 检查内存使用
   */
  private check(): void {
    const usage = process.memoryUsage();
    
    this.logger.info('Memory usage', {
      heapUsed: this.formatBytes(usage.heapUsed),
      heapTotal: this.formatBytes(usage.heapTotal),
      external: this.formatBytes(usage.external),
      rss: this.formatBytes(usage.rss),
    });
    
    // 警告阈值
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > 1000) { // 1GB
      this.logger.warn('High memory usage detected');
      this.takeHeapSnapshot();
    }
  }
  
  /**
   * 生成堆快照
   */
  private takeHeapSnapshot(): void {
    const fs = require('fs');
    const v8 = require('v8');
    
    const snapshotStream = v8.getHeapSnapshot();
    const fileStream = fs.createWriteStream(
      `heap-snapshot-${Date.now()}.heapsnapshot`
    );
    
    snapshotStream.pipe(fileStream);
    
    this.logger.info('Heap snapshot created');
  }
  
  private formatBytes(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
}

// 使用
const monitor = new MemoryMonitor();
monitor.start(30000); // 每 30 秒检查一次
```

---

## 🗄️ 数据库优化

### 查询优化

```sql
-- 创建必要的索引

-- 会话表
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_sessions_user_created ON sessions(user_id, created_at DESC);

-- 消息表
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_session_timestamp ON messages(session_id, timestamp DESC);

-- 工具使用记录
CREATE INDEX idx_tool_usage_created_at ON tool_usage(created_at DESC);
CREATE INDEX idx_tool_usage_tool_name ON tool_usage(tool_name, created_at DESC);
```

### 连接池配置

```typescript
// 数据库连接池
import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  // 连接参数
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // 连接池设置
  max: 20,                    // 最大连接数
  min: 5,                     // 最小连接数
  idleTimeoutMillis: 30000,   // 空闲超时
  connectionTimeoutMillis: 2000,  // 连接超时
  
  // 性能优化
  statement_timeout: 10000,   // 语句超时
  query_timeout: 10000,
  
  // SSL 配置（生产环境）
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: true }
    : false,
};

const pool = new Pool(poolConfig);

// 监控连接池
pool.on('connect', () => {
  console.log('New client connected');
});

pool.on('acquire', () => {
  console.log('Client acquired');
});

pool.on('release', () => {
  console.log('Client released');
});

pool.on('remove', () => {
  console.log('Client removed');
});

pool.on('error', (err) => {
  console.error('Pool error:', err);
});
```

---

## 📊 监控和告警

### 性能指标

```typescript
// 性能指标收集
class PerformanceMetrics {
  private metrics: Map<string, MetricValue[]> = new Map();
  
  /**
   * 记录指标
   */
  record(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push({
      value,
      timestamp: Date.now(),
    });
    
    // 保留最近 1 小时的数据
    this.cleanOldMetrics(name);
  }
  
  /**
   * 获取统计数据
   */
  getStats(name: string): MetricStats {
    const values = this.metrics.get(name) || [];
    
    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p95: 0 };
    }
    
    const sorted = values.map(v => v.value).sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sum / count,
      p95: sorted[Math.floor(count * 0.95)],
    };
  }
  
  /**
   * 清理旧数据
   */
  private cleanOldMetrics(name: string): void {
    const values = this.metrics.get(name);
    if (!values) return;
    
    const cutoff = Date.now() - 3600000; // 1 小时
    const filtered = values.filter(v => v.timestamp > cutoff);
    
    this.metrics.set(name, filtered);
  }
}

interface MetricValue {
  value: number;
  timestamp: number;
}

interface MetricStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
}

// 使用
const metrics = new PerformanceMetrics();

// 记录 Agent 执行时间
const start = Date.now();
await agent.run(input);
metrics.record('agent_execution_time', Date.now() - start);

// 获取统计
const stats = metrics.getStats('agent_execution_time');
console.log('Agent execution stats:', stats);
```

### Prometheus 集成

```typescript
// Prometheus 指标
import { collectDefaultMetrics, Registry, Counter, Histogram, Gauge } from 'prom-client';

// 创建注册表
const register = new Registry();

// 默认指标
collectDefaultMetrics({ register });

// 自定义指标
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

const agentExecutionDuration = new Histogram({
  name: 'agent_execution_duration_seconds',
  help: 'Duration of agent execution in seconds',
  labelNames: ['agent_id', 'provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const toolExecutionTotal = new Counter({
  name: 'tool_execution_total',
  help: 'Total number of tool executions',
  labelNames: ['tool_name', 'success'],
  registers: [register],
});

const activeSessions = new Gauge({
  name: 'active_sessions_total',
  help: 'Number of active sessions',
  registers: [register],
});

// 使用指标
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      path: req.path,
      status: res.statusCode,
    });
  });
  next();
});

// Agent 执行
const end = agentExecutionDuration.startTimer({
  agent_id: agent.id,
  provider: agent.provider,
});

await agent.run(input);

end();

// 工具执行
toolExecutionTotal.inc({
  tool_name: tool.name,
  success: result.success ? 'true' : 'false',
});

// 暴露指标端点
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
```

### 告警规则

```yaml
# prometheus/alerts.yml

groups:
  - name: openagent
    rules:
      # 响应时间告警
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(agent_execution_duration_seconds_bucket[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High agent response time
          description: "P95 response time is {{ $value }}s"
      
      # 错误率告警
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate
          description: "Error rate is {{ $value | humanizePercentage }}"
      
      # 内存使用告警
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 1000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: High memory usage
          description: "Memory usage is {{ $value }}MB"
      
      # 活跃会话数告警
      - alert: TooManyActiveSessions
        expr: active_sessions_total > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Too many active sessions
          description: "Active sessions: {{ $value }}"
```

---

## 📚 相关文档

- **[架构概览](../architecture/overview.md)** - 系统架构
- **[核心引擎](../architecture/core-engine.md)** - 引擎设计
- **[部署指南](../getting-started/installation.md)** - 部署说明

---

**性能优化指南完成！优化你的 Agent！** 🚀
