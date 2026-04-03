/**
 * 基于能力匹配的路由策略
 * 根据所需能力选择提供商
 */

import { RoutingStrategy } from '../strategies/base';
import { ProviderInfo, RoutingContext } from '../types';

export class CapabilityStrategy implements RoutingStrategy {
  name = 'capability';
  weight = 1;

  async select(
    context: RoutingContext,
    providers: ProviderInfo[]
  ): Promise<ProviderInfo> {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // 获取所需能力
    const requiredCapabilities = this.getRequiredCapabilities(context);

    if (requiredCapabilities.length === 0) {
      // 没有特定能力要求，返回第一个提供商
      return providers[0];
    }

    // 计算每个提供商的能力匹配分数
    const scores = providers.map(p => ({
      provider: p,
      score: this.calculateCapabilityScore(p, requiredCapabilities),
    }));

    // 选择匹配度最高的
    scores.sort((a, b) => b.score - a.score);

    return scores[0].provider;
  }

  /**
   * 获取所需的能力列表
   */
  private getRequiredCapabilities(context: RoutingContext): string[] {
    const capabilities: string[] = [];
    const task = context.task.toLowerCase();

    // 根据任务关键词推断
    if (/code|编程|代码/i.test(task)) {
      capabilities.push('code-generation', 'code-analysis');
    }
    if (/image|图片|图像/i.test(task)) {
      capabilities.push('vision', 'image-understanding');
    }
    if (/function|函数|tool|工具/i.test(task)) {
      capabilities.push('function-calling', 'tool-use');
    }
    if (/long|长|document|文档/i.test(task)) {
      capabilities.push('long-context');
    }
    if (/json|structured|结构化/i.test(task)) {
      capabilities.push('structured-output');
    }

    // 如果有工具定义，需要 function-calling 能力
    if (context.tools && context.tools.length > 0) {
      capabilities.push('function-calling');
    }

    return capabilities;
  }

  /**
   * 计算能力匹配分数
   */
  private calculateCapabilityScore(
    provider: ProviderInfo,
    requiredCapabilities: string[]
  ): number {
    let matchCount = 0;

    for (const required of requiredCapabilities) {
      if (provider.capabilities.some(cap => 
        cap.toLowerCase().includes(required.toLowerCase()) ||
        required.toLowerCase().includes(cap.toLowerCase())
      )) {
        matchCount++;
      }
    }

    // 返回匹配比例
    return requiredCapabilities.length > 0 
      ? matchCount / requiredCapabilities.length 
      : 0;
  }
}
