/**
 * Session Manager Implementation
 */

import { PrismaClient } from '@prisma/client';
import {
  ISessionManager,
  SessionConfig,
  SessionState,
  SessionMessage,
  SessionManagerConfig,
  Metadata,
} from './interfaces';
import { generateId } from './utils';
import { Cache } from './cache';
import { Logger, createLogger } from './logger';

const logger = createLogger('SessionManager');

/**
 * Pagination result type
 */
export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  orderBy?: 'asc' | 'desc';
}

export class SessionManager implements ISessionManager {
  private prisma: PrismaClient;
  private messageCache: Cache<SessionMessage[]>;
  private config: SessionManagerConfig;
  private logger: Logger;

  constructor(prisma?: PrismaClient, config?: SessionManagerConfig) {
    this.prisma = prisma || new PrismaClient();
    this.config = config || {};
    this.logger = logger;
    
    // Initialize message cache with TTL and LRU
    this.messageCache = new Cache<SessionMessage[]>({
      maxSize: config?.maxCacheSize ?? 1000,
      ttl: config?.cacheTtl ?? 3600000, // 1 hour default
      cleanupInterval: 60000, // Cleanup every minute
    });
  }

  async create(config: SessionConfig): Promise<SessionState> {
    this.logger.debug('Creating session', { userId: config.userId });

    const session = await this.prisma.session.create({
      data: {
        id: config.sessionId || generateId(),
        userId: config.userId,
        status: 'active',
        metadata: JSON.stringify(config.metadata || {}),
      },
    });

    this.logger.info('Session created', {
      sessionId: session.id,
      userId: session.userId,
    });

    return {
      id: session.id,
      userId: session.userId,
      status: session.status as 'active' | 'paused' | 'closed',
      metadata: JSON.parse(session.metadata || '{}') as Metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async get(sessionId: string): Promise<SessionState | null> {
    this.logger.debug('Getting session', { sessionId });

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      this.logger.debug('Session not found', { sessionId });
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      status: session.status as 'active' | 'paused' | 'closed',
      metadata: JSON.parse(session.metadata || '{}') as Metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async update(
    sessionId: string,
    updates: Partial<SessionState>
  ): Promise<SessionState> {
    this.logger.debug('Updating session', { sessionId, updates });

    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: updates.status,
        metadata: updates.metadata ? JSON.stringify(updates.metadata) : undefined,
      },
    });

    this.logger.info('Session updated', { sessionId, status: updates.status });

    return {
      id: session.id,
      userId: session.userId,
      status: session.status as 'active' | 'paused' | 'closed',
      metadata: JSON.parse(session.metadata || '{}') as Metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async delete(sessionId: string): Promise<void> {
    this.logger.debug('Deleting session', { sessionId });

    await this.prisma.session.delete({
      where: { id: sessionId },
    });
    this.messageCache.delete(sessionId);

    this.logger.info('Session deleted', { sessionId });
  }

  async addMessage(
    sessionId: string,
    message: Omit<SessionMessage, 'id' | 'sessionId' | 'createdAt'>
  ): Promise<SessionMessage> {
    this.logger.debug('Adding message to session', {
      sessionId,
      role: message.role,
    });

    const msg = await this.prisma.message.create({
      data: {
        sessionId,
        role: message.role,
        content: message.content,
        tokens: message.tokens,
        metadata: JSON.stringify(message.metadata || {}),
      },
    });

    const sessionMessage: SessionMessage = {
      id: msg.id,
      sessionId: msg.sessionId,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      tokens: msg.tokens || undefined,
      metadata: msg.metadata ? JSON.parse(msg.metadata) as Metadata : undefined,
      createdAt: msg.createdAt,
    };

    // Update cache
    const cached = this.messageCache.get(sessionId) || [];
    cached.push(sessionMessage);
    this.messageCache.set(sessionId, cached);

    return sessionMessage;
  }

  async getMessages(
    sessionId: string,
    limit?: number
  ): Promise<SessionMessage[]> {
    this.logger.debug('Getting messages for session', { sessionId, limit });

    const messages = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages.map(msg => ({
      id: msg.id,
      sessionId: msg.sessionId,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      tokens: msg.tokens || undefined,
      metadata: msg.metadata ? JSON.parse(msg.metadata) as Metadata : undefined,
      createdAt: msg.createdAt,
    }));
  }

  /**
   * Get messages with pagination (cursor-based)
   */
  async getMessagesPaginated(
    sessionId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<SessionMessage>> {
    const limit = options.limit ?? 50;
    const orderBy = options.orderBy ?? 'asc';

    this.logger.debug('Getting paginated messages', {
      sessionId,
      limit,
      cursor: options.cursor,
    });

    const messages = await this.prisma.message.findMany({
      where: {
        sessionId,
        ...(options.cursor && {
          id: orderBy === 'asc'
            ? { gt: options.cursor }
            : { lt: options.cursor },
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
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        tokens: msg.tokens || undefined,
        metadata: msg.metadata ? JSON.parse(msg.metadata) as Metadata : undefined,
        createdAt: msg.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : undefined,
      hasMore,
    };
  }

  async clearMessages(sessionId: string): Promise<void> {
    this.logger.debug('Clearing messages for session', { sessionId });

    await this.prisma.message.deleteMany({
      where: { sessionId },
    });
    this.messageCache.delete(sessionId);

    this.logger.info('Messages cleared', { sessionId });
  }

  async list(userId?: string, status?: string): Promise<SessionState[]> {
    this.logger.debug('Listing sessions', { userId, status });

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
      status: session.status as 'active' | 'paused' | 'closed',
      metadata: JSON.parse(session.metadata || '{}') as Metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }

  /**
   * List sessions with pagination (cursor-based)
   */
  async listPaginated(
    userId?: string,
    status?: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<SessionState>> {
    const limit = options.limit ?? 50;

    this.logger.debug('Listing paginated sessions', {
      userId,
      status,
      limit,
      cursor: options.cursor,
    });

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
        status: session.status as 'active' | 'paused' | 'closed',
        metadata: JSON.parse(session.metadata || '{}') as Metadata,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : undefined,
      hasMore,
    };
  }

  async close(sessionId: string): Promise<void> {
    await this.update(sessionId, { status: 'closed' });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.messageCache.size,
      maxSize: this.messageCache.getStats().maxSize,
    };
  }

  /**
   * Clear all cached messages
   */
  clearCache(): void {
    this.messageCache.clear();
    this.logger.debug('Message cache cleared');
  }

  /**
   * Destroy the session manager and cleanup resources
   */
  destroy(): void {
    this.messageCache.destroy();
    this.logger.debug('Session manager destroyed');
  }
}
