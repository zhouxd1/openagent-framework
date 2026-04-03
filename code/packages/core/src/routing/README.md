# 智能路由系统

## 概述

OpenAgent Framework 的智能路由系统提供了一套完整的 LLM 提供商选择和负载均衡解决方案。系统能够根据任务类型、成本、性能等多个维度自动选择最佳的 LLM 提供商，并支持自动回退和健康检查。

## 主要功能

### 1. 多种路由策略

#### 1.1 智能路由（Smart Routing）- 推荐使用
综合考虑任务类型、成本、性能和能力匹配的混合策略，适用于大多数场景。

**特点：**
- 任务类型识别（编程、写作、分析、翻译等）
- 成本优化（自动计算 token 成本）
- 性能优化（考虑响应时间、可用性、错误率）
- 能力匹配（根据任务需求选择具备相应能力的提供商）

**权重分配：**
- 任务类型：35%
- 成本优化：25%
- 性能优化：25%
- 能力匹配：15%

**使用场景：**
- 通用场景，需要平衡多个因素
- 不确定具体需求时的默认选择

#### 1.2 成本优化（Cost-Optimized）
选择成本最低的提供商，适合对成本敏感的场景。

**特点：**
- 精确计算输入/输出 token 成本
- 支持中英文混合文本的 token 估算
- 实时价格比较

**使用场景：**
- 成本敏感的应用
- 批量处理任务
- 预算有限的项目

#### 1.3 性能优化（Performance）
选择响应最快、可用性最高的提供商。

**考虑因素：**
- 平均响应时间（权重30%）
- 可用性（权重30%）
- 错误率（权重20%）
- 能力数量（权重20%）

**使用场景：**
- 实时交互应用
- 对延迟敏感的任务
- 高并发场景

#### 1.4 轮询负载均衡（Round-Robin）
按顺序依次选择提供商，适合简单的负载均衡场景。

**特点：**
- 公平分配负载
- 实现简单
- 无状态管理

**使用场景：**
- 提供商性能相近
- 简单的负载均衡需求
- 测试和开发环境

### 2. 路由规则

#### 2.1 基于任务类型
根据任务描述自动识别任务类型，并选择最适合的模型。

**支持的任务类型：**
- **编程（CODING）**: deepseek-coder, gpt-4, claude-3-opus
- **写作（WRITING）**: claude-3-opus, gpt-4, deepseek-chat
- **分析（ANALYSIS）**: gpt-4, claude-3-opus, deepseek-chat
- **聊天（CHAT）**: gpt-3.5-turbo, deepseek-chat, glm-4
- **翻译（TRANSLATION）**: gpt-4, claude-3-opus
- **数学（MATH）**: gpt-4, claude-3-opus

#### 2.2 基于能力匹配
根据任务所需的能力（如 vision、function-calling、long-context 等）选择提供商。

#### 2.3 回退规则
当主提供商失败时，自动切换到备用提供商。

**默认回退链：**
- OpenAI → DeepSeek → Anthropic → GLM
- Anthropic → OpenAI → DeepSeek
- DeepSeek → OpenAI → GLM
- GLM → DeepSeek → OpenAI

### 3. 提供商池管理

管理所有注册的提供商，包括：
- 提供商注册和注销
- 健康状态检查
- 统计信息更新
- 基于条件的筛选

### 4. 健康检查

定期检查提供商的健康状态，包括：
- 可用性检测
- 错误率监控
- 响应时间统计
- 缓存机制（默认1分钟）

## 使用示例

### 基础用法

```typescript
import { LLMRouter, from '@openagent/core';
import { TaskType } from '@openagent/core';

const router = new LLMRouter({
  defaultStrategy: 'smart',
  fallbackEnabled: true,
});

// 注册提供商
router.registerProviders([
  {
    name: 'openai',
    displayName: 'OpenAI',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    capabilities: ['chat', 'code-generation', 'function-calling'],
    pricing: { input: 0.03, output: 0.06 },
    limits: { maxTokens: 128000 },
    stats: {
      avgResponseTime: 500,
      availability: 0.99,
      totalRequests: 10000,
      errorRate: 0.01,
      lastChecked: new Date(),
    },
  },
  // ... 其他提供商
]);

// 简单路由
const result = await router.route({
  task: 'Write a function to sort an array',
  taskType: TaskType.CODING,
});

console.log(`Selected: ${result.provider} (${result.model})`);
console.log(`Reason: ${result.reason}`);
console.log(`Estimated cost: $${result.estimatedCost?.toFixed(4)}`);
```

### 带约束条件的路由

```typescript
const result = await router.route({
  task: 'Analyze this large dataset',
  constraints: {
    maxCost: 0.01,              // 最大成本 0.01 美元
    maxLatency: 1000,            // 最大延迟 1 秒
    requiredCapabilities: [      // 必需的能力
      'long-context',
      'analysis'
    ],
    preferredProviders: ['deepseek', 'openai'], // 首选提供商
  },
});
```

### 自动回退执行

```typescript
const response = await router.executeWithFallback(
  {
    task: 'Generate a report',
    taskType: TaskType.WRITING,
  },
  async (provider, model) => {
    // 使用选中的提供商执行任务
    const agent = createAgent(provider, model);
    return await agent.run('Generate a comprehensive report');
  }
);
```

### 自定义策略

```typescript
// 添加自定义策略
class CustomStrategy implements RoutingStrategy {
  name = 'custom';
  
  async select(context, providers) {
    // 自定义选择逻辑
    return providers[0];
  }
}

router.addStrategy('custom', new CustomStrategy());

// 使用自定义策略
const result = await router.route({
  task: 'Custom task',
  constraints: {
    preferredProviders: ['custom'],
  },
});
```

## API 参考

### LLMRouter

#### 构造函数
```typescript
constructor(config?: RouterConfig)
```

#### 方法

- `registerProvider(provider: ProviderInfo): void` - 注册单个提供商
- `registerProviders(providers: ProviderInfo[]): void` - 批量注册提供商
- `addStrategy(name: string, strategy: RoutingStrategy): void` - 添加路由策略
- `removeStrategy(name: string): boolean` - 移除路由策略
- `route(context: RoutingContext): Promise<RoutingResult>` - 路由到最佳提供商
- `executeWithFallback<T>(context, executor): Promise<T>` - 执行并自动回退

### 类型定义

```typescript
interface ProviderInfo {
  name: string;
  displayName: string;
  models: string[];
  capabilities: string[];
  pricing: { input: number; output: number };
  limits: { maxTokens: number; rateLimit?: number };
  stats: ProviderStats;
}

interface RoutingContext {
  task: string;
  taskType?: TaskType;
  messages?: Message[];
  tools?: RoutingTool[];
  constraints?: Constraints;
}

interface RoutingResult {
  provider: string;
  model: string;
  reason: string;
  fallback?: string;
  estimatedCost?: number;
}
```

## 性能优化建议

1. **使用缓存**: 健康检查结果会自动缓存，减少不必要的检查
2. **合理设置约束**: 通过约束条件减少候选提供商数量
3. **监控统计信息**: 定期查看提供商的统计信息，及时调整配置
4. **使用任务类型**: 明确指定任务类型可以提高路由准确性
5. **配置回退链**: 为关键应用配置多个备用提供商

## 最佳实践

1. **生产环境**: 使用智能路由策略 + 启用回退
2. **成本敏感**: 使用成本优化策略 + 设置最大成本约束
3. **实时应用**: 使用性能优化策略 + 设置最大延迟约束
4. **测试环境**: 使用轮询策略，平均分配测试负载
5. **混合场景**: 根据不同任务类型使用不同的策略

## 故障排查

### 常见问题

1. **"No available providers" 错误**
   - 检查是否注册了提供商
   - 检查提供商的健康状态
   - 检查约束条件是否过于严格

2. **路由结果不符合预期**
   - 检查任务类型识别是否正确
   - 查看路由结果的 reason 字段
   - 验证提供商的统计信息是否准确

3. **成本估算不准确**
   - Token 估算是近似值，实际成本可能有所不同
   - 建议在生产环境中使用实际计费数据校准

## 文件结构

```
packages/core/src/routing/
├── router.ts              # 路由引擎
├── strategies/            # 路由策略
│   ├── base.ts           # 基础策略接口
│   ├── cost-optimized.ts # 成本优化
│   ├── performance.ts    # 性能优化
│   ├── round-robin.ts    # 轮询负载均衡
│   └── smart.ts          # 智能路由（混合）
├── rules/                 # 路由规则
│   ├── task-based.ts     # 基于任务类型
│   ├── capability.ts     # 基于能力匹配
│   └── fallback.ts       # 回退规则
├── provider-pool.ts       # 提供商池管理
├── health-check.ts        # 健康检查
├── types.ts              # 类型定义
└── index.ts              # 导出
```

## 测试

测试文件位于 `tests/routing/` 目录，包括：
- `router.test.ts` - 路由器测试
- `strategies.test.ts` - 策略测试
- `provider-pool.test.ts` - 提供商池测试

运行测试：
```bash
npm test
```

## 未来扩展

1. **机器学习优化**: 基于历史数据训练路由模型
2. **动态权重调整**: 根据实际使用情况自动调整策略权重
3. **成本预测**: 更精确的成本估算模型
4. **A/B 测试**: 支持不同路由策略的对比测试
5. **实时监控**: 集成监控系统，实时跟踪路由性能

## 许可证

MIT License
