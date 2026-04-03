/**
 * 路由系统入口
 * 导出所有路由相关的模块
 */

// 类型导出
export * from './types';

// 核心类
export { LLMRouter } from './router';
export { ProviderPool } from './provider-pool';
export { HealthChecker } from './health-check';

// 策略
export { RoutingStrategy } from './strategies/base';
export { CostOptimizedStrategy } from './strategies/cost-optimized';
export { PerformanceStrategy } from './strategies/performance';
export { RoundRobinStrategy } from './strategies/round-robin';
export { SmartRoutingStrategy } from './strategies/smart';

export { WeightedStrategy } from './strategies/smart';

// 规则
export { TaskBasedStrategy, TASK_PROVIDER_MAPPING } from './rules/task-based';
export { CapabilityStrategy } from './rules/capability';
export { FallbackRule } from './rules/fallback';
