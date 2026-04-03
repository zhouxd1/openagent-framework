/**
 * Session Manager Implementation
 */
import { PrismaClient } from '@prisma/client';
import { ISessionManager, SessionConfig, SessionState, SessionMessage, SessionManagerConfig } from './interfaces';
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
export declare class SessionManager implements ISessionManager {
    private prisma;
    private messageCache;
    private config;
    private logger;
    constructor(prisma?: PrismaClient, config?: SessionManagerConfig);
    create(config: SessionConfig): Promise<SessionState>;
    get(sessionId: string): Promise<SessionState | null>;
    update(sessionId: string, updates: Partial<SessionState>): Promise<SessionState>;
    delete(sessionId: string): Promise<void>;
    addMessage(sessionId: string, message: Omit<SessionMessage, 'id' | 'sessionId' | 'createdAt'>): Promise<SessionMessage>;
    getMessages(sessionId: string, limit?: number): Promise<SessionMessage[]>;
    /**
     * Get messages with pagination (cursor-based)
     */
    getMessagesPaginated(sessionId: string, options?: PaginationOptions): Promise<PaginatedResult<SessionMessage>>;
    clearMessages(sessionId: string): Promise<void>;
    list(userId?: string, status?: string): Promise<SessionState[]>;
    /**
     * List sessions with pagination (cursor-based)
     */
    listPaginated(userId?: string, status?: string, options?: PaginationOptions): Promise<PaginatedResult<SessionState>>;
    close(sessionId: string): Promise<void>;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
    };
    /**
     * Clear all cached messages
     */
    clearCache(): void;
    /**
     * Destroy the session manager and cleanup resources
     */
    destroy(): void;
}
