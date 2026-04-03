/**
 * Tests for Session Manager
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SessionManager } from '../src/session-manager';
import { PrismaClient } from '@prisma/client';

describe('SessionManager', () => {
  let prisma: PrismaClient;
  let sessionManager: SessionManager;

  beforeAll(() => {
    prisma = new PrismaClient();
    sessionManager = new SessionManager(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a new session', async () => {
    const session = await sessionManager.create({
      userId: 'test-user-1',
      metadata: { environment: 'test' },
    });

    expect(session).toBeDefined();
    expect(session.userId).toBe('test-user-1');
    expect(session.status).toBe('active');
    expect(session.metadata.environment).toBe('test');
  });

  it('should get a session by ID', async () => {
    const created = await sessionManager.create({
      userId: 'test-user-2',
    });

    const retrieved = await sessionManager.get(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.userId).toBe('test-user-2');
  });

  it('should update a session', async () => {
    const created = await sessionManager.create({
      userId: 'test-user-3',
    });

    const updated = await sessionManager.update(created.id, {
      status: 'paused',
      metadata: { paused: true },
    });

    expect(updated.status).toBe('paused');
    expect(updated.metadata.paused).toBe(true);
  });

  it('should add messages to a session', async () => {
    const session = await sessionManager.create({
      userId: 'test-user-4',
    });

    const message = await sessionManager.addMessage(session.id, {
      role: 'user',
      content: 'Hello, world!',
    });

    expect(message).toBeDefined();
    expect(message.sessionId).toBe(session.id);
    expect(message.role).toBe('user');
    expect(message.content).toBe('Hello, world!');
  });

  it('should get messages from a session', async () => {
    const session = await sessionManager.create({
      userId: 'test-user-5',
    });

    await sessionManager.addMessage(session.id, {
      role: 'user',
      content: 'Message 1',
    });

    await sessionManager.addMessage(session.id, {
      role: 'assistant',
      content: 'Message 2',
    });

    const messages = await sessionManager.getMessages(session.id);

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('Message 1');
    expect(messages[1].content).toBe('Message 2');
  });

  it('should delete a session', async () => {
    const session = await sessionManager.create({
      userId: 'test-user-6',
    });

    await sessionManager.delete(session.id);

    const retrieved = await sessionManager.get(session.id);
    expect(retrieved).toBeNull();
  });

  it('should list sessions by user', async () => {
    await sessionManager.create({ userId: 'test-user-7' });
    await sessionManager.create({ userId: 'test-user-7' });
    await sessionManager.create({ userId: 'test-user-8' });

    const sessions = await sessionManager.list('test-user-7');

    expect(sessions.length).toBeGreaterThanOrEqual(2);
    sessions.forEach(s => {
      expect(s.userId).toBe('test-user-7');
    });
  });
});
