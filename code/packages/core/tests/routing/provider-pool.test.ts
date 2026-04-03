/**
 * 提供商池管理测试
 */

import { describe, it, beforeEach } from 'vitest';
import { ProviderPool } from '../../src/routing';
import { ProviderInfo } from '../../src/routing/types';

describe('ProviderPool', () => {
  let pool: ProviderPool;
  let testProvider: ProviderInfo;

  beforeEach(() => {
    pool = new ProviderPool();
    
    testProvider = {
      name: 'test-provider',
      displayName: 'Test Provider',
      models: ['model-1', 'model-2'],
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
    };
  });

  it('should register a provider', () => {
    pool.register(testProvider);
    
    const provider = pool.get('test-provider');
    expect(provider).toBeDefined();
    expect(provider?.name).toBe('test-provider');
  });

  it('should register multiple providers', () => {
    const providers = [
      testProvider,
      {
        name: 'provider-2',
        displayName: 'Provider 2',
        models: ['model-3'],
        capabilities: ['chat'],
        pricing: { input: 0.005, output: 0.01 },
        limits: { maxTokens: 16000 },
        stats: {
          avgResponseTime: 800,
          availability: 0.90,
          totalRequests: 500,
          errorRate: 0.05,
          lastChecked: new Date(),
        },
      },
    ];

    pool.registerAll(providers);
    
    expect(pool.get('test-provider')).toBeDefined();
    expect(pool.get('provider-2')).toBeDefined();
  });

  it('should return undefined for non-existent provider', () => {
    const provider = pool.get('non-existent');
    expect(provider).toBeUndefined();
  });

  it('should record successful requests', () => {
    pool.register(testProvider);
    
    pool.recordRequest('test-provider', true, 500);
    
    const provider = pool.get('test-provider');
    expect(provider?.stats.totalRequests).toBe(1001);
    expect(provider?.stats.lastChecked).toBeInstanceOf(Date);
  });

  it('should record failed requests', () => {
    pool.register(testProvider);
    
    pool.recordRequest('test-provider', false, 0);
    
    const provider = pool.get('test-provider');
    // 错误率应该增加
    expect(provider?.stats.totalRequests).toBe(1001);
  });

  it('should update provider stats', () => {
    pool.register(testProvider);
    
    pool.updateStats('test-provider', {
      avgResponseTime: 600,
      availability: 0.97,
    });
    
    const provider = pool.get('test-provider');
    expect(provider?.stats.avgResponseTime).toBe(600);
    expect(provider?.stats.availability).toBe(0.97);
  });

  it('should get all providers', () => {
    const providers = [
      testProvider,
      {
        name: 'provider-2',
        displayName: 'Provider 2',
        models: ['model-3'],
        capabilities: ['chat'],
        pricing: { input: 0.005, output: 0.01 },
        limits: { maxTokens: 16000 },
        stats: {
          avgResponseTime: 800,
          availability: 0.90,
          totalRequests: 500,
          errorRate: 0.05,
          lastChecked: new Date(),
        },
      },
    ];

    pool.registerAll(providers);
    
    const allProviders = pool.getAll();
    expect(allProviders.length).toBe(2);
    expect(allProviders.map(p => p.name)).toContain('test-provider');
    expect(allProviders.map(p => p.name)).toContain('provider-2');
  });

  it('should clear all providers', () => {
    pool.register(testProvider);
    
    pool.clear();
    
    const allProviders = pool.getAll();
    expect(allProviders.length).toBe(0);
  });
});
