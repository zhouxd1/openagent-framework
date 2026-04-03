/**
 * @fileoverview Role manager for RBAC implementation
 * @module @openagent/permission/role-manager
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Role,
  User,
  Permission,
  RoleManagerConfig,
} from './types';

/**
 * In-memory storage for roles and users (can be replaced with database)
 */
class InMemoryStore {
  private roles: Map<string, Role> = new Map();
  private users: Map<string, User> = new Map();
  private userRoles: Map<string, Set<string>> = new Map();

  getRole(id: string): Role | undefined {
    return this.roles.get(id);
  }

  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  saveRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  deleteRole(id: string): void {
    this.roles.delete(id);
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  saveUser(user: User): void {
    this.users.set(user.id, user);
  }

  deleteUser(id: string): void {
    this.users.delete(id);
    this.userRoles.delete(id);
  }

  assignRole(userId: string, roleId: string): void {
    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, new Set());
    }
    this.userRoles.get(userId)!.add(roleId);
  }

  removeRole(userId: string, roleId: string): void {
    this.userRoles.get(userId)?.delete(roleId);
  }

  getUserRoles(userId: string): string[] {
    return Array.from(this.userRoles.get(userId) || []);
  }
}

/**
 * Role manager for managing roles and users
 */
export class RoleManager {
  private store: InMemoryStore;

  constructor(config: RoleManagerConfig) {
    this.store = new InMemoryStore();
    this.initializeDefaultRoles();
  }

  /**
   * Initialize default roles
   */
  private initializeDefaultRoles(): void {
    // Create default admin role
    const adminRole: Role = {
      id: 'role_admin',
      name: 'admin',
      description: 'Administrator with full access',
      permissions: [
        {
          id: 'perm_admin_all',
          resource: '*',
          action: '*',
          effect: 'allow',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.saveRole(adminRole);

    // Create default user role
    const userRole: Role = {
      id: 'role_user',
      name: 'user',
      description: 'Standard user with limited access',
      permissions: [
        {
          id: 'perm_user_read',
          resource: 'tool:file',
          action: 'read',
          effect: 'allow',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.saveRole(userRole);
  }

  /**
   * Create a new role
   * @param roleData - Role data without id and timestamps
   * @returns Created role
   */
  async createRole(
    roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Role> {
    const role: Role = {
      ...roleData,
      id: `role_${uuidv4()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.saveRole(role);
    return role;
  }

  /**
   * Get role by ID
   * @param roleId - Role ID
   * @returns Role or undefined
   */
  async getRole(roleId: string): Promise<Role | undefined> {
    return this.store.getRole(roleId);
  }

  /**
   * Get role by name
   * @param name - Role name
   * @returns Role or undefined
   */
  async getRoleByName(name: string): Promise<Role | undefined> {
    const roles = this.store.getAllRoles();
    return roles.find(r => r.name === name);
  }

  /**
   * Update role
   * @param roleId - Role ID
   * @param updates - Partial role data
   * @returns Updated role
   */
  async updateRole(
    roleId: string,
    updates: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Role | undefined> {
    const role = this.store.getRole(roleId);
    if (!role) return undefined;

    const updatedRole: Role = {
      ...role,
      ...updates,
      updatedAt: new Date(),
    };

    this.store.saveRole(updatedRole);
    return updatedRole;
  }

  /**
   * Delete role
   * @param roleId - Role ID
   */
  async deleteRole(roleId: string): Promise<void> {
    this.store.deleteRole(roleId);
  }

  /**
   * List all roles
   * @returns Array of roles
   */
  async listRoles(): Promise<Role[]> {
    return this.store.getAllRoles();
  }

  /**
   * Create a new user
   * @param userData - User data without id and timestamps
   * @returns Created user
   */
  async createUser(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<User> {
    const userId = `user_${uuidv4()}`;
    
    const user: User = {
      ...userData,
      id: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.saveUser(user);

    // Assign roles
    for (const roleId of userData.roles) {
      this.store.assignRole(userId, roleId);
    }

    return user;
  }

  /**
   * Get user by ID
   * @param userId - User ID
   * @returns User or undefined
   */
  async getUser(userId: string): Promise<User | undefined> {
    const user = this.store.getUser(userId);
    if (user) {
      // Update roles from userRoles map
      const roleIds = this.store.getUserRoles(userId);
      user.roles = roleIds;
    }
    return user;
  }

  /**
   * Get user by email
   * @param email - User email
   * @returns User or undefined
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = this.store.getUserByEmail(email);
    if (user) {
      const roleIds = this.store.getUserRoles(user.id);
      user.roles = roleIds;
    }
    return user;
  }

  /**
   * Update user
   * @param userId - User ID
   * @param updates - Partial user data
   * @returns Updated user
   */
  async updateUser(
    userId: string,
    updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<User | undefined> {
    const user = this.store.getUser(userId);
    if (!user) return undefined;

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    this.store.saveUser(updatedUser);
    return updatedUser;
  }

  /**
   * Delete user
   * @param userId - User ID
   */
  async deleteUser(userId: string): Promise<void> {
    this.store.deleteUser(userId);
  }

  /**
   * List all users
   * @returns Array of users
   */
  async listUsers(): Promise<User[]> {
    const users: User[] = [];
    // Note: In a real implementation, we'd iterate through all users
    // For now, this returns an empty array for simplicity
    return users;
  }

  /**
   * Assign role to user
   * @param userId - User ID
   * @param roleId - Role ID
   */
  async assignRole(userId: string, roleId: string): Promise<void> {
    this.store.assignRole(userId, roleId);
    
    // Update user's roles array
    const user = this.store.getUser(userId);
    if (user && !user.roles.includes(roleId)) {
      user.roles.push(roleId);
      user.updatedAt = new Date();
      this.store.saveUser(user);
    }
  }

  /**
   * Remove role from user
   * @param userId - User ID
   * @param roleId - Role ID
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    this.store.removeRole(userId, roleId);
    
    // Update user's roles array
    const user = this.store.getUser(userId);
    if (user) {
      user.roles = user.roles.filter(r => r !== roleId);
      user.updatedAt = new Date();
      this.store.saveUser(user);
    }
  }

  /**
   * Get all permissions for a list of roles (including inherited roles)
   * @param roleIds - Array of role IDs
   * @returns Array of permissions
   */
  async getAllPermissions(roleIds: string[]): Promise<Permission[]> {
    const permissions: Permission[] = [];
    const processedRoles = new Set<string>();

    const processRole = async (roleId: string) => {
      if (processedRoles.has(roleId)) return;
      processedRoles.add(roleId);

      const role = this.store.getRole(roleId);
      if (!role) return;

      // Add role's permissions
      permissions.push(...role.permissions);

      // Process inherited roles
      if (role.inherits) {
        for (const inheritedRoleId of role.inherits) {
          await processRole(inheritedRoleId);
        }
      }
    };

    for (const roleId of roleIds) {
      await processRole(roleId);
    }

    return permissions;
  }
}
