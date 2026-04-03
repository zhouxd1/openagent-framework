/**
 * 成本优化策略
 * 选择成本最低的提供商
 */

import { RoutingStrategy } from './base';
import { ProviderInfo, RoutingContext } from '../types';

export class CostOptimizedStrategy implements RoutingStrategy {
  name = 'cost-optimized';
  weight = 1;

  async select(
    context: RoutingContext,
    providers: ProviderInfo[]
  ): Promise<ProviderInfo> {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // 计算每个提供商的预估成本
    const costs = providers.map(p => ({
      provider: p,
      cost: this.estimateCost(context, p),
    }));

    // 选择成本最低的
    costs.sort((a, b) => a.cost - b.cost);

    return costs[0].provider;
  }

  /**
   * 估算成本
   */
  private estimateCost(
    context: RoutingContext,
    provider: ProviderInfo
  ): number {
    const inputTokens = this.estimateInputTokens(context);
    const outputTokens = this.estimateOutputTokens(context);

    return (
      (inputTokens * provider.pricing.input) / 1000 +
      (outputTokens * provider.pricing.output) / 1000
    );
  }

  /**
   * 估算输入 tokens
   */
  private estimateInputTokens(context: RoutingContext): number {
    let totalTokens = 0;

    // 任务描述
    totalTokens += this.countTokens(context.task);

    // 消息历史
    if (context.messages) {
      for (const msg of context.messages) {
        totalTokens += this.countTokens(msg.content);
      }
    }

    // 工具定义
    if (context.tools) {
      for (const tool of context.tools) {
        totalTokens += this.countTokens(tool.description);
        totalTokens += this.countTokens(JSON.stringify(tool.parameters));
      }
    }

    return totalTokens;
  }

  /**
   * 估算输出 tokens
   */
  private estimateOutputTokens(context: RoutingContext): number {
    // 简单估算：输入的 50%
    return this.estimateInputTokens(context) * 0.5;
  }

  /**
   * 计算 token 数量（简单估算）
   * 英文约 4 字符 = 1 token
   * 中文约 2 字符 = 1 token
   */
  private countTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }
}
