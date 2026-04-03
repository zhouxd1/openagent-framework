/**
 * 路由系统测试
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import { LLMRouter, CostOptimizedStrategy, PerformanceStrategy, RoundRobinStrategy, SmartRoutingStrategy } from '../src/routing';
import { ProviderInfo, TaskType, RouterConfig } from '../src/routing/types';

describe('LLMRouter', () => {
  let router: LLMRouter;
  let providers: ProviderInfo[];

  const defaultConfig: RouterConfig = {
    defaultStrategy: 'smart',
    fallbackEnabled: true,
  });

  beforeEach(() => {
    router = new LLMRouter(defaultConfig);

    // 创建测试提供商
    providers = [
      {
        name: 'openai',
        displayName: 'OpenAI',
        models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4o-mini'],
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
  });

  afterEach(() => {
    router = null as any;
  });

  describe('route()', () => {
    it('should route to appropriate provider based on task type', async () => {
      const result = await router.route({
        task: 'Write a function to sort an array',
        taskType: TaskType.CODING,
      });

      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.reason).toBeDefined();
    });

    it('should use coding task type to select deepseek-coder', async () => {
      const result = await router.route({
        task: 'Write a function to sort an array',
        taskType: TaskType.CODING,
      });

      expect(result.provider).toBe('deepseek');
      expect(result.model).toBe('deepseek-coder');
    });

    it('should use chat task type to select cost-effective option', async () => {
      const result = await router.route({
        task: 'What is the weather today?',
        taskType: TaskType.CHAT,
        constraints: {
        maxCost: 0.01,
        preferredProviders: ['deepseek'],
      },
      });

      expect(result.provider).toBe('deepseek');
    });

    it('should fallback when primary provider fails', async () => {
      // 修改 OpenAI 的可用性为很低
      const openaiProvider = providers.find(p => p.name === 'openai');
      openaiProvider.stats.availability = 0.1;
      openaiProvider.stats.errorRate = 0.5;

      const result = await router.route({
        task: 'Debug this code',
        taskType: TaskType.CODING,
      });

      expect(result.provider).not.toBe('openai');
    });
  });

  describe('executeWithFallback()', () => {
    it('should execute with fallback on failure', async () => {
    let attempts = 0;
    const executor = async (provider: string, model: string) => {
      attempts++;
      if (provider === 'openai') {
        throw new Error('OpenAI provider failed');
      }
      return { success: true, provider, model };
    };

    const result = await router.executeWithFallback(
      {
        task: 'Generate code',
        taskType: TaskType.CODING,
      },
      executor
    );

    expect(result.success).toBe(true);
    expect(result.provider).not.toBe('openai');
  });

  it('should fail after max retries', async () => {
    const executor = async () => {
      throw new Error('All providers failed');
    };

    await expect(
      router.executeWithFallback(
        {
          task: 'Test task',
        },
        executor
      )
    ).rejects.toThrow('All providers failed');
  });
});

  describe('CostOptimizedStrategy', () => {
    let strategy: CostOptimizedStrategy;

    beforeEach(() => {
      strategy = new CostOptimizedStrategy();
    });

    it('should select the cheapest provider', async () => {
      const result = await strategy.select(
        {
          task: 'Write a long article about AI',
          messages: [
            { role: 'user', content: 'Write a long article about AI' },
          { role: 'assistant', content: 'I will write the article...' },
          ],
        },
        providers
      );

      // DeepSeek 应该最便宜
      expect(result.name).toBe('deepseek');
    });
  });

  describe('PerformanceStrategy', () => {
    let strategy: PerformanceStrategy;

    beforeEach(() => {
      strategy = new PerformanceStrategy();
    });

    it('should select the best performing provider', async () => {
      const result = await strategy.select(
        {
          task: 'Analyze this data',
        },
        providers
      );

      // Anthropic 应该性能最好
      expect(result.name).toBe('anthropic');
    });
  });

  describe('RoundRobinStrategy', () => {
    let strategy: RoundRobinStrategy;

    beforeEach(() => {
      strategy = new RoundRobinStrategy();
    });

    it('should rotate through providers', async () => {
      // First call
      const result1 = await strategy.select({ task: 'Task 1' }, providers);
      expect(result1.name).toBe('openai');

      // Second call
      const result2 = await strategy.select({ task: 'Task 2' }, providers);
      expect(result2.name).toBe('deepseek');

      // Third call
      const result3 = await strategy.select({ task: 'Task 3' }, providers);
      expect(result3.name).toBe('anthropic');

      // Fourth call should cycle back
      const result4 = await strategy.select({ task: 'Task 4' }, providers);
      expect(result4.name).toBe('openai');
    });
  });

  describe('SmartRoutingStrategy', () => {
    let strategy: SmartRoutingStrategy;

    beforeEach(() => {
      strategy = new SmartRoutingStrategy();
    });

    it('should consider multiple factors', async () => {
      const result = await strategy.select(
        {
          task: 'Debug this code error',
          taskType: TaskType.CODING,
          messages: [
            { role: 'user', content: 'Debug this code error' },
          ],
          tools: [
            {
              name: 'code_analyzer',
              description: 'Analyze code for bugs',
              parameters: {},
            },
          ],
          constraints: {
            maxCost: 0.05,
            maxLatency: 2000,
          },
        },
        providers
      );

      expect(result.name).toBeDefined();
      // 应该选择平衡了成本、性能和任务类型的提供商
    });
  });
});
