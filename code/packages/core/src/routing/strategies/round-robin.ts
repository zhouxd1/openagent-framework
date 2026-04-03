/**
 * 轮询负载均衡策略
 * 按顺序依次选择提供商
 */

import { RoutingStrategy } from './base';
import { ProviderInfo, RoutingContext } from '../types';

export class RoundRobinStrategy implements RoutingStrategy {
  name = 'round-robin';
  weight = 1;
  
  private currentIndex = 0;

  async select(
    context: RoutingContext,
    providers: ProviderInfo[]
  ): Promise<ProviderInfo> {
    if (providers.length === 0) {
      throw new Error('No providers available');
    }

    // 轮询选择
    const selected = providers[this.currentIndex % providers.length];
    
    // 更新索引
    this.currentIndex = (this.currentIndex + 1) % providers.length;

    return selected;
  }

  /**
   * 重置索引
   */
  reset(): void {
    this.currentIndex = 0;
  }
}
