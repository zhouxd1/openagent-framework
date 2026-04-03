/**
 * LLM 路由器
 * 智能选择最佳的 LLM 提供商
 */

import { 
  RouterConfig, 
  RoutingContext, 
  RoutingResult,
  ProviderInfo,
  Constraints,
} from './types';
import { ProviderPool } from './provider-pool';
import { FallbackRule } from './rules/fallback';
import { RoutingStrategy } from './strategies/base';
import { SmartRoutingStrategy } from './strategies/smart';
import { CostOptimizedStrategy } from './strategies/cost-optimized';
import { PerformanceStrategy } from './strategies/performance';
import { RoundRobinStrategy } from './strategies/round-robin';

export class LLMRouter {
  private strategies: Map<string, RoutingStrategy>;
  private providerPool: ProviderPool;
  private fallbackRule: FallbackRule;
  private config: RouterConfig;

  constructor(config?: RouterConfig) {
    this.config = {
      defaultStrategy: 'smart',
      fallbackEnabled: true,
      maxRetries: 3,
      ...config,
    };

    this.strategies = new Map();
    this.providerPool = new ProviderPool({ healthCheck: config?.healthCheck });
    this.fallbackRule = new FallbackRule();

    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies(): void {
    this.strategies.set('smart', new SmartRoutingStrategy());
    this.strategies.set('cost-optimized', new CostOptimizedStrategy());
    this.strategies.set('performance', new PerformanceStrategy());
    this.strategies.set('round-robin', new RoundRobinStrategy());
  }

  registerProvider(provider: ProviderInfo): void {
    this.providerPool.register(provider);
  }

  registerProviders(providers: ProviderInfo[]): void {
    this.providerPool.registerAll(providers);
  }

  addStrategy(name: string, strategy: RoutingStrategy): void {
    this.strategies.set(name, strategy);
  }

  removeStrategy(name: string): boolean {
    return this.strategies.delete(name);
  }

  getStrategy(name: string): RoutingStrategy | undefined {
    return this.strategies.get(name);
  }

  async route(context: RoutingContext): Promise<RoutingResult> {
    const availableProviders = await this.providerPool.getAvailable();

    if (availableProviders.length === 0) {
      throw new Error('No available providers');
    }

    const filteredProviders = this.applyConstraints(
      availableProviders,
      context.constraints
    );

    if (filteredProviders.length === 0) {
      throw new Error('No providers meet the constraints');
    }

    const strategyName = context.constraints?.preferredProviders?.[0] || 
      this.config.defaultStrategy || 
      'smart';
    const strategy = this.strategies.get(strategyName) || this.strategies.get('smart')!;

    const selectedProvider = await strategy.select(context, filteredProviders);

    const result: RoutingResult = {
      provider: selectedProvider.name,
      model: selectedProvider.models[0],
      reason: `Selected by ${strategy.name} strategy`,
      estimatedCost: this.estimateCost(context, selectedProvider),
    };

    if (this.config.fallbackEnabled) {
      result.fallback = this.fallbackRule.getFallbackChain(selectedProvider.name)[0];
    }

    return result;
  }

  async executeWithFallback<T>(
    context: RoutingContext,
    executor: (provider: string, model: string) => Promise<T>
  ): Promise<T> {
    const maxRetries = this.config.maxRetries || 3;
    let lastError: Error | null = null;
    const triedProviders = new Set<string>();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.route({
          ...context,
          constraints: {
            ...context.constraints,
            preferredProviders: context.constraints?.preferredProviders?.filter(
              p => !triedProviders.has(p)
            ),
          },
        });

        triedProviders.add(result.provider);

        const startTime = Date.now();
        const response = await executor(result.provider, result.model);
        const responseTime = Date.now() - startTime;

        this.providerPool.recordRequest(result.provider, true, responseTime);

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const currentProvider = Array.from(triedProviders).pop();
        if (currentProvider) {
          this.providerPool.recordRequest(currentProvider, false, 0);
        }

        console.warn(`Attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < maxRetries - 1) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private applyConstraints(
    providers: ProviderInfo[],
    constraints?: Constraints
  ): ProviderInfo[] {
    if (!constraints) return providers;

    let filtered = [...providers];

    if (constraints.preferredProviders && constraints.preferredProviders.length > 0) {
      filtered.sort((a, b) => {
        const aIndex = constraints.preferredProviders!.indexOf(a.name);
        const bIndex = constraints.preferredProviders!.indexOf(b.name);
        
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        
        return aIndex - bIndex;
      });
    }

    if (constraints.requiredCapabilities && constraints.requiredCapabilities.length > 0) {
      filtered = filtered.filter(p =>
        constraints.requiredCapabilities!.every(cap =>
          p.capabilities.some(c => 
            c.toLowerCase().includes(cap.toLowerCase())
          )
        )
      );
    }

    if (constraints.maxLatency) {
      filtered = filtered.filter(p => 
        p.stats.avgResponseTime <= constraints.maxLatency!
      );
    }

    return filtered;
  }

  private estimateCost(
    context: RoutingContext,
    provider: ProviderInfo
  ): number {
    const inputTokens = this.estimateInputTokens(context);
    const outputTokens = inputTokens * 0.5;

    return (
      (inputTokens * provider.pricing.input) / 1000 +
      (outputTokens * provider.pricing.output) / 1000
    );
  }

  private estimateInputTokens(context: RoutingContext): number {
    let total = this.countTokens(context.task);
    
    if (context.messages) {
      total += context.messages.reduce(
        (sum, msg) => sum + this.countTokens(msg.content),
        0
      );
    }

    return total;
  }

  private countTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }

  getProviderPool(): ProviderPool {
    return this.providerPool;
  }

  getFallbackRule(): FallbackRule {
    return this.fallbackRule;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
