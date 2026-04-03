/**
 * 性能优化策略
 * 选择响应最快、可用性最高的提供商
 */

import { RoutingStrategy } from './base';
import { ProviderInfo, RoutingContext } from '../types';

export class PerformanceStrategy implements RoutingStrategy {
  name = 'performance';
  weight = 1;

  async select(
    context: RoutingContext,
    providers: ProviderInfo[]
  ): Promise<ProviderInfo> {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // 计算每个提供商的性能分数
    const metrics = providers.map(p => ({
      provider: p,
      score: this.calculatePerformanceScore(p),
    }));

    // 选择性能最好的
    metrics.sort((a, b) => b.score - a.score);

    return metrics[0].provider;
  }

  /**
   * 计算性能分数
   * 考虑因素：
   * - 平均响应时间（越低越好）
   * - 可用性（越高越好）
   * - 上下文长度（越大越好）
   * - 错误率（越低越好）
   */
  private calculatePerformanceScore(provider: ProviderInfo): number {
    // 响应时间分数：0-100，响应时间越低分数越高
    const responseTimeScore = Math.max(0, 100 - provider.stats.avgResponseTime / 10);

    // 可用性分数：0-100
    const availabilityScore = provider.stats.availability * 100;

    // 错误率分数：0-100，错误率越低分数越高
    const errorScore = (1 - provider.stats.errorRate) * 100;

    // 能力分数：基于能力数量
    const capabilityScore = Math.min(100, provider.capabilities.length * 20);

    // 综合评分
    return (
      responseTimeScore * 0.3 +
      availabilityScore * 0.3 +
      errorScore * 0.2 +
      capabilityScore * 0.2
    );
  }
}
