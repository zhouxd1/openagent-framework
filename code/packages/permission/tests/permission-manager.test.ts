/**
 * @fileoverview Tests for PermissionManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionManager } from '../src/permission-manager';
import { PermissionConfig } from '../src/types';

describe('PermissionManager', () => {
  let manager: PermissionManager;
  const config: PermissionConfig = {
    database: { type: 'sqlite', file: ':memory:' },
  };

  beforeEach(() => {
    manager = new PermissionManager(config);
  });

  describe('createUser', () => {
    it('should create a user with roles', async () => {
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
    });

    it('should create a user with multiple roles', async () => {
      const user = await manager.createUser({
        email: 'multi@example.com',
        roles: ['role_user', 'role_admin'],
      });

      expect(user.roles).toHaveLength(2);
      expect(user.roles).toContain('role_user');
      expect(user.roles).toContain('role_admin');
    });
  });

  describe('createRole', () => {
    it('should create a role with permissions', async () => {
      const role = await manager.createRole({
        name: 'editor',
        description: 'Editor role',
        permissions: [
          {
            id: 'perm_editor_read',
            resource: 'file:*',
            action: 'read',
            effect: 'allow',
          },
          {
            id: 'perm_editor_write',
            resource: 'file:*',
            action: 'write',
            effect: 'allow',
          },
        ],
      });

      expect(role.id).toBeDefined();
      expect(role.name).toBe('editor');
      expect(role.permissions).toHaveLength(2);
    });
  });

  describe('checkPermission', () => {
    it('should allow permission for admin role', async () => {
      const user = await manager.createUser({
        email: 'admin@example.com',
        roles: ['role_admin'],
      });

      const result = await manager.checkPermission(
        user.id,
        'tool:shell',
        'execute'
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny permission for user without role', async () => {
      const user = await manager.createUser({
        email: 'norole@example.com',
        roles: [],
      });

      const result = await manager.checkPermission(
        user.id,
        'tool:shell',
        'execute'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should deny permission for non-existent user', async () => {
      const result = await manager.checkPermission(
        'nonexistent_user',
        'tool:shell',
        'execute'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User not found');
    });

    it('should respect deny permissions', async () => {
      const role = await manager.createRole({
        name: 'restricted',
        permissions: [
          {
            id: 'perm_allow',
            resource: 'tool:*',
            action: '*',
            effect: 'allow',
          },
          {
            id: 'perm_deny',
            resource: 'tool:shell',
            action: 'execute',
            effect: 'deny',
          },
        ],
      });

      const user = await manager.createUser({
        email: 'restricted@example.com',
        roles: [role.id],
      });

      const result = await manager.checkPermission(
        user.id,
        'tool:shell',
        'execute'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Explicitly denied');
    });
  });

  describe('grantRole', () => {
    it('should grant role to user', async () => {
      const user = await manager.createUser({
        email: 'user@example.com',
        roles: ['role_user'],
      });

      await manager.grantRole(user.id, 'role_admin', 'system');

      const updatedUser = await manager.getUser(user.id);
      expect(updatedUser?.roles).toContain('role_admin');
    });
  });

  describe('revokeRole', () => {
    it('should revoke role from user', async () => {
      const user = await manager.createUser({
        email: 'user@example.com',
        roles: ['role_user', 'role_admin'],
      });

      await manager.revokeRole(user.id, 'role_admin', 'system');

      const updatedUser = await manager.getUser(user.id);
      expect(updatedUser?.roles).not.toContain('role_admin');
      expect(updatedUser?.roles).toContain('role_user');
    });
  });

  describe('role inheritance', () => {
    it('should handle role inheritance', async () => {
      // Create base role
      const baseRole = await manager.createRole({
        name: 'base_user',
        permissions: [
          {
            id: 'perm_base_read',
            resource: 'tool:file',
            action: 'read',
            effect: 'allow',
          },
        ],
      });

      // Create advanced role with inheritance
      const advancedRole = await manager.createRole({
        name: 'advanced_user',
        permissions: [
          {
            id: 'perm_advanced_write',
            resource: 'tool:*',
            action: 'write',
            effect: 'allow',
          },
        ],
        inherits: [baseRole.id],
      });

      const user = await manager.createUser({
        email: 'advanced@example.com',
        roles: [advancedRole.id],
      });

      // Should have permission from base role
      const readResult = await manager.checkPermission(
        user.id,
        'tool:file',
        'read'
      );
      expect(readResult.allowed).toBe(true);

      // Should have permission from advanced role
      const writeResult = await manager.checkPermission(
        user.id,
        'tool:file',
        'write'
      );
      expect(writeResult.allowed).toBe(true);
    });
  });

  describe('getUser', () => {
    it('should get user by ID', async () => {
      const createdUser = await manager.createUser({
        email: 'findme@example.com',
        roles: ['role_user'],
      });

      const foundUser = await manager.getUser(createdUser.id);
      expect(foundUser).toBeDefined();
      expect(foundUser?.email).toBe('findme@example.com');
    });

    it('should return undefined for non-existent user', async () => {
      const user = await manager.getUser('nonexistent');
      expect(user).toBeUndefined();
    });
  });

  describe('getUserByEmail', () => {
    it('should get user by email', async () => {
      const createdUser = await manager.createUser({
        email: 'unique@example.com',
        roles: ['role_user'],
      });

      const foundUser = await manager.getUserByEmail('unique@example.com');
      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(createdUser.id);
    });
  });

  describe('audit logs', () => {
    it('should log permission checks', async () => {
      const user = await manager.createUser({
        email: 'audited@example.com',
        roles: ['role_admin'],
      });

      await manager.checkPermission(user.id, 'tool:shell', 'execute');

      const logs = await manager.queryAuditLogs({ userId: user.id });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('execute');
      expect(logs[0].resource).toBe('tool:shell');
    });

    it('should export audit logs', async () => {
      const user = await manager.createUser({
        email: 'export@example.com',
        roles: ['role_user'],
      });

      await manager.checkPermission(user.id, 'tool:file', 'read');

      const jsonExport = await manager.exportAuditLogs('json');
      expect(jsonExport).toContain('export@example.com');

      const csvExport = await manager.exportAuditLogs('csv');
      expect(csvExport).toContain('userId');
    });
  });
});
