/**
 * 智能路由策略（混合策略)
 * 综合考虑任务类型、成本、性能等多个因素
 */

import { RoutingStrategy } from './base';
import { CostOptimizedStrategy } from './cost-optimized';
import { PerformanceStrategy } from './performance';
import { TaskBasedStrategy } from '../rules/task-based';
import { CapabilityStrategy } from '../rules/capability';
import { ProviderInfo, RoutingContext } from '../types';

export interface WeightedStrategy {
  strategy: RoutingStrategy;
  weight: number;
}

export class SmartRoutingStrategy implements RoutingStrategy {
  name = 'smart';
  weight = 1;

  private strategies: WeightedStrategy[];

  constructor() {
    // 初始化加权策略组合
    this.strategies = [
      { strategy: new TaskBasedStrategy(), weight: 0.35 },
      { strategy: new CostOptimizedStrategy(), weight: 0.25 },
      { strategy: new PerformanceStrategy(), weight: 0.25 },
      { strategy: new CapabilityStrategy(), weight: 0.15 },
    ];
  }

  async select(
    context: RoutingContext,
    providers: ProviderInfo[]
  ): Promise<ProviderInfo> {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // 如果只有一个提供商，直接返回
    if (providers.length === 1) {
      return providers[0];
    }

    // 计算每个提供商的综合得分
    const scores = await Promise.all(
      providers.map(async p => ({
        provider: p,
        score: await this.calculateScore(context, p, providers),
      }))
    );

    // 按分数排序
    scores.sort((a, b) => b.score - a.score);

    return scores[0].provider;
  }

  /**
   * 计算提供商的综合得分
   */
  private async calculateScore(
    context: RoutingContext,
    provider: ProviderInfo,
    allProviders: ProviderInfo[]
  ): Promise<number> {
    let totalScore = 0;

    for (const { strategy, weight } of this.strategies) {
      try {
        // 获取该策略的选择结果
        const selected = await strategy.select(context, allProviders);
        
        // 如果当前提供商被该策略选中，增加分数
        if (selected.name === provider.name) {
          totalScore += weight * 100;
        }
      } catch (error) {
        // 策略执行失败，跳过
        console.warn(`Strategy ${strategy.name} failed:`, error);
      }
    }

    return totalScore;
  }

  /**
   * 添加自定义策略
   */
  addStrategy(strategy: RoutingStrategy, weight: number): void {
    this.strategies.push({ strategy, weight });
    this.normalizeWeights();
  }

  /**
   * 移除策略
   */
  removeStrategy(name: string): boolean {
    const index = this.strategies.findIndex(s => s.strategy.name === name);
    if (index !== -1) {
      this.strategies.splice(index, 1);
      this.normalizeWeights();
      return true;
    }
    return false;
  }

  /**
   * 归一化权重
   */
  private normalizeWeights(): void {
    const totalWeight = this.strategies.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight > 0) {
      this.strategies.forEach(s => {
        s.weight = s.weight / totalWeight;
      });
    }
  }

  /**
   * 获取所有策略
   */
  getStrategies(): WeightedStrategy[] {
    return [...this.strategies];
  }
}
