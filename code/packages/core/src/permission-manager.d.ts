/**
 * Permission Manager Implementation
 */
import { PrismaClient } from '@prisma/client';
import { IPermissionManager, PermissionCheck, PermissionResult, PermissionRule, PermissionManagerConfig } from './interfaces';
export declare class PermissionManager implements IPermissionManager {
    private prisma;
    private cache;
    private cacheEnabled;
    private logger;
    constructor(prisma?: PrismaClient, config?: PermissionManagerConfig);
    check(request: PermissionCheck): Promise<PermissionResult>;
    grant(userId: string, rule: PermissionRule): Promise<void>;
    revoke(userId: string, resource: string, action: string): Promise<void>;
    getPermissions(userId: string): Promise<PermissionRule[]>;
    /**
     * Get permissions with pagination (for users with many permissions)
     */
    getPermissionsPaginated(userId: string, options?: {
        limit?: number;
        cursor?: string;
    }): Promise<{
        items: PermissionRule[];
        nextCursor?: string;
        hasMore: boolean;
    }>;
    createRole(name: string, permissions: PermissionRule[]): Promise<void>;
    assignRole(userId: string, roleName: string): Promise<void>;
    removeRole(userId: string, roleName: string): Promise<void>;
    /**
     * Evaluate permission conditions
     */
    private evaluateConditions;
    /**
     * Clear the permission cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
    };
    /**
     * Destroy the permission manager and cleanup resources
     */
    destroy(): void;
}
