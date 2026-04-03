/**
 * 回退规则
 * 定义提供商失败时的回退链
 */

export class FallbackRule {
  private fallbackChain: Map<string, string[]>;

  constructor() {
    // 定义默认回退链
    this.fallbackChain = new Map([
      ['openai', ['deepseek', 'zhipu', 'anthropic']],
      ['anthropic', ['openai', 'deepseek', 'zhipu']],
      ['deepseek', ['openai', 'zhipu', 'anthropic']],
      ['zhipu', ['deepseek', 'openai', 'anthropic']],
    ]);
  }

  /**
   * 获取回退提供商列表
   */
  getFallbackChain(provider: string): string[] {
    return this.fallbackChain.get(provider) || [];
  }

  /**
   * 添加自定义回退链
   */
  setFallbackChain(provider: string, fallbacks: string[]): void {
    this.fallbackChain.set(provider, fallbacks);
  }

  /**
   * 移除回退链
   */
  removeFallbackChain(provider: string): boolean {
    return this.fallbackChain.delete(provider);
  }

  /**
   * 获取所有回退链
   */
  getAllFallbackChains(): Map<string, string[]> {
    return new Map(this.fallbackChain);
  }
}
