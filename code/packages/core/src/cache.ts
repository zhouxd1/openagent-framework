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

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Generic cache with TTL and LRU eviction
 * Uses Map for O(1) access and maintains access order for LRU
 */
export class Cache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTtl = options.ttl ?? 3600000; // 1 hour default

    // Setup automatic cleanup
    const cleanupInterval = options.cleanupInterval ?? 60000; // 1 minute default
    if (cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, cleanupInterval);

      // Don't prevent the process from exiting
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Get a value from cache
   * Moves the item to the end (most recently used)
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end for LRU (delete and re-add maintains insertion order)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const actualTtl = ttl ?? this.defaultTtl;
    const now = Date.now();

    // If key exists, delete it first (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // If cache is full and this is a new key, evict LRU (first item)
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt: now + actualTtl,
    });
  }

  /**
   * Check if key exists in cache (and is not expired)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    return expiredKeys.length;
  }

  /**
   * Evict the least recently used entry (first item in Map)
   */
  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    defaultTtl: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      defaultTtl: this.defaultTtl,
    };
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }
}

/**
 * Create a simple LRU cache
 */
export function createLRUCache<T>(
  maxSize: number = 1000
): Cache<T> {
  return new Cache<T>({ maxSize, ttl: Infinity, cleanupInterval: 0 });
}

/**
 * Create a simple TTL cache without LRU eviction
 */
export function createTTLCache<T>(
  ttl: number = 3600000
): Cache<T> {
  return new Cache<T>({ maxSize: Infinity, ttl, cleanupInterval: 60000 });
}
