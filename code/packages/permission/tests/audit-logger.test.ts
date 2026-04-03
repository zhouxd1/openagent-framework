/**
 * @fileoverview Tests for AuditLogger
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogger, AuditLogFormatter } from '../src/audit-logger';
import { AuditLog } from '../src/types';

describe('AuditLogger', () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger({
      flushInterval: 1000,
      bufferSize: 10,
      enabled: true,
    });
  });

  afterEach(async () => {
    await logger.shutdown();
  });

  describe('log', () => {
    it('should log audit entry', async () => {
      await logger.log({
        userId: 'user_123',
        action: 'execute',
        resource: 'tool:shell',
        result: 'allow',
      });

      const logs = await logger.query({ userId: 'user_123' });
      expect(logs.length).toBe(1);
      expect(logs[0].userId).toBe('user_123');
      expect(logs[0].action).toBe('execute');
      expect(logs[0].result).toBe('allow');
    });

    it('should log with metadata', async () => {
      await logger.log({
        userId: 'user_123',
        action: 'create_user',
        resource: 'user:user_456',
        result: 'allow',
        metadata: {
          newUserEmail: 'new@example.com',
          createdByName: 'Admin User',
        },
      });

      const logs = await logger.query({ userId: 'user_123' });
      expect(logs[0].metadata).toBeDefined();
      expect(logs[0].metadata?.newUserEmail).toBe('new@example.com');
    });

    it('should flush buffer when full', async () => {
      // Log more than bufferSize
      for (let i = 0; i < 15; i++) {
        await logger.log({
          userId: `user_${i}`,
          action: 'test',
          resource: 'test:resource',
          result: 'allow',
        });
      }

      const logs = await logger.query({ limit: 100 });
      expect(logs.length).toBe(15);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Create sample logs
      await logger.log({
        userId: 'user_1',
        action: 'execute',
        resource: 'tool:shell',
        result: 'allow',
        ip: '192.168.1.100',
      });

      await logger.log({
        userId: 'user_1',
        action: 'read',
        resource: 'file:/data/test.txt',
        result: 'deny',
        reason: 'Access denied',
      });

      await logger.log({
        userId: 'user_2',
        action: 'execute',
        resource: 'tool:shell',
        result: 'allow',
      });
    });

    it('should filter by userId', async () => {
      const logs = await logger.query({ userId: 'user_1' });
      expect(logs.length).toBe(2);
      expect(logs.every(log => log.userId === 'user_1')).toBe(true);
    });

    it('should filter by action', async () => {
      const logs = await logger.query({ action: 'execute' });
      expect(logs.length).toBe(2);
      expect(logs.every(log => log.action === 'execute')).toBe(true);
    });

    it('should filter by resource', async () => {
      const logs = await logger.query({ resource: 'tool:shell' });
      expect(logs.length).toBe(2);
      expect(logs.every(log => log.resource === 'tool:shell')).toBe(true);
    });

    it('should filter by result', async () => {
      const logs = await logger.query({ result: 'deny' });
      expect(logs.length).toBe(1);
      expect(logs[0].result).toBe('deny');
    });

    it('should filter by time range', async () => {
      const startTime = new Date(Date.now() - 1000);
      const endTime = new Date(Date.now() + 1000);

      const logs = await logger.query({
        startTime,
        endTime,
      });

      expect(logs.length).toBe(3);
    });

    it('should apply limit', async () => {
      const logs = await logger.query({ limit: 2 });
      expect(logs.length).toBe(2);
    });

    it('should sort by timestamp (newest first)', async () => {
      const logs = await logger.query({});
      
      for (let i = 0; i < logs.length - 1; i++) {
        expect(logs[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          logs[i + 1].timestamp.getTime()
        );
      }
    });
  });

  describe('export', () => {
    beforeEach(async () => {
      await logger.log({
        userId: 'user_1',
        action: 'execute',
        resource: 'tool:shell',
        result: 'allow',
      });

      await logger.log({
        userId: 'user_2',
        action: 'read',
        resource: 'file:/data/test.txt',
        result: 'deny',
        reason: 'Access denied',
      });
    });

    it('should export to JSON', async () => {
      const jsonExport = await logger.export('json');
      const parsed = JSON.parse(jsonExport);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      expect(parsed[0].userId).toBeDefined();
      expect(parsed[0].action).toBeDefined();
    });

    it('should export to CSV', async () => {
      const csvExport = await logger.export('csv');
      const lines = csvExport.split('\n');

      expect(lines[0]).toContain('id,userId,action,resource,result');
      expect(lines.length).toBe(3); // Header + 2 rows
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      // Create multiple logs
      for (let i = 0; i < 5; i++) {
        await logger.log({
          userId: 'user_1',
          action: 'execute',
          resource: 'tool:shell',
          result: 'allow',
        });
      }

      for (let i = 0; i < 3; i++) {
        await logger.log({
          userId: 'user_2',
          action: 'read',
          resource: 'file:/data',
          result: 'deny',
        });
      }
    });

    it('should return statistics', async () => {
      const stats = await logger.getStats();

      expect(stats.totalLogs).toBe(8);
      expect(stats.allowCount).toBe(5);
      expect(stats.denyCount).toBe(3);
      expect(stats.topActions).toBeDefined();
      expect(stats.topUsers).toBeDefined();
    });

    it('should identify top actions', async () => {
      const stats = await logger.getStats();

      expect(stats.topActions[0].action).toBe('execute');
      expect(stats.topActions[0].count).toBe(5);
    });

    it('should identify top users', async () => {
      const stats = await logger.getStats();

      expect(stats.topUsers[0].userId).toBe('user_1');
      expect(stats.topUsers[0].count).toBe(5);
    });
  });

  describe('clear', () => {
    it('should clear all logs', async () => {
      await logger.log({
        userId: 'user_1',
        action: 'test',
        resource: 'test:resource',
        result: 'allow',
      });

      await logger.clear();

      const logs = await logger.query({});
      expect(logs.length).toBe(0);
    });
  });

  describe('enabled/disabled', () => {
    it('should not log when disabled', async () => {
      const disabledLogger = new AuditLogger({ enabled: false });

      await disabledLogger.log({
        userId: 'user_1',
        action: 'test',
        resource: 'test:resource',
        result: 'allow',
      });

      const logs = await disabledLogger.query({});
      expect(logs.length).toBe(0);

      await disabledLogger.shutdown();
    });
  });
});

describe('AuditLogFormatter', () => {
  const sampleLog: AuditLog = {
    id: 'audit_123',
    userId: 'user_456',
    action: 'execute',
    resource: 'tool:shell',
    result: 'allow',
    reason: undefined,
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date('2024-01-01T12:00:00Z'),
  };

  describe('format', () => {
    it('should format single log', () => {
      const formatted = AuditLogFormatter.format(sampleLog);

      expect(formatted).toContain('2024-01-01');
      expect(formatted).toContain('ALLOW');
      expect(formatted).toContain('user_456');
      expect(formatted).toContain('execute');
      expect(formatted).toContain('tool:shell');
    });

    it('should include reason when present', () => {
      const logWithReason = {
        ...sampleLog,
        result: 'deny' as const,
        reason: 'Access denied',
      };

      const formatted = AuditLogFormatter.format(logWithReason);
      expect(formatted).toContain('Access denied');
    });
  });

  describe('formatTable', () => {
    it('should format multiple logs as table', () => {
      const logs = [
        sampleLog,
        { ...sampleLog, id: 'audit_456', result: 'deny' as const },
      ];

      const formatted = AuditLogFormatter.formatTable(logs);

      expect(formatted).toContain('Timestamp');
      expect(formatted).toContain('Result');
      expect(formatted).toContain('User ID');
      expect(formatted).toContain('---');
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON', () => {
      const json = AuditLogFormatter.toJSON(sampleLog);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe('audit_123');
      expect(parsed.userId).toBe('user_456');
    });
  });
});
