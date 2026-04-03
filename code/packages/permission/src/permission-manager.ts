/**
 * @fileoverview Main permission manager for OpenAgent Framework
 * @module @openagent/permission/permission-manager
 */

import {
  PermissionConfig,
  PermissionContext,
  PermissionResult,
  Role,
  User,
  Resource,
} from './types';
import { RoleManager } from './role-manager';
import { PolicyEngine, PolicyEngineConfig } from './policy-engine';
import { AuditLogger } from './audit-logger';
import { ResourceManager } from './resource-manager';

/**
 * Permission manager - main entry point for the permission system
 * 
 * @example
 * ```typescript
 * const manager = new PermissionManager({
 *   database: { type: 'postgresql', url: process.env.DATABASE_URL }
 * });
 * 
 * // Create role
 * const adminRole = await manager.createRole({
 *   name: 'admin',
 *   permissions: [{ resource: 'tool:*', action: '*', effect: 'allow' }]
 * });
 * 
 * // Create user
 * const user = await manager.createUser({
 *   email: 'admin@example.com',
 *   roles: [adminRole.id]
 * });
 * 
 * // Check permission
 * const result = await manager.checkPermission(user.id, 'tool:shell', 'execute');
 * console.log(result.allowed); // true
 * ```
 */
export class PermissionManager {
  private roleManager: RoleManager;
  private policyEngine: PolicyEngine;
  private auditLogger: AuditLogger;
  private resourceManager: ResourceManager;
  private config: PermissionConfig;

  constructor(config: PermissionConfig) {
    this.config = config;
    this.roleManager = new RoleManager(config);
    
    // Convert cache config to policy engine config
    const policyEngineConfig: PolicyEngineConfig | undefined = config.cache ? {
      enableCache: config.cache.enabled,
      cacheTTL: config.cache.ttl,
    } : undefined;
    
    this.policyEngine = new PolicyEngine(policyEngineConfig);
    this.auditLogger = new AuditLogger(config.audit);
    this.resourceManager = new ResourceManager(config);
  }

  /**
   * Check if a user has permission to perform an action on a resource
   * 
   * @param userId - User ID
   * @param resource - Resource identifier (e.g., tool:shell, file:/data/*)
   * @param action - Action to perform (e.g., read, write, execute)
   * @param context - Optional context for permission check
   * @returns Permission result indicating if allowed and reason if denied
   * 
   * @example
   * ```typescript
   * const result = await manager.checkPermission(
   *   'user_123',
   *   'tool:shell',
   *   'execute',
   *   { ip: '192.168.1.1' }
   * );
   * ```
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string,
    context?: PermissionContext
  ): Promise<PermissionResult> {
    // 1. Get user
    const user = await this.roleManager.getUser(userId);
    if (!user) {
      await this.auditLogger.log({
        userId,
        action,
        resource,
        result: 'deny',
        reason: 'User not found',
        ip: context?.ip,
        userAgent: context?.userAgent,
      });

      return { allowed: false, reason: 'User not found' };
    }

    // 2. Collect all permissions (including inherited roles)
    const permissions = await this.roleManager.getAllPermissions(user.roles);

    // 3. Evaluate permissions using policy engine
    const result = await this.policyEngine.evaluate(
      permissions,
      resource,
      action,
      { user, ...context }
    );

    // 4. Log audit trail
    await this.auditLogger.log({
      userId,
      action,
      resource,
      result: result.allowed ? 'allow' : 'deny',
      reason: result.reason,
      ip: context?.ip,
      userAgent: context?.userAgent,
    });

    return result;
  }

  /**
   * Create a new role
   * 
   * @param roleData - Role data without id and timestamps
   * @returns Created role
   * 
   * @example
   * ```typescript
   * const role = await manager.createRole({
   *   name: 'editor',
   *   permissions: [
   *     { resource: 'file:*', action: 'read,write', effect: 'allow' }
   *   ]
   * });
   * ```
   */
  async createRole(
    roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Role> {
    const role = await this.roleManager.createRole(roleData);

    await this.auditLogger.log({
      userId: 'system',
      action: 'create_role',
      resource: `role:${role.id}`,
      result: 'allow',
      metadata: { roleName: role.name },
    });

    return role;
  }

  /**
   * Create a new user
   * 
   * @param userData - User data without id and timestamps
   * @returns Created user
   * 
   * @example
   * ```typescript
   * const user = await manager.createUser({
   *   email: 'user@example.com',
   *   name: 'John Doe',
   *   roles: ['role_user']
   * });
   * ```
   */
  async createUser(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<User> {
    const user = await this.roleManager.createUser(userData);

    await this.auditLogger.log({
      userId: 'system',
      action: 'create_user',
      resource: `user:${user.id}`,
      result: 'allow',
      metadata: { email: user.email, name: user.name },
    });

    return user;
  }

  /**
   * Grant a role to a user
   * 
   * @param userId - User ID
   * @param roleId - Role ID to grant
   * @param grantedBy - User ID of the granter
   * 
   * @example
   * ```typescript
   * await manager.grantRole('user_123', 'role_admin', 'admin_456');
   * ```
   */
  async grantRole(
    userId: string,
    roleId: string,
    grantedBy: string
  ): Promise<void> {
    await this.roleManager.assignRole(userId, roleId);

    await this.auditLogger.log({
      userId: grantedBy,
      action: 'grant_role',
      resource: `user:${userId}:role:${roleId}`,
      result: 'allow',
    });
  }

  /**
   * Revoke a role from a user
   * 
   * @param userId - User ID
   * @param roleId - Role ID to revoke
   * @param revokedBy - User ID of the revoker
   * 
   * @example
   * ```typescript
   * await manager.revokeRole('user_123', 'role_admin', 'admin_456');
   * ```
   */
  async revokeRole(
    userId: string,
    roleId: string,
    revokedBy: string
  ): Promise<void> {
    await this.roleManager.removeRole(userId, roleId);

    await this.auditLogger.log({
      userId: revokedBy,
      action: 'revoke_role',
      resource: `user:${userId}:role:${roleId}`,
      result: 'allow',
    });
  }

  /**
   * Get user by ID
   * 
   * @param userId - User ID
   * @returns User or undefined
   */
  async getUser(userId: string): Promise<User | undefined> {
    return await this.roleManager.getUser(userId);
  }

  /**
   * Get user by email
   * 
   * @param email - User email
   * @returns User or undefined
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    return await this.roleManager.getUserByEmail(email);
  }

  /**
   * Get role by ID
   * 
   * @param roleId - Role ID
   * @returns Role or undefined
   */
  async getRole(roleId: string): Promise<Role | undefined> {
    return await this.roleManager.getRole(roleId);
  }

  /**
   * Get role by name
   * 
   * @param name - Role name
   * @returns Role or undefined
   */
  async getRoleByName(name: string): Promise<Role | undefined> {
    return await this.roleManager.getRoleByName(name);
  }

  /**
   * List all roles
   * 
   * @returns Array of roles
   */
  async listRoles(): Promise<Role[]> {
    return await this.roleManager.listRoles();
  }

  /**
   * Create a new resource
   * 
   * @param resourceData - Resource data without id and createdAt
   * @returns Created resource
   */
  async createResource(
    resourceData: Omit<Resource, 'id' | 'createdAt'>
  ): Promise<Resource> {
    const resource = await this.resourceManager.createResource(resourceData);

    await this.auditLogger.log({
      userId: 'system',
      action: 'create_resource',
      resource: `resource:${resource.id}`,
      result: 'allow',
      metadata: { type: resource.type, name: resource.name },
    });

    return resource;
  }

  /**
   * Get resource by ID
   * 
   * @param resourceId - Resource ID
   * @returns Resource or undefined
   */
  async getResource(resourceId: string): Promise<Resource | undefined> {
    return await this.resourceManager.getResource(resourceId);
  }

  /**
   * Query audit logs
   * 
   * @param filter - Filter criteria
   * @returns Array of audit logs
   */
  async queryAuditLogs(filter: Parameters<AuditLogger['query']>[0]) {
    return await this.auditLogger.query(filter);
  }

  /**
   * Export audit logs
   * 
   * @param format - Export format (csv or json)
   * @returns Exported data as string
   */
  async exportAuditLogs(format: 'csv' | 'json'): Promise<string> {
    return await this.auditLogger.export(format);
  }

  /**
   * Get audit log statistics
   * 
   * @returns Statistics object
   */
  async getAuditStats() {
    return await this.auditLogger.getStats();
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.policyEngine.clearCache();
  }

  /**
   * Shutdown permission manager
   */
  async shutdown(): Promise<void> {
    await this.auditLogger.shutdown();
  }
}
