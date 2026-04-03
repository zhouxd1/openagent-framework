/**
 * Tests for Cache
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache, createLRUCache, createTTLCache } from '../src/cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>({ maxSize: 3, ttl: 1000, cleanupInterval: 0 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent key', () => {
      expect(cache.get('non-existent')).toBeNull();
    });

    it('should overwrite existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('TTL', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new Cache<string>({ ttl: 100, cleanupInterval: 0 });
      
      shortCache.set('key1', 'value1');
      expect(shortCache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(shortCache.get('key1')).toBeNull();
      
      shortCache.destroy();
    });

    it('should support custom TTL per entry', async () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 500);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('LRU eviction', () => {
    it('should evict LRU entry when cache is full', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Access key1 to make it recently used
      cache.get('key1');
      
      // Add new entry, should evict key2 (oldest)
      cache.set('key4', 'value4');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should not evict when updating existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Update existing key
      cache.set('key1', 'value1-updated');
      
      expect(cache.size).toBe(3);
      expect(cache.get('key1')).toBe('value1-updated');
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      const shortCache = new Cache<string>({ ttl: 100, cleanupInterval: 0 });
      
      shortCache.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(shortCache.has('key1')).toBe(false);
      
      shortCache.destroy();
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      cache.set('key1', 'value1');
      const deleted = cache.delete('key1');
      
      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should return false for non-existent key', () => {
      expect(cache.delete('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('size', () => {
    it('should return correct size', () => {
      expect(cache.size).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });
  });

  describe('keys', () => {
    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const keys = cache.keys();
      
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      const cleanupCache = new Cache<string>({ 
        maxSize: 100, 
        ttl: 100, 
        cleanupInterval: 0 
      });
      
      cleanupCache.set('key1', 'value1');
      cleanupCache.set('key2', 'value2');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const removed = cleanupCache.cleanup();
      
      expect(removed).toBe(2);
      expect(cleanupCache.size).toBe(0);
      
      cleanupCache.destroy();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1');
      
      const stats = cache.getStats();
      
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(3);
      expect(stats.defaultTtl).toBe(1000);
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      cache.set('key1', 'value1');
      cache.destroy();
      
      expect(cache.size).toBe(0);
    });
  });
});

describe('createLRUCache', () => {
  it('should create cache with LRU eviction', () => {
    const cache = createLRUCache<string>(2);
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    expect(cache.size).toBe(2);
    
    cache.destroy();
  });
});

describe('createTTLCache', () => {
  it('should create cache with TTL expiration', async () => {
    const cache = createTTLCache<string>(100);
    
    cache.set('key1', 'value1');
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(cache.get('key1')).toBeNull();
    
    cache.destroy();
  });
});
