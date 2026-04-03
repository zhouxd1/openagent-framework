/**
 * Enhanced Session Manager Implementation
 */

import { PrismaClient } from '@prisma/client';
import {
  ISessionManager,
  SessionConfig,
  Session,
  Message,
  SessionManagerConfig,
  PaginationOptions,
  PaginatedResult,
  SessionStats,
} from './interface';
import { Metadata } from '../types';
import { generateId } from '../utils';
import { Cache } from '../cache';
import { Logger, createLogger } from '../logger';
import { SessionNotFoundError, SessionExpiredError, ErrorCode } from '../errors';

const logger = createLogger('SessionManager');

/**
 * Enhanced Session Manager with LRU cache and TTL support
 */
export class SessionManager implements ISessionManager {
  private prisma: PrismaClient;
  private messageCache: Cache<Message[]>;
  private sessionCache: Cache<Session>;
  private config: SessionManagerConfig;
  private logger: Logger;

  constructor(prisma?: PrismaClient, config?: SessionManagerConfig) {
    this.prisma = prisma || new PrismaClient();
    this.config = config || {};
    this.logger = logger;

    // Initialize message cache with TTL and LRU
    this.messageCache = new Cache<Message[]>({
      maxSize: config?.maxCacheSize ?? 1000,
      ttl: config?.cacheTtl ?? 3600000, // 1 hour default
      cleanupInterval: 60000, // Cleanup every minute
    });

    // Initialize session cache
    this.sessionCache = new Cache<Session>({
      maxSize: config?.maxCacheSize ?? 1000,
      ttl: config?.ttl ?? 3600000, // 1 hour default
      cleanupInterval: 60000,
    });
  }

  /**
   * Create a new session
   */
  async create(config: SessionConfig): Promise<Session> {
    this.logger.debug('Creating session', { userId: config.userId });

    const sessionData = {
      id: config.sessionId || generateId(),
      userId: config.userId,
      provider: config.provider || 'unknown',
      model: config.model || 'unknown',
      status: 'active' as const,
      metadata: config.metadata || {},
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Save to database
      await this.prisma.session.create({
        data: {
          id: sessionData.id,
          userId: sessionData.userId,
          status: sessionData.status,
          metadata: JSON.stringify(sessionData.metadata),
        },
      });

      // Cache the session
      this.sessionCache.set(sessionData.id, sessionData);

      this.logger.info('Session created', {
        sessionId: sessionData.id,
        userId: sessionData.userId,
      });

      return sessionData;
    } catch (error) {
      this.logger.error('Failed to create session', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async get(sessionId: string): Promise<Session | null> {
    this.logger.debug('Getting session', { sessionId });

    // Check cache first
    const cached = this.sessionCache.get(sessionId);
    if (cached) {
      return cached;
    }

    // Get from database
    try {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        this.logger.debug('Session not found', { sessionId });
        return null;
      }

      const sessionData: Session = {
        id: session.id,
        userId: session.userId,
        provider: (session.metadata as any)?.provider || 'unknown',
        model: (session.metadata as any)?.model || 'unknown',
        status: session.status as 'active' | 'paused' | 'closed',
        metadata: JSON.parse(session.metadata || '{}') as Metadata,
        messages: [],
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };

      // Cache the session
      this.sessionCache.set(sessionId, sessionData);

      return sessionData;
    } catch (error) {
      this.logger.error('Failed to get session', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Update session
   */
  async update(sessionId: string, updates: Partial<Session>): Promise<Session> {
    this.logger.debug('Updating session', { sessionId, updates });

    try {
      const session = await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: updates.status,
          metadata: updates.metadata ? JSON.stringify(updates.metadata) : undefined,
        },
      });

      const sessionData: Session = {
        id: session.id,
        userId: session.userId,
        provider: updates.provider || (session.metadata as any)?.provider || 'unknown',
        model: updates.model || (session.metadata as any)?.model || 'unknown',
        status: session.status as 'active' | 'paused' | 'closed',
        metadata: JSON.parse(session.metadata || '{}') as Metadata,
        messages: [],
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };

      // Update cache
      this.sessionCache.set(sessionId, sessionData);

      this.logger.info('Session updated', { sessionId, status: updates.status });

      return sessionData;
    } catch (error) {
      this.logger.error('Failed to update session', error instanceof Error ? error : new Error(String(error)));
      throw new SessionNotFoundError(sessionId);
    }
  }

  /**
   * Delete session
   */
  async delete(sessionId: string): Promise<void> {
    this.logger.debug('Deleting session', { sessionId });

    try {
      await this.prisma.session.delete({
        where: { id: sessionId },
      });

      // Clear from cache
      this.sessionCache.delete(sessionId);
      this.messageCache.delete(sessionId);

      this.logger.info('Session deleted', { sessionId });
    } catch (error) {
      this.logger.error('Failed to delete session', error instanceof Error ? error : new Error(String(error)));
      throw new SessionNotFoundError(sessionId);
    }
  }

  /**
   * Add message to session
   */
  async addMessage(
    sessionId: string,
    message: Omit<Message, 'id' | 'sessionId' | 'createdAt'>
  ): Promise<Message> {
    this.logger.debug('Adding message to session', {
      sessionId,
      role: message.role,
    });

    try {
      const msg = await this.prisma.message.create({
        data: {
          sessionId,
          role: message.role,
          content: message.content,
          tokens: message.tokens,
          metadata: JSON.stringify(message.metadata || {}),
        },
      });

      const sessionMessage: Message = {
        id: msg.id,
        sessionId: msg.sessionId,
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
        tokens: msg.tokens || undefined,
        name: message.name,
        toolCallId: message.toolCallId,
        metadata: msg.metadata ? (JSON.parse(msg.metadata) as Metadata) : undefined,
        createdAt: msg.createdAt,
      };

      // Update cache
      const cached = this.messageCache.get(sessionId) || [];
      cached.push(sessionMessage);
      this.messageCache.set(sessionId, cached);

      return sessionMessage;
    } catch (error) {
      this.logger.error('Failed to add message', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get session messages
   */
  async getMessages(sessionId: string, limit?: number): Promise<Message[]> {
    this.logger.debug('Getting messages for session', { sessionId, limit });

    // Check cache first (if no limit or limit is large)
    if (!limit || limit > 50) {
      const cached = this.messageCache.get(sessionId);
      if (cached) {
        return limit ? cached.slice(-limit) : cached;
      }
    }

    // Get from database
    try {
      const messages = await this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      const result = messages.map(msg => ({
        id: msg.id,
        sessionId: msg.sessionId,
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
        tokens: msg.tokens || undefined,
        metadata: msg.metadata ? (JSON.parse(msg.metadata) as Metadata) : undefined,
        createdAt: msg.createdAt,
      }));

      // Cache if no limit or large limit
      if (!limit || limit > 50) {
        this.messageCache.set(sessionId, result);
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get messages', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get messages with pagination (cursor-based)
   */
  async getMessagesPaginated(
    sessionId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Message>> {
    const limit = options.limit ?? 50;
    const orderBy = options.orderBy ?? 'asc';

    this.logger.debug('Getting paginated messages', {
      sessionId,
      limit,
      cursor: options.cursor,
    });

    try {
      const messages = await this.prisma.message.findMany({
        where: {
          sessionId,
          ...(options.cursor && {
            id: orderBy === 'asc' ? { gt: options.cursor } : { lt: options.cursor },
          }),
        },
        orderBy: { createdAt: orderBy },
        take: limit + 1, // Take one extra to check if there are more
      });

      const hasMore = messages.length > limit;
      const items = hasMore ? messages.slice(0, -1) : messages;

      return {
        items: items.map(msg => ({
          id: msg.id,
          sessionId: msg.sessionId,
          role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
          content: msg.content,
          tokens: msg.tokens || undefined,
          metadata: msg.metadata ? (JSON.parse(msg.metadata) as Metadata) : undefined,
          createdAt: msg.createdAt,
        })),
        nextCursor: hasMore ? items[items.length - 1].id : undefined,
        hasMore,
      };
    } catch (error) {
      this.logger.error('Failed to get paginated messages', error instanceof Error ? error : new Error(String(error)));
      return { items: [], hasMore: false };
    }
  }

  /**
   * Clear session messages
   */
  async clearMessages(sessionId: string): Promise<void> {
    this.logger.debug('Clearing messages for session', { sessionId });

    try {
      await this.prisma.message.deleteMany({
        where: { sessionId },
      });

      // Clear from cache
      this.messageCache.delete(sessionId);

      this.logger.info('Messages cleared', { sessionId });
    } catch (error) {
      this.logger.error('Failed to clear messages', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * List sessions
   */
  async list(userId?: string, status?: string): Promise<Session[]> {
    this.logger.debug('Listing sessions', { userId, status });

    try {
      const sessions = await this.prisma.session.findMany({
        where: {
          userId,
          status,
        },
        orderBy: { createdAt: 'desc' },
      });

      return sessions.map(session => ({
        id: session.id,
        userId: session.userId,
        provider: (session.metadata as any)?.provider || 'unknown',
        model: (session.metadata as any)?.model || 'unknown',
        status: session.status as 'active' | 'paused' | 'closed',
        metadata: JSON.parse(session.metadata || '{}') as Metadata,
        messages: [],
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }));
    } catch (error) {
      this.logger.error('Failed to list sessions', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * List sessions with pagination
   */
  async listPaginated(
    userId?: string,
    status?: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<Session>> {
    const limit = options.limit ?? 50;

    this.logger.debug('Listing paginated sessions', {
      userId,
      status,
      limit,
      cursor: options.cursor,
    });

    try {
      const sessions = await this.prisma.session.findMany({
        where: {
          userId,
          status,
          ...(options.cursor && {
            id: { lt: options.cursor },
          }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = sessions.length > limit;
      const items = hasMore ? sessions.slice(0, -1) : sessions;

      return {
        items: items.map(session => ({
          id: session.id,
          userId: session.userId,
          provider: (session.metadata as any)?.provider || 'unknown',
          model: (session.metadata as any)?.model || 'unknown',
          status: session.status as 'active' | 'paused' | 'closed',
          metadata: JSON.parse(session.metadata || '{}') as Metadata,
          messages: [],
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        })),
        nextCursor: hasMore ? items[items.length - 1].id : undefined,
        hasMore,
      };
    } catch (error) {
      this.logger.error('Failed to list paginated sessions', error instanceof Error ? error : new Error(String(error)));
      return { items: [], hasMore: false };
    }
  }

  /**
   * Close session
   */
  async close(sessionId: string): Promise<void> {
    await this.update(sessionId, { status: 'closed' });
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<SessionStats> {
    try {
      const totalSessions = await this.prisma.session.count();
      const activeSessions = await this.prisma.session.count({
        where: { status: 'active' },
      });
      const totalMessages = await this.prisma.message.count();

      const oldest = await this.prisma.session.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      const newest = await this.prisma.session.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      return {
        totalSessions,
        activeSessions,
        totalMessages,
        oldestSession: oldest?.createdAt,
        newestSession: newest?.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to get stats', error instanceof Error ? error : new Error(String(error)));
      return {
        totalSessions: 0,
        activeSessions: 0,
        totalMessages: 0,
      };
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    const msgStats = this.messageCache.getStats();
    return {
      size: msgStats.size,
      maxSize: msgStats.maxSize,
    };
  }

  /**
   * Clear all cached messages
   */
  clearCache(): void {
    this.messageCache.clear();
    this.sessionCache.clear();
    this.logger.debug('All caches cleared');
  }

  /**
   * Destroy the session manager and cleanup resources
   */
  destroy(): void {
    this.messageCache.destroy();
    this.sessionCache.destroy();
    this.logger.debug('Session manager destroyed');
  }
}
