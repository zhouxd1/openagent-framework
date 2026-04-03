/**
 * 路由策略基础接口
 */

import { ProviderInfo, RoutingContext } from '../types';

/**
 * 路由策略接口
 */
export interface RoutingStrategy {
  /**
   * 策略名称
   */
  name: string;

  /**
   * 选择最佳提供商
   * @param context 路由上下文
   * @param providers 可用提供商列表
   * @returns 选中的提供商
   */
  select(
    context: RoutingContext,
    providers: ProviderInfo[]
  ): Promise<ProviderInfo>;

  /**
   * 策略权重（用于混合策略）
   */
  weight?: number;
}
