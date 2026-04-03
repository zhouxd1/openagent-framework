/**
 * Active span context
 */
export interface ActiveContext {
  traceId: string;
  spanId: string;
}

/**
 * ContextManager manages the active span context
 * Uses a stack-based approach to handle nested spans
 */
export class ContextManager {
  private stack: ActiveContext[] = [];

  /**
   * Get the currently active context
   */
  getActive(): ActiveContext | undefined {
    if (this.stack.length === 0) {
      return undefined;
    }
    return this.stack[this.stack.length - 1];
  }

  /**
   * Set a new active context
   * Pushes onto the stack
   */
  setActive(context: ActiveContext): void {
    this.stack.push(context);
  }

  /**
   * Restore the previous context
   * Pops from the stack
   */
  restore(): void {
    if (this.stack.length > 0) {
      this.stack.pop();
    }
  }

  /**
   * Clear all contexts
   */
  clear(): void {
    this.stack = [];
  }

  /**
   * Get the depth of the current context stack
   */
  get depth(): number {
    return this.stack.length;
  }
}
