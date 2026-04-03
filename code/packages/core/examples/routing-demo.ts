/**
 * 路由系统使用示例
 * 演示如何使用智能路由系统选择最佳 LLM 提供商
 */

import { LLMRouter, from '../packages/core';
import { ProviderInfo, TaskType, RouterConfig } from '../packages/core/src/routing';

// 创建路由器
const router = new LLMRouter({
  defaultStrategy: 'smart',
  fallbackEnabled: true,
});

// 注册提供商
const providers = [
  {
    name: 'openai',
    displayName: 'OpenAI',
    models: ['gpt-4', 'gpt-4o-mini'],
    capabilities: ['chat', 'code-generation', 'function-calling', 'structured-output'],
    pricing: { input: 0.03, output: 0.06 },
    limits: { maxTokens: 128000, rateLimit: 60 },
    stats: {
      avgResponseTime: 500,
      availability: 0.99,
      totalRequests: 10000,
      errorRate: 0.01,
      lastChecked: new Date(),
    },
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    capabilities: ['chat', 'code-generation', 'function-calling'],
    pricing: { input: 0.001, output: 0.002 },
    limits: { maxTokens: 64000 },
    stats: {
      avgResponseTime: 800,
      availability: 0.98,
      totalRequests: 5000,
      errorRate: 0.02,
      lastChecked: new Date(),
    },
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic (Claude)',
    models: ['claude-3-opus', 'claude-3-sonnet'],
    capabilities: ['chat', 'code-generation', 'vision', 'function-calling', 'long-context'],
    pricing: { input: 0.015, output: 0.075 },
    limits: { maxTokens: 200000 },
    stats: {
      avgResponseTime: 1200,
      availability: 0.99,
      totalRequests: 2000,
      errorRate: 0.005,
      lastChecked: new Date(),
    },
  },
];

router.registerProviders(providers);

console.log('Available providers:', providers.map(p => p.name).join(', ' - '));

console.log(`\nProvider: ${p.displayName}`);
console.log(`Models: ${p.models.join(', ')}`);
console.log(`Capabilities: ${p.capabilities.join(', ')}`);
console.log(`Pricing: input=$${p.pricing.input}/1K tokens, output $${p.pricing.output}/1K tokens`);
console.log(`Limits: maxTokens: ${p.limits.maxTokens}, rateLimit: ${p.limits.rateLimit || 'N/A'} req/s`);

 console.log(`Stats: avgResponseTime: ${p.stats.avgResponseTime}ms`);
console.log(`       availability: ${(p.stats.availability * 100).toFixed(1)}%`);
console.log(`  total requests: ${p.stats.totalRequests}`);
console.log(`  error rate: ${(p.stats.errorRate * 100).toFixed(2)}%`);
console.log(`  last checked: ${p.stats.lastChecked.toISOString());
console.log(`\n`);

// 简单的编码任务
async function simple() {
  const result = await router.route({
    task: 'Write a function to sort an array',
    taskType: TaskType.CODING,
  });

  console.log('Selected provider:', result.provider);
  console.log('Selected model:', result.model);
  console.log('Reason:', result.reason);
  console.log(`\nCost estimate: $${result.estimatedCost?.toFixed(2)} ms`);
  console.log(`\n`);
}

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

/**
 * 获取路由器实例
 */
const router = new LLMRouter();
const providerPool = router.getProviderPool();

console.log('Provider pool initialized');
console.log(`  Available providers: ${providerPool.getAvailable().length}}`);
console.log(`  Provider count: ${providerPool.getProvider('test-provider')?.name}`);

/**
 * 测试 Cost优化策略
 */
async function testCostOptimizedStrategy() {
  const result = await router.route({
    task: 'Write a short story about space exploration',
    constraints: {
      maxCost: 0.001,
    },
  });

  console.log('Selected provider:', result.provider);
  console.log('Estimated cost:', result.estimatedCost?.toFixed(6));
  console.log('Expected cost-effective provider');
  console.log(`\n`);

  /**
   * 测试智能路由策略
   */
  async function testSmartRouting() {
    const result = await router.route({
    task: 'Analyze this dataset and provide insights on business decisions',
      constraints: {
      requiredCapabilities: ['analysis', 'long-context'],
    },
  });

    console.log('Selected provider:', result.provider);
  console.log('Selected capabilities:', result.provider);
  console.log(`\n`);
}
)();

/**
 * 测试性能优化策略
 */
async function testPerformanceStrategy() {
  const result = await router.route({
    task: 'Quick response needed',
    constraints: {
      maxLatency: 600,
    },
  });

  console.log('Selected provider:', result.provider);
  console.log('Avg response time:', result.provider.stats.avgResponseTime);
  console.log(`\n`);
}
