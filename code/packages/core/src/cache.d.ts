/**
 * Cache Implementation with TTL and LRU support
 *
 * Provides in-memory caching with:
 * - Time-to-Live (TTL) expiration
 * - Least Recently Used (LRU) eviction
 * - Automatic cleanup of expired entries
 */
export interface CacheOptions {
    /**
     * Maximum number of items in cache (default: 1000)
     */
    maxSize?: number;
    /**
     * Time-to-live in milliseconds (default: 3600000 = 1 hour)
     */
    ttl?: number;
    /**
     * Interval for automatic cleanup in milliseconds (default: 60000 = 1 minute)
     * Set to 0 to disable automatic cleanup
     */
    cleanupInterval?: number;
}
/**
 * Generic cache with TTL and LRU eviction
 * Uses Map for O(1) access and maintains access order for LRU
 */
export declare class Cache<T> {
    private cache;
    private readonly maxSize;
    private readonly defaultTtl;
    private cleanupTimer?;
    constructor(options?: CacheOptions);
    /**
     * Get a value from cache
     * Moves the item to the end (most recently used)
     */
    get(key: string): T | null;
    /**
     * Set a value in cache
     */
    set(key: string, value: T, ttl?: number): void;
    /**
     * Check if key exists in cache (and is not expired)
     */
    has(key: string): boolean;
    /**
     * Delete a value from cache
     */
    delete(key: string): boolean;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Get current cache size
     */
    get size(): number;
    /**
     * Get all keys in cache
     */
    keys(): string[];
    /**
     * Cleanup expired entries
     */
    cleanup(): number;
    /**
     * Evict the least recently used entry (first item in Map)
     */
    private evictLRU;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        defaultTtl: number;
    };
    /**
     * Destroy the cache and cleanup resources
     */
    destroy(): void;
}
/**
 * Create a simple LRU cache
 */
export declare function createLRUCache<T>(maxSize?: number): Cache<T>;
/**
 * Create a simple TTL cache without LRU eviction
 */
export declare function createTTLCache<T>(ttl?: number): Cache<T>;
