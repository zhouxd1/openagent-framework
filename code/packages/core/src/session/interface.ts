/**
 * Session Interface for OpenAgent Framework
 */

import { Metadata } from '../types';

/**
 * Session configuration
 */
export interface SessionConfig {
  userId: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  metadata?: Metadata;
  ttl?: number;
}

/**
 * Session state
 */
export interface Session {
  id: string;
  userId: string;
  provider: string;
  model: string;
  messages: Message[];
  status: 'active' | 'paused' | 'closed';
  metadata: Metadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message in a session
 */
export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tokens?: number;
  toolCallId?: string;
  metadata?: Metadata;
  createdAt: Date;
}

/**
 * Pagination options for listing messages
 */
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  orderBy?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  ttl?: number;
  maxSessions?: number;
  persistMessages?: boolean;
  maxCacheSize?: number;
  cacheTtl?: number;
}

/**
 * Session statistics
 */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  oldestSession?: Date;
  newestSession?: Date;
}

/**
 * Session Manager Interface
 * 
 * Defines the contract for session management implementations
 */
export interface ISessionManager {
  /**
   * Create a new session
   */
  create(config: SessionConfig): Promise<Session>;

  /**
   * Get session by ID
   */
  get(sessionId: string): Promise<Session | null>;

  /**
   * Update session
   */
  update(sessionId: string, updates: Partial<Session>): Promise<Session>;

  /**
   * Delete session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Add message to session
   */
  addMessage(
    sessionId: string,
    message: Omit<Message, 'id' | 'sessionId' | 'createdAt'>
  ): Promise<Message>;

  /**
   * Get session messages with optional limit
   */
  getMessages(sessionId: string, limit?: number): Promise<Message[]>;

  /**
   * Get session messages with pagination
   */
  getMessagesPaginated?(
    sessionId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Message>>;

  /**
   * Clear session messages
   */
  clearMessages(sessionId: string): Promise<void>;

  /**
   * List sessions
   */
  list?(userId?: string, status?: string): Promise<Session[]>;

  /**
   * List sessions with pagination
   */
  listPaginated?(
    userId?: string,
    status?: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Session>>;

  /**
   * Close session
   */
  close?(sessionId: string): Promise<void>;

  /**
   * Get session statistics
   */
  getStats?(): Promise<SessionStats>;

  /**
   * Get cache statistics
   */
  getCacheStats?(): { size: number; maxSize: number };

  /**
   * Clear cache
   */
  clearCache?(): void;

  /**
   * Destroy the session manager and cleanup resources
   */
  destroy?(): void;
}
