/**
 * 策略测试
 */

import { describe, it, beforeEach } from 'vitest';
import { CostOptimizedStrategy, PerformanceStrategy, RoundRobinStrategy, SmartRoutingStrategy } from '../../src/routing';
import { ProviderInfo } from '../../src/routing/types';

describe('Routing Strategies', () => {
  let providers: ProviderInfo[];

  beforeEach(() => {
    providers = [
      {
        name: 'provider-a',
        displayName: 'Provider A',
        models: ['model-a-1'],
        capabilities: ['chat', 'code-generation'],
        pricing: { input: 0.01, output: 0.02 },
        limits: { maxTokens: 8000 },
        stats: {
          avgResponseTime: 500,
          availability: 0.95,
          totalRequests: 1000,
          errorRate: 0.02,
          lastChecked: new Date(),
        },
      },
      {
        name: 'provider-b',
        displayName: 'Provider B',
        models: ['model-b-1', 'model-b-2'],
        capabilities: ['chat', 'code-generation', 'vision'],
        pricing: { input: 0.005, output: 0.01 },
        limits: { maxTokens: 16000 },
        stats: {
          avgResponseTime: 1000,
          availability: 0.90,
          totalRequests: 500,
          errorRate: 0.05,
          lastChecked: new Date(),
        },
      },
      {
        name: 'provider-c',
        displayName: 'Provider C',
        models: ['model-c-1'],
        capabilities: ['chat', 'analysis'],
        pricing: { input: 0.02, output: 0.04 },
        limits: { maxTokens: 4000 },
        stats: {
          avgResponseTime: 300,
          availability: 0.99,
          totalRequests: 2000,
          errorRate: 0.01,
          lastChecked: new Date(),
        },
      },
    ];
  });

  describe('CostOptimizedStrategy', () => {
    let strategy: CostOptimizedStrategy;

    beforeEach(() => {
      strategy = new CostOptimizedStrategy();
    });

    it('should select the cheapest provider', async () => {
      const result = await strategy.select(
        {
          task: 'Write a short message',
        },
        providers
      );

      // Provider B should be cheapest (0.005 input, 0.01 output)
      expect(result.name).toBe('provider-b');
    });

    it('should estimate higher cost for longer tasks', async () => {
      const result = await strategy.select(
        {
          task: 'Write a very very long and detailed article about artificial intelligence',
          messages: [
            { role: 'user', content: 'Write a detailed article' },
            { role: 'assistant', content: 'I will write a comprehensive article...' },
          ],
        },
        providers
      );

      // Provider B should still be cheapest even for longer content
      expect(result.name).toBe('provider-b');
    });

    it('should throw error when no providers available', async () => {
      await expect(
        strategy.select({ task: 'Test' }, [])
      ).rejects.toThrow('No providers available');
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

      // Provider C should have best performance
      // (lowest avgResponseTime: 300, highest availability: 0.99, lowest errorRate: 0.01)
      expect(result.name).toBe('provider-c');
    });

    it('should consider multiple performance factors', async () => {
      const result = await strategy.select(
        {
          task: 'Quick chat',
        },
        providers
      );

      expect(result.name).toBeDefined();
      expect(providers).toContain(result);
    });
  });

  describe('RoundRobinStrategy', () => {
    let strategy: RoundRobinStrategy;

    beforeEach(() => {
      strategy = new RoundRobinStrategy();
    });

    it('should rotate through providers sequentially', async () => {
      // First selection
      const result1 = await strategy.select({ task: 'Task 1' }, providers);
      expect(result1.name).toBe('provider-a');

      // Second selection
      const result2 = await strategy.select({ task: 'Task 2' }, providers);
      expect(result2.name).toBe('provider-b');

      // Third selection
      const result3 = await strategy.select({ task: 'Task 3' }, providers);
      expect(result3.name).toBe('provider-c');

      // Fourth selection should cycle back
      const result4 = await strategy.select({ task: 'Task 4' }, providers);
      expect(result4.name).toBe('provider-a');
    });

    it('should handle single provider', async () => {
      const singleProvider = [providers[0]];
      
      const result1 = await strategy.select({ task: 'Task 1' }, singleProvider);
      expect(result1.name).toBe('provider-a');
      
      const result2 = await strategy.select({ task: 'Task 2' }, singleProvider);
      expect(result2.name).toBe('provider-a');
    });
  });

  describe('SmartRoutingStrategy', () => {
    let strategy: SmartRoutingStrategy;

    beforeEach(() => {
      strategy = new SmartRoutingStrategy();
    });

    it('should combine multiple strategies', async () => {
      const result = await strategy.select(
        {
          task: 'Debug this code',
          constraints: {
            maxCost: 0.05,
            maxLatency: 2000,
          },
        },
        providers
      );

      expect(result.name).toBeDefined();
      // Should select a provider that balances cost, performance, and task type
    });

  });
});
