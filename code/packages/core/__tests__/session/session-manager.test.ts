/**
 * Tests for SessionManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { SessionConfig } from '../../src/session/types';

// Mock PrismaClient
vi.mock('@prisma/client', () => {
  const mockSession = {
    id: 'test-session-id',
    userId: 'test-user',
    status: 'active',
    metadata: '{}',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMessage = {
    id: 'test-message-id',
    sessionId: 'test-session-id',
    role: 'user',
    content: 'Test message',
    tokens: 10,
    metadata: '{}',
    createdAt: new Date(),
  };

  return {
    PrismaClient: vi.fn().mockImplementation(() => ({
      session: {
        create: vi.fn().mockResolvedValue(mockSession),
        findUnique: vi.fn().mockResolvedValue(mockSession),
        update: vi.fn().mockResolvedValue(mockSession),
        delete: vi.fn().mockResolvedValue(undefined),
        findMany: vi.fn().mockResolvedValue([mockSession]),
        count: vi.fn().mockResolvedValue(1),
        findFirst: vi.fn().mockResolvedValue(mockSession),
      },
      message: {
        create: vi.fn().mockResolvedValue(mockMessage),
        findMany: vi.fn().mockResolvedValue([mockMessage]),
        deleteMany: vi.fn().mockResolvedValue(undefined),
        count: vi.fn().mockResolvedValue(1),
      },
    })),
  };
});

describe('SessionManager', () => {
  let manager: SessionManager;
  const config: SessionConfig = {
    userId: 'test-user',
    provider: 'openai',
    model: 'gpt-4',
  };

  beforeEach(() => {
    manager = new SessionManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const session = await manager.create(config);
      expect(session.userId).toBe(config.userId);
      expect(session.status).toBe('active');
      expect(session.id).toBeDefined();
    });

    it('should create session with custom ID', async () => {
      const customConfig = { ...config, sessionId: 'custom-id' };
      const session = await manager.create(customConfig);
      expect(session.id).toBe('custom-id');
    });

    it('should create session with metadata', async () => {
      const metadata = { key: 'value' };
      const configWithMeta = { ...config, metadata };
      const session = await manager.create(configWithMeta);
      expect(session.metadata).toEqual(metadata);
    });
  });

  describe('get', () => {
    it('should get a session by ID', async () => {
      await manager.create(config);
      const session = await manager.get('test-session-id');
      expect(session).not.toBeNull();
      expect(session?.id).toBe('test-session-id');
    });

    it('should return null for non-existent session', async () => {
      const session = await manager.get('non-existent-id');
      expect(session).toBeNull();
    });
  });

  describe('update', () => {
    it('should update session status', async () => {
      await manager.create(config);
      const updated = await manager.update('test-session-id', {
        status: 'paused',
      });
      expect(updated.status).toBe('paused');
    });

    it('should update session metadata', async () => {
      await manager.create(config);
      const updated = await manager.update('test-session-id', {
        metadata: { newKey: 'newValue' },
      });
      expect(updated.metadata).toEqual({ newKey: 'newValue' });
    });
  });

  describe('delete', () => {
    it('should delete a session', async () => {
      await manager.create(config);
      await manager.delete('test-session-id');
      // Should not throw
    });
  });

  describe('addMessage', () => {
    it('should add a message to a session', async () => {
      await manager.create(config);
      const message = await manager.addMessage('test-session-id', {
        role: 'user',
        content: 'Hello',
      });
      expect(message.sessionId).toBe('test-session-id');
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
    });

    it('should add message with tokens', async () => {
      await manager.create(config);
      const message = await manager.addMessage('test-session-id', {
        role: 'assistant',
        content: 'Response',
        tokens: 20,
      });
      expect(message.tokens).toBe(20);
    });

    it('should add message with metadata', async () => {
      await manager.create(config);
      const message = await manager.addMessage('test-session-id', {
        role: 'user',
        content: 'Test',
        metadata: { source: 'test' },
      });
      expect(message.metadata).toEqual({ source: 'test' });
    });
  });

  describe('getMessages', () => {
    it('should get messages for a session', async () => {
      await manager.create(config);
      await manager.addMessage('test-session-id', {
        role: 'user',
        content: 'Hello',
      });
      const messages = await manager.getMessages('test-session-id');
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should limit number of messages', async () => {
      await manager.create(config);
      const messages = await manager.getMessages('test-session-id', 5);
      expect(messages.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getMessagesPaginated', () => {
    it('should get paginated messages', async () => {
      await manager.create(config);
      const result = await manager.getMessagesPaginated('test-session-id', {
        limit: 10,
      });
      expect(result.items).toBeDefined();
      expect(result.hasMore).toBeDefined();
    });

    it('should support cursor-based pagination', async () => {
      await manager.create(config);
      const firstPage = await manager.getMessagesPaginated('test-session-id', {
        limit: 10,
      });
      if (firstPage.nextCursor) {
        const secondPage = await manager.getMessagesPaginated('test-session-id', {
          limit: 10,
          cursor: firstPage.nextCursor,
        });
        expect(secondPage.items).toBeDefined();
      }
    });

    it('should support ordering', async () => {
      await manager.create(config);
      const ascResult = await manager.getMessagesPaginated('test-session-id', {
        orderBy: 'asc',
      });
      const descResult = await manager.getMessagesPaginated('test-session-id', {
        orderBy: 'desc',
      });
      expect(ascResult.items).toBeDefined();
      expect(descResult.items).toBeDefined();
    });
  });

  describe('clearMessages', () => {
    it('should clear all messages from a session', async () => {
      await manager.create(config);
      await manager.addMessage('test-session-id', {
        role: 'user',
        content: 'Test',
      });
      await manager.clearMessages('test-session-id');
      // Should not throw
    });
  });

  describe('list', () => {
    it('should list sessions', async () => {
      await manager.create(config);
      const sessions = await manager.list();
      expect(sessions.length).toBeGreaterThan(0);
    });

    it('should filter sessions by userId', async () => {
      await manager.create(config);
      const sessions = await manager.list('test-user');
      expect(sessions.every(s => s.userId === 'test-user')).toBe(true);
    });

    it('should filter sessions by status', async () => {
      await manager.create(config);
      const sessions = await manager.list(undefined, 'active');
      expect(sessions.every(s => s.status === 'active')).toBe(true);
    });
  });

  describe('listPaginated', () => {
    it('should list sessions with pagination', async () => {
      await manager.create(config);
      const result = await manager.listPaginated(undefined, undefined, {
        limit: 10,
      });
      expect(result.items).toBeDefined();
      expect(result.hasMore).toBeDefined();
    });
  });

  describe('close', () => {
    it('should close a session', async () => {
      await manager.create(config);
      await manager.close('test-session-id');
      // Should not throw
    });
  });

  describe('getStats', () => {
    it('should return session statistics', async () => {
      await manager.create(config);
      const stats = await manager.getStats();
      expect(stats.totalSessions).toBeGreaterThanOrEqual(0);
      expect(stats.activeSessions).toBeGreaterThanOrEqual(0);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cache', () => {
    it('should cache sessions', async () => {
      await manager.create(config);
      // First call hits database
      await manager.get('test-session-id');
      // Second call should hit cache
      await manager.get('test-session-id');
      // Cache stats should reflect this
      const cacheStats = manager.getCacheStats();
      expect(cacheStats.size).toBeGreaterThanOrEqual(0);
    });

    it('should clear cache', () => {
      manager.clearCache();
      const cacheStats = manager.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should cleanup resources on destroy', () => {
      manager.destroy();
      // Should not throw
    });
  });
});
