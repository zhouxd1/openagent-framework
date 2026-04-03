/**
 * Permission Manager Implementation
 */

import { PrismaClient } from '@prisma/client';
import {
  IPermissionManager,
  PermissionCheck,
  PermissionResult,
  PermissionRule,
  PermissionManagerConfig,
  Metadata,
} from './interfaces';
import { Cache } from './cache';
import { Logger, createLogger } from './logger';

const logger = createLogger('PermissionManager');

export class PermissionManager implements IPermissionManager {
  private prisma: PrismaClient;
  private cache: Cache<PermissionRule[]>;
  private cacheEnabled: boolean;
  private logger: Logger;

  constructor(prisma?: PrismaClient, config?: PermissionManagerConfig) {
    this.prisma = prisma || new PrismaClient();
    this.cacheEnabled = config?.cacheEnabled ?? true;
    this.logger = logger;
    
    // Initialize cache with TTL and LRU
    this.cache = new Cache<PermissionRule[]>({
      maxSize: config?.maxCacheSize ?? 1000,
      ttl: config?.cacheTTL ?? 3600000, // 1 hour default
      cleanupInterval: 60000, // Cleanup every minute
    });
  }

  async check(request: PermissionCheck): Promise<PermissionResult> {
    this.logger.debug('Checking permission', {
      userId: request.userId,
      resource: request.resource,
      action: request.action,
    });

    const permissions = await this.getPermissions(request.userId);

    // Check for wildcard permissions (admin access)
    const hasAdmin = permissions.some(
      p => p.resource === '*' && p.action === 'admin'
    );
    if (hasAdmin) {
      this.logger.debug('Permission granted (admin)', {
        userId: request.userId,
        resource: request.resource,
      });
      return { allowed: true };
    }

    // Check for specific permission
    const matchingPermission = permissions.find(
      p =>
        (p.resource === request.resource || p.resource === '*') &&
        (p.action === request.action || p.action === 'admin')
    );

    if (!matchingPermission) {
      this.logger.debug('Permission denied', {
        userId: request.userId,
        resource: request.resource,
        action: request.action,
      });
      return {
        allowed: false,
        reason: `No permission found for ${request.resource}:${request.action}`,
      };
    }

    // Check conditions if present
    if (matchingPermission.conditions) {
      const conditionCheck = this.evaluateConditions(
        matchingPermission.conditions,
        request.context || {}
      );
      if (!conditionCheck) {
        this.logger.debug('Permission denied (conditions not met)', {
          userId: request.userId,
          resource: request.resource,
        });
        return {
          allowed: false,
          reason: 'Permission conditions not met',
          conditions: matchingPermission.conditions,
        };
      }
    }

    this.logger.debug('Permission granted', {
      userId: request.userId,
      resource: request.resource,
      action: request.action,
    });

    return { allowed: true };
  }

  async grant(userId: string, rule: PermissionRule): Promise<void> {
    this.logger.debug('Granting permission', {
      userId,
      resource: rule.resource,
      action: rule.action,
    });

    await this.prisma.permission.create({
      data: {
        userId,
        resource: rule.resource,
        action: rule.action,
        conditions: rule.conditions ? JSON.stringify(rule.conditions) : null,
      },
    });

    // Invalidate cache
    this.cache.delete(userId);

    this.logger.info('Permission granted', {
      userId,
      resource: rule.resource,
      action: rule.action,
    });
  }

  async revoke(userId: string, resource: string, action: string): Promise<void> {
    this.logger.debug('Revoking permission', {
      userId,
      resource,
      action,
    });

    await this.prisma.permission.deleteMany({
      where: {
        userId,
        resource,
        action,
      },
    });

    // Invalidate cache
    this.cache.delete(userId);

    this.logger.info('Permission revoked', {
      userId,
      resource,
      action,
    });
  }

  async getPermissions(userId: string): Promise<PermissionRule[]> {
    // Check cache first if enabled
    if (this.cacheEnabled) {
      const cached = this.cache.get(userId);
      if (cached) {
        this.logger.debug('Permissions retrieved from cache', { userId });
        return cached;
      }
    }

    const permissions = await this.prisma.permission.findMany({
      where: { userId },
    });

    const rules: PermissionRule[] = permissions.map(p => ({
      resource: p.resource,
      action: p.action as PermissionRule['action'],
      conditions: p.conditions ? JSON.parse(p.conditions) : undefined,
    }));

    // Cache the results if enabled
    if (this.cacheEnabled) {
      this.cache.set(userId, rules);
      this.logger.debug('Permissions cached', { userId, count: rules.length });
    }

    return rules;
  }

  /**
   * Get permissions with pagination (for users with many permissions)
   */
  async getPermissionsPaginated(
    userId: string,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<{ items: PermissionRule[]; nextCursor?: string; hasMore: boolean }> {
    const limit = options.limit ?? 100;

    this.logger.debug('Getting paginated permissions', {
      userId,
      limit,
      cursor: options.cursor,
    });

    const permissions = await this.prisma.permission.findMany({
      where: {
        userId,
        ...(options.cursor && {
          id: { gt: options.cursor },
        }),
      },
      take: limit + 1,
      orderBy: { createdAt: 'asc' },
    });

    const hasMore = permissions.length > limit;
    const items = hasMore ? permissions.slice(0, -1) : permissions;

    return {
      items: items.map(p => ({
        resource: p.resource,
        action: p.action as PermissionRule['action'],
        conditions: p.conditions ? JSON.parse(p.conditions) : undefined,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : undefined,
      hasMore,
    };
  }

  async createRole(name: string, permissions: PermissionRule[]): Promise<void> {
    this.logger.debug('Creating role', { name, permissionCount: permissions.length });

    await this.prisma.role.create({
      data: {
        name,
        permissions: JSON.stringify(
          permissions.map(p => ({
            resource: p.resource,
            action: p.action,
            conditions: p.conditions,
          }))
        ),
      },
    });

    this.logger.info('Role created', { name });
  }

  async assignRole(userId: string, roleName: string): Promise<void> {
    this.logger.debug('Assigning role', { userId, roleName });

    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    await this.prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
      },
    });

    // Get role permissions and grant them
    const permissions = JSON.parse(role.permissions) as PermissionRule[];
    for (const permission of permissions) {
      await this.grant(userId, permission);
    }

    this.logger.info('Role assigned', { userId, roleName });
  }

  async removeRole(userId: string, roleName: string): Promise<void> {
    this.logger.debug('Removing role', { userId, roleName });

    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: role.id,
      },
    });

    // Invalidate cache
    this.cache.delete(userId);

    this.logger.info('Role removed', { userId, roleName });
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(
    conditions: Metadata,
    context: Metadata
  ): boolean {
    // Simple condition evaluation
    // Can be extended to support more complex logic
    for (const [key, value] of Object.entries(conditions)) {
      if (context[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clear the permission cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Permission cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.cache.getStats().maxSize,
    };
  }

  /**
   * Destroy the permission manager and cleanup resources
   */
  destroy(): void {
    this.cache.destroy();
    this.logger.debug('Permission manager destroyed');
  }
}
