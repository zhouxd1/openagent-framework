/**
 * 健康检查
 * 监控提供商的健康状态
 */

import { ProviderInfo, HealthStatus, HealthCheckConfig } from './types';

export class HealthChecker {
  private cache: Map<string, HealthStatus>;
  private checkInterval: number;
  private timeout: number;
  private retries: number;

  constructor(config?: HealthCheckConfig) {
    this.cache = new Map();
    this.checkInterval = config?.interval || 60000; // 默认 1 分钟
    this.timeout = config?.timeout || 5000;         // 默认 5 秒超时
    this.retries = config?.retries || 2;           // 默认重试 2 次
  }

  /**
   * 检查提供商健康状态
   */
  async check(provider: ProviderInfo): Promise<boolean> {
    const cached = this.cache.get(provider.name);

    // 使用缓存
    if (cached && Date.now() - cached.timestamp < this.checkInterval) {
      return cached.isHealthy;
    }

    // 执行健康检查
    try {
      const isHealthy = await this.performCheckWithRetry(provider);
      
      this.cache.set(provider.name, {
        isHealthy,
        timestamp: Date.now(),
      });

      return isHealthy;
    } catch (error) {
      // 检查失败，标记为不健康
      this.cache.set(provider.name, {
        isHealthy: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  /**
   * 带重试的健康检查
   */
  private async performCheckWithRetry(provider: ProviderInfo): Promise<boolean> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.retries; i++) {
      try {
        return await this.performCheck(provider);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // 等待一段时间后重试
        if (i < this.retries - 1) {
          await this.sleep(1000 * (i + 1));
        }
      }
    }

    throw lastError;
  }

  /**
   * 执行实际的健康检查
   */
  private async performCheck(provider: ProviderInfo): Promise<boolean> {
    // 简单的检查方式：检查最近错误率
    if (provider.stats.errorRate > 0.5) {
      return false;
    }

    // 检查最近一次检查时间
    if (provider.stats.lastChecked) {
      const timeSinceLastCheck = Date.now() - new Date(provider.stats.lastChecked).getTime();
      // 如果超过 5 分钟未检查，认为可能不健康
      if (timeSinceLastCheck > 300000) {
        return false;
      }
    }

    // 检查可用性
    if (provider.stats.availability < 0.8) {
      return false;
    }

    // 实际场景中，这里应该发送一个简单的测试请求
    // 例如：await this.pingProvider(provider);
    
    return true;
  }

  /**
   * 获取提供商的健康状态
   */
  getHealthStatus(providerName: string): HealthStatus | undefined {
    return this.cache.get(providerName);
  }

  /**
   * 清除缓存
   */
  clearCache(providerName?: string): void {
    if (providerName) {
      this.cache.delete(providerName);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 强制重新检查
   */
  async forceCheck(provider: ProviderInfo): Promise<boolean> {
    this.clearCache(provider.name);
    return this.check(provider);
  }

  /**
   * 批量检查
   */
  async checkAll(providers: ProviderInfo[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    await Promise.all(
      providers.map(async p => {
        const isHealthy = await this.check(p);
        results.set(p.name, isHealthy);
      })
    );

    return results;
  }

  /**
   * 辅助函数：休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
