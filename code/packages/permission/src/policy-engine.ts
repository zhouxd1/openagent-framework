/**
 * @fileoverview Policy engine for permission evaluation
 * @module @openagent/permission/policy-engine
 */

import {
  Permission,
  Condition,
  EvaluationContext,
  PermissionResult,
  PolicyEngineConfig,
} from './types';

// Re-export PolicyEngineConfig for convenience
export { PolicyEngineConfig } from './types';

/**
 * Policy engine for evaluating permissions
 */
export class PolicyEngine {
  private policies: Map<string, Permission[]> = new Map();
  private cache: Map<string, { result: boolean; expiresAt: number }> = new Map();
  private config: PolicyEngineConfig;

  constructor(config?: PolicyEngineConfig) {
    this.config = config || { enableCache: true, cacheTTL: 60000 };
  }

  /**
   * Evaluate permissions for a resource and action
   * @param permissions - List of permissions to evaluate
   * @param resource - Resource identifier
   * @param action - Action to perform
   * @param context - Evaluation context
   * @returns Permission result
   */
  async evaluate(
    permissions: Permission[],
    resource: string,
    action: string,
    context: EvaluationContext
  ): Promise<PermissionResult> {
    // Check cache if enabled
    if (this.config.enableCache) {
      const cacheKey = this.getCacheKey(permissions, resource, action, context);
      const cached = this.cache.get(cacheKey);
      
      if (cached && cached.expiresAt > Date.now()) {
        return { allowed: cached.result };
      }
    }

    // 1. Match resource
    const matchedPermissions = permissions.filter(p =>
      this.matchResource(p.resource, resource)
    );

    if (matchedPermissions.length === 0) {
      return { allowed: false, reason: 'No matching permission' };
    }

    // 2. Match action
    const actionMatched = matchedPermissions.filter(p =>
      this.matchAction(p.action, action)
    );

    if (actionMatched.length === 0) {
      return { allowed: false, reason: 'Action not allowed' };
    }

    // 3. Check conditions and evaluate effects
    // Process deny permissions first (explicit deny takes precedence)
    const denyPermissions = actionMatched.filter(p => p.effect === 'deny');
    const allowPermissions = actionMatched.filter(p => p.effect === 'allow');

    // Check deny permissions
    for (const permission of denyPermissions) {
      const conditionsMet = await this.checkConditions(
        permission.conditions || [],
        context
      );

      if (conditionsMet) {
        const result = { allowed: false, reason: 'Explicitly denied' };
        this.updateCache(permissions, resource, action, context, false);
        return result;
      }
    }

    // Check allow permissions
    for (const permission of allowPermissions) {
      const conditionsMet = await this.checkConditions(
        permission.conditions || [],
        context
      );

      if (conditionsMet) {
        const result = { allowed: true };
        this.updateCache(permissions, resource, action, context, true);
        return result;
      }
    }

    // 4. Default deny
    return { allowed: false, reason: 'Default deny' };
  }

  /**
   * Match resource pattern against actual resource
   * @param pattern - Resource pattern (supports wildcards)
   * @param resource - Actual resource identifier
   * @returns True if matches
   */
  private matchResource(pattern: string, resource: string): boolean {
    // Exact match
    if (pattern === '*') return true;
    if (pattern === resource) return true;

    // Wildcard matching
    // Convert pattern to regex
    // Example: tool:* -> ^tool:.*$
    // Example: file:/data/* -> ^file:/data/.*$
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except *
      .replace(/\*/g, '.*'); // Replace * with .*

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(resource);
  }

  /**
   * Match action pattern against actual action
   * @param pattern - Action pattern (supports wildcards and comma-separated values)
   * @param action - Actual action
   * @returns True if matches
   */
  private matchAction(pattern: string, action: string): boolean {
    // Wildcard matches all
    if (pattern === '*') return true;
    
    // Exact match
    if (pattern === action) return true;

    // Comma-separated actions
    const actions = pattern.split(',').map(a => a.trim());
    return actions.includes(action);
  }

  /**
   * Check all conditions
   * @param conditions - List of conditions
   * @param context - Evaluation context
   * @returns True if all conditions are met
   */
  private async checkConditions(
    conditions: Condition[],
    context: EvaluationContext
  ): Promise<boolean> {
    if (conditions.length === 0) return true;

    for (const condition of conditions) {
      const met = await this.checkCondition(condition, context);
      if (!met) return false;
    }

    return true;
  }

  /**
   * Check a single condition
   * @param condition - Condition to check
   * @param context - Evaluation context
   * @returns True if condition is met
   */
  private async checkCondition(
    condition: Condition,
    context: EvaluationContext
  ): Promise<boolean> {
    switch (condition.type) {
      case 'time':
        return this.checkTimeCondition(condition, context);

      case 'ip':
        return this.checkIPCondition(condition, context);

      case 'attribute':
        return this.checkAttributeCondition(condition, context);

      case 'custom':
        return this.checkCustomCondition(condition, context);

      default:
        return false;
    }
  }

  /**
   * Check time-based condition
   * @param condition - Time condition
   * @param context - Evaluation context
   * @returns True if condition is met
   */
  private checkTimeCondition(
    condition: Condition,
    context: EvaluationContext
  ): boolean {
    const now = context.currentTime || new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    switch (condition.operator) {
      case 'between': {
        const [start, end] = condition.value as [number, number];
        return currentTimeInMinutes >= start && currentTimeInMinutes <= end;
      }

      case 'eq': {
        return currentTimeInMinutes === condition.value;
      }

      default:
        return false;
    }
  }

  /**
   * Check IP-based condition
   * @param condition - IP condition
   * @param context - Evaluation context
   * @returns True if condition is met
   */
  private checkIPCondition(
    condition: Condition,
    context: EvaluationContext
  ): boolean {
    if (!context.ip) return false;

    switch (condition.operator) {
      case 'in': {
        const allowedIPs = condition.value as string[];
        return allowedIPs.includes(context.ip);
      }

      case 'not_in': {
        const deniedIPs = condition.value as string[];
        return !deniedIPs.includes(context.ip);
      }

      case 'eq': {
        return context.ip === condition.value;
      }

      case 'ne': {
        return context.ip !== condition.value;
      }

      default:
        return false;
    }
  }

  /**
   * Check attribute-based condition
   * @param condition - Attribute condition
   * @param context - Evaluation context
   * @returns True if condition is met
   */
  private checkAttributeCondition(
    condition: Condition,
    context: EvaluationContext
  ): boolean {
    const { user } = context;
    const attributeName = condition.value.attribute;
    const attributeValue = user.attributes?.[attributeName];

    if (attributeValue === undefined) return false;

    switch (condition.operator) {
      case 'eq': {
        return attributeValue === condition.value.value;
      }

      case 'ne': {
        return attributeValue !== condition.value.value;
      }

      case 'in': {
        const allowedValues = condition.value.values as any[];
        return allowedValues.includes(attributeValue);
      }

      case 'not_in': {
        const deniedValues = condition.value.values as any[];
        return !deniedValues.includes(attributeValue);
      }

      default:
        return false;
    }
  }

  /**
   * Check custom condition
   * @param condition - Custom condition
   * @param context - Evaluation context
   * @returns True if condition is met
   */
  private checkCustomCondition(
    condition: Condition,
    context: EvaluationContext
  ): boolean {
    // Custom conditions can be extended by subclasses
    // For now, return false for unknown custom conditions
    return false;
  }

  /**
   * Generate cache key - includes context to prevent incorrect cache hits
   */
  private getCacheKey(
    permissions: Permission[],
    resource: string,
    action: string,
    context: EvaluationContext
  ): string {
    const permIds = permissions.map(p => p.id).sort().join(',');
    const userId = context.user.id;
    // Include context values that affect evaluation
    const timeKey = context.currentTime ? context.currentTime.getTime() : '';
    const ipKey = context.ip || '';
    const attrsKey = context.user.attributes 
      ? JSON.stringify(Object.entries(context.user.attributes).sort()) 
      : '';
    
    return `${userId}:${permIds}:${resource}:${action}:${timeKey}:${ipKey}:${attrsKey}`;
  }

  /**
   * Update cache
   */
  private updateCache(
    permissions: Permission[],
    resource: string,
    action: string,
    context: EvaluationContext,
    result: boolean
  ): void {
    if (!this.config.enableCache) return;

    const cacheKey = this.getCacheKey(permissions, resource, action, context);
    const ttl = this.config.cacheTTL || 60000;
    
    this.cache.set(cacheKey, {
      result,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Add policy
   */
  addPolicy(name: string, permissions: Permission[]): void {
    this.policies.set(name, permissions);
    this.clearCache();
  }

  /**
   * Get policy
   */
  getPolicy(name: string): Permission[] | undefined {
    return this.policies.get(name);
  }

  /**
   * Remove policy
   */
  removePolicy(name: string): void {
    this.policies.delete(name);
    this.clearCache();
  }
}
