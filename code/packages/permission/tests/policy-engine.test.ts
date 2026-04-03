/**
 * @fileoverview Tests for PolicyEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from '../src/policy-engine';
import { Permission, EvaluationContext } from '../src/types';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;
  const mockUser = {
    id: 'user_123',
    email: 'test@example.com',
    roles: ['user'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockContext: EvaluationContext = {
    user: mockUser,
  };

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  describe('evaluate', () => {
    it('should allow when permission matches', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:*',
          action: '*',
          effect: 'allow',
        },
      ];

      const result = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        mockContext
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny when no permission matches', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'file:*',
          action: 'read',
          effect: 'allow',
        },
      ];

      const result = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        mockContext
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No matching permission');
    });

    it('should deny when action does not match', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:shell',
          action: 'read',
          effect: 'allow',
        },
      ];

      const result = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        mockContext
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Action not allowed');
    });

    it('should prioritize deny over allow', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:*',
          action: '*',
          effect: 'allow',
        },
        {
          id: 'perm2',
          resource: 'tool:shell',
          action: 'execute',
          effect: 'deny',
        },
      ];

      const result = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        mockContext
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Explicitly denied');
    });

    it('should handle multiple actions', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'file:*',
          action: 'read,write,delete',
          effect: 'allow',
        },
      ];

      const readResult = await engine.evaluate(
        permissions,
        'file:/data/test.txt',
        'read',
        mockContext
      );
      expect(readResult.allowed).toBe(true);

      const writeResult = await engine.evaluate(
        permissions,
        'file:/data/test.txt',
        'write',
        mockContext
      );
      expect(writeResult.allowed).toBe(true);

      const executeResult = await engine.evaluate(
        permissions,
        'file:/data/test.txt',
        'execute',
        mockContext
      );
      expect(executeResult.allowed).toBe(false);
    });
  });

  describe('resource matching', () => {
    it('should match exact resource', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:shell',
          action: 'execute',
          effect: 'allow',
        },
      ];

      const result = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        mockContext
      );

      expect(result.allowed).toBe(true);
    });

    it('should match wildcard resource', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:*',
          action: 'execute',
          effect: 'allow',
        },
      ];

      const result = await engine.evaluate(
        permissions,
        'tool:anything',
        'execute',
        mockContext
      );

      expect(result.allowed).toBe(true);
    });

    it('should match file path wildcard', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'file:/data/*',
          action: 'read',
          effect: 'allow',
        },
      ];

      const result = await engine.evaluate(
        permissions,
        'file:/data/subfolder/file.txt',
        'read',
        mockContext
      );

      expect(result.allowed).toBe(true);
    });

    it('should match global wildcard', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: '*',
          action: '*',
          effect: 'allow',
        },
      ];

      const result = await engine.evaluate(
        permissions,
        'anything:any:resource',
        'anyAction',
        mockContext
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('condition checking', () => {
    it('should check time condition', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:*',
          action: '*',
          effect: 'allow',
          conditions: [
            {
              type: 'time',
              operator: 'between',
              value: [540, 1080], // 9:00 - 18:00
            },
          ],
        },
      ];

      // During working hours
      const workTimeContext: EvaluationContext = {
        ...mockContext,
        currentTime: new Date('2024-01-01T14:00:00'), // 14:00
      };

      const workResult = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        workTimeContext
      );
      expect(workResult.allowed).toBe(true);

      // Outside working hours
      const nightTimeContext: EvaluationContext = {
        ...mockContext,
        currentTime: new Date('2024-01-01T22:00:00'), // 22:00
      };

      const nightResult = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        nightTimeContext
      );
      expect(nightResult.allowed).toBe(false);
    });

    it('should check IP condition', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:*',
          action: '*',
          effect: 'allow',
          conditions: [
            {
              type: 'ip',
              operator: 'in',
              value: ['192.168.1.100', '192.168.1.101'],
            },
          ],
        },
      ];

      // Allowed IP
      const allowedContext: EvaluationContext = {
        ...mockContext,
        ip: '192.168.1.100',
      };

      const allowedResult = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        allowedContext
      );
      expect(allowedResult.allowed).toBe(true);

      // Denied IP
      const deniedContext: EvaluationContext = {
        ...mockContext,
        ip: '10.0.0.1',
      };

      const deniedResult = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        deniedContext
      );
      expect(deniedResult.allowed).toBe(false);
    });

    it('should check attribute condition', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:*',
          action: '*',
          effect: 'allow',
          conditions: [
            {
              type: 'attribute',
              operator: 'eq',
              value: {
                attribute: 'department',
                value: 'engineering',
              },
            },
          ],
        },
      ];

      // User with matching attribute
      const engineeringUser = {
        ...mockUser,
        attributes: { department: 'engineering' },
      };

      const engineeringContext: EvaluationContext = {
        ...mockContext,
        user: engineeringUser,
      };

      const allowedResult = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        engineeringContext
      );
      expect(allowedResult.allowed).toBe(true);

      // User with non-matching attribute
      const salesUser = {
        ...mockUser,
        attributes: { department: 'sales' },
      };

      const salesContext: EvaluationContext = {
        ...mockContext,
        user: salesUser,
      };

      const deniedResult = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        salesContext
      );
      expect(deniedResult.allowed).toBe(false);
    });

    it('should check multiple conditions (AND logic)', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:*',
          action: '*',
          effect: 'allow',
          conditions: [
            {
              type: 'ip',
              operator: 'in',
              value: ['192.168.1.100'],
            },
            {
              type: 'attribute',
              operator: 'eq',
              value: {
                attribute: 'department',
                value: 'engineering',
              },
            },
          ],
        },
      ];

      // Both conditions met
      const validUser = {
        ...mockUser,
        attributes: { department: 'engineering' },
      };

      const validContext: EvaluationContext = {
        ...mockContext,
        user: validUser,
        ip: '192.168.1.100',
      };

      const validResult = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        validContext
      );
      expect(validResult.allowed).toBe(true);

      // Only one condition met
      const partialContext: EvaluationContext = {
        ...mockContext,
        user: validUser,
        ip: '10.0.0.1',
      };

      const partialResult = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        partialContext
      );
      expect(partialResult.allowed).toBe(false);
    });
  });

  describe('caching', () => {
    it('should cache permission results', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:*',
          action: '*',
          effect: 'allow',
        },
      ];

      // First evaluation
      const result1 = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        mockContext
      );

      // Second evaluation (should use cache)
      const result2 = await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        mockContext
      );

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('should clear cache', async () => {
      const permissions: Permission[] = [
        {
          id: 'perm1',
          resource: 'tool:*',
          action: '*',
          effect: 'allow',
        },
      ];

      await engine.evaluate(
        permissions,
        'tool:shell',
        'execute',
        mockContext
      );

      engine.clearCache();

      // Cache should be cleared
      expect(engine['cache'].size).toBe(0);
    });
  });
});
