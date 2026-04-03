/**
 * @fileoverview Tests for RoleManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RoleManager } from '../src/role-manager';
import { RoleManagerConfig } from '../src/types';

describe('RoleManager', () => {
  let manager: RoleManager;
  const config: RoleManagerConfig = {
    database: { type: 'sqlite', file: ':memory:' },
  };

  beforeEach(() => {
    manager = new RoleManager(config);
  });

  describe('createRole', () => {
    it('should create a role', async () => {
      const role = await manager.createRole({
        name: 'developer',
        description: 'Developer role',
        permissions: [
          {
            id: 'perm_dev_read',
            resource: 'tool:*',
            action: 'read,execute',
            effect: 'allow',
          },
        ],
      });

      expect(role.id).toBeDefined();
      expect(role.name).toBe('developer');
      expect(role.description).toBe('Developer role');
      expect(role.permissions).toHaveLength(1);
      expect(role.createdAt).toBeInstanceOf(Date);
      expect(role.updatedAt).toBeInstanceOf(Date);
    });

    it('should create role with inheritance', async () => {
      const baseRole = await manager.createRole({
        name: 'base',
        permissions: [
          {
            id: 'perm_base',
            resource: 'file:read',
            action: 'read',
            effect: 'allow',
          },
        ],
      });

      const derivedRole = await manager.createRole({
        name: 'derived',
        permissions: [
          {
            id: 'perm_derived',
            resource: 'file:write',
            action: 'write',
            effect: 'allow',
          },
        ],
        inherits: [baseRole.id],
      });

      expect(derivedRole.inherits).toContain(baseRole.id);
    });
  });

  describe('getRole', () => {
    it('should get role by ID', async () => {
      const created = await manager.createRole({
        name: 'test_role',
        permissions: [],
      });

      const found = await manager.getRole(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('test_role');
    });

    it('should return undefined for non-existent role', async () => {
      const role = await manager.getRole('nonexistent');
      expect(role).toBeUndefined();
    });
  });

  describe('getRoleByName', () => {
    it('should get role by name', async () => {
      await manager.createRole({
        name: 'unique_role',
        permissions: [],
      });

      const found = await manager.getRoleByName('unique_role');
      expect(found).toBeDefined();
      expect(found?.name).toBe('unique_role');
    });
  });

  describe('updateRole', () => {
    it('should update role', async () => {
      const role = await manager.createRole({
        name: 'updatable',
        permissions: [],
      });

      const updated = await manager.updateRole(role.id, {
        description: 'Updated description',
      });

      expect(updated?.description).toBe('Updated description');
    });

    it('should update role permissions', async () => {
      const role = await manager.createRole({
        name: 'permission_test',
        permissions: [],
      });

      const newPermissions = [
        {
          id: 'perm_new',
          resource: '*',
          action: '*',
          effect: 'allow' as const,
        },
      ];

      const updated = await manager.updateRole(role.id, {
        permissions: newPermissions,
      });

      expect(updated?.permissions).toHaveLength(1);
      expect(updated?.permissions[0].id).toBe('perm_new');
    });
  });

  describe('deleteRole', () => {
    it('should delete role', async () => {
      const role = await manager.createRole({
        name: 'deletable',
        permissions: [],
      });

      await manager.deleteRole(role.id);

      const found = await manager.getRole(role.id);
      expect(found).toBeUndefined();
    });
  });

  describe('listRoles', () => {
    it('should list all roles', async () => {
      await manager.createRole({ name: 'role1', permissions: [] });
      await manager.createRole({ name: 'role2', permissions: [] });

      const roles = await manager.listRoles();
      expect(roles.length).toBeGreaterThanOrEqual(2);
      expect(roles.map(r => r.name)).toContain('role1');
      expect(roles.map(r => r.name)).toContain('role2');
    });
  });

  describe('createUser', () => {
    it('should create a user', async () => {
      const user = await manager.createUser({
        email: 'test@example.com',
        name: 'Test User',
        roles: ['role_user'],
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.roles).toContain('role_user');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should create user with multiple roles', async () => {
      const user = await manager.createUser({
        email: 'multi@example.com',
        roles: ['role1', 'role2', 'role3'],
      });

      expect(user.roles).toHaveLength(3);
    });

    it('should create user with attributes', async () => {
      const user = await manager.createUser({
        email: 'attrs@example.com',
        roles: [],
        attributes: {
          department: 'engineering',
          level: 'senior',
        },
      });

      expect(user.attributes).toBeDefined();
      expect(user.attributes?.department).toBe('engineering');
      expect(user.attributes?.level).toBe('senior');
    });
  });

  describe('getUser', () => {
    it('should get user by ID', async () => {
      const created = await manager.createUser({
        email: 'findme@example.com',
        roles: [],
      });

      const found = await manager.getUser(created.id);
      expect(found).toBeDefined();
      expect(found?.email).toBe('findme@example.com');
    });

    it('should return undefined for non-existent user', async () => {
      const user = await manager.getUser('nonexistent');
      expect(user).toBeUndefined();
    });
  });

  describe('getUserByEmail', () => {
    it('should get user by email', async () => {
      await manager.createUser({
        email: 'unique@example.com',
        roles: [],
      });

      const found = await manager.getUserByEmail('unique@example.com');
      expect(found).toBeDefined();
      expect(found?.email).toBe('unique@example.com');
    });
  });

  describe('updateUser', () => {
    it('should update user', async () => {
      const user = await manager.createUser({
        email: 'updatable@example.com',
        roles: [],
      });

      const updated = await manager.updateUser(user.id, {
        name: 'Updated Name',
      });

      expect(updated?.name).toBe('Updated Name');
    });

    it('should update user attributes', async () => {
      const user = await manager.createUser({
        email: 'attrs@example.com',
        roles: [],
        attributes: { level: 'junior' },
      });

      const updated = await manager.updateUser(user.id, {
        attributes: { level: 'senior' },
      });

      expect(updated?.attributes?.level).toBe('senior');
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const user = await manager.createUser({
        email: 'deletable@example.com',
        roles: [],
      });

      await manager.deleteUser(user.id);

      const found = await manager.getUser(user.id);
      expect(found).toBeUndefined();
    });
  });

  describe('assignRole', () => {
    it('should assign role to user', async () => {
      const role = await manager.createRole({
        name: 'assignable',
        permissions: [],
      });

      const user = await manager.createUser({
        email: 'assign@example.com',
        roles: [],
      });

      await manager.assignRole(user.id, role.id);

      const updatedUser = await manager.getUser(user.id);
      expect(updatedUser?.roles).toContain(role.id);
    });
  });

  describe('removeRole', () => {
    it('should remove role from user', async () => {
      const role = await manager.createRole({
        name: 'removable',
        permissions: [],
      });

      const user = await manager.createUser({
        email: 'remove@example.com',
        roles: [role.id],
      });

      await manager.removeRole(user.id, role.id);

      const updatedUser = await manager.getUser(user.id);
      expect(updatedUser?.roles).not.toContain(role.id);
    });
  });

  describe('getAllPermissions', () => {
    it('should get all permissions for a user', async () => {
      const role1 = await manager.createRole({
        name: 'perm_role1',
        permissions: [
          {
            id: 'perm1',
            resource: 'tool:read',
            action: 'read',
            effect: 'allow',
          },
        ],
      });

      const role2 = await manager.createRole({
        name: 'perm_role2',
        permissions: [
          {
            id: 'perm2',
            resource: 'tool:write',
            action: 'write',
            effect: 'allow',
          },
        ],
      });

      const permissions = await manager.getAllPermissions([role1.id, role2.id]);

      expect(permissions).toHaveLength(2);
      expect(permissions.map(p => p.id)).toContain('perm1');
      expect(permissions.map(p => p.id)).toContain('perm2');
    });

    it('should include inherited role permissions', async () => {
      const baseRole = await manager.createRole({
        name: 'base_perm',
        permissions: [
          {
            id: 'base_perm',
            resource: 'base:resource',
            action: 'read',
            effect: 'allow',
          },
        ],
      });

      const derivedRole = await manager.createRole({
        name: 'derived_perm',
        permissions: [
          {
            id: 'derived_perm',
            resource: 'derived:resource',
            action: 'write',
            effect: 'allow',
          },
        ],
        inherits: [baseRole.id],
      });

      const permissions = await manager.getAllPermissions([derivedRole.id]);

      expect(permissions).toHaveLength(2);
      expect(permissions.map(p => p.id)).toContain('base_perm');
      expect(permissions.map(p => p.id)).toContain('derived_perm');
    });

    it('should handle circular inheritance', async () => {
      const role1 = await manager.createRole({
        name: 'circular1',
        permissions: [
          {
            id: 'perm1',
            resource: 'res1',
            action: 'read',
            effect: 'allow',
          },
        ],
      });

      const role2 = await manager.createRole({
        name: 'circular2',
        permissions: [
          {
            id: 'perm2',
            resource: 'res2',
            action: 'read',
            effect: 'allow',
          },
        ],
        inherits: [role1.id],
      });

      // Update role1 to inherit from role2 (circular)
      await manager.updateRole(role1.id, {
        inherits: [role2.id],
      });

      // Should not hang or error
      const permissions = await manager.getAllPermissions([role1.id, role2.id]);
      expect(permissions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('default roles', () => {
    it('should have default admin role', async () => {
      const adminRole = await manager.getRoleByName('admin');
      expect(adminRole).toBeDefined();
      expect(adminRole?.name).toBe('admin');
    });

    it('should have default user role', async () => {
      const userRole = await manager.getRoleByName('user');
      expect(userRole).toBeDefined();
      expect(userRole?.name).toBe('user');
    });
  });
});
