/**
 * 提供商池管理
 * 発理可用提供商、维护提供商状态
 */

import { ProviderInfo, ProviderStats, PoolConfig, HealthStatus } from './types';
import { HealthChecker } from './health-check';

export class ProviderPool {
  private providers: Map<string, ProviderInfo>;
  private healthChecker: HealthChecker;

  constructor(config?: PoolConfig) {
    this.providers = new Map();
    this.healthChecker = new HealthChecker(config?.healthCheck);
  }

  /**
   * 注册提供商
   */
  register(provider: ProviderInfo): void {
    // 验证提供商信息
    if (!provider.name) {
      throw new Error('Provider name is required');
    }
    if (!provider.models || provider.models.length === 0) {
      throw new Error('Provider must have at least one model');
    }

    this.providers.set(provider.name, provider);
  }

  /**
   * 批量注册提供商
   */
  registerAll(providers: ProviderInfo[]): void {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  /**
   * 获取所有提供商
   */
  getAll(): ProviderInfo[] {
    return Array.from(this.providers.values());
  }

  /**
   * 获取可用提供商（通过健康检查）
   */
  async getAvailable(): Promise<ProviderInfo[]> {
    const all = this.getAll();
    
    // 并行检查所有提供商的健康状态
    const healthChecks = await Promise.all(
      all.map(async p => ({
        provider: p,
        isHealthy: await this.healthChecker.check(p),
      }))
    );

    // 过滤健康的提供商
    return healthChecks
      .filter(h => h.isHealthy)
      .map(h => h.provider);
  }

  /**
   * 获取指定提供商
   */
  get(name: string): ProviderInfo | undefined {
    return this.providers.get(name);
  }

  /**
   * 更新提供商状态
   */
  updateStats(provider: string, stats: Partial<ProviderStats>): void {
    const info = this.providers.get(provider);
    if (info) {
      Object.assign(info.stats, stats);
    }
  }

  /**
   * 记录请求结果（用于更新统计信息）
   */
  recordRequest(
    provider: string,
    success: boolean,
    responseTime: number
  ): void {
    const info = this.providers.get(provider);
    if (!info) return;

    // 更新总请求数
    info.stats.totalRequests++;

    // 更新平均响应时间（移动平均)
    const alpha = 0.1; // 平滑因子
    info.stats.avgResponseTime = 
      info.stats.avgResponseTime * (1 - alpha) + responseTime * alpha;

    
    // 更新错误率
    if (!success) {
      const errorRateAlpha = 0.1;
      info.stats.errorRate = 
        info.stats.errorRate * (1 - errorRateAlpha) + errorRateAlpha;
    } else {
      // 成功时降低错误率
      info.stats.errorRate = Math.max(0, info.stats.errorRate - 0.01);
    }
    
    // 更新可用性
    const recentSuccessRate = success ? 1 : 0;
    info.stats.availability = 
      info.stats.availability * 0.95 + recentSuccessRate * 0.05;
    
    // 更新最后检查时间
    info.stats.lastChecked = new Date();
  }

  /**
   * 清除所有提供商
   */
  clear(): void {
    this.providers.clear();
  }
}
