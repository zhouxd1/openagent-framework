"use strict";
/**
 * Cache Implementation with TTL and LRU support
 *
 * Provides in-memory caching with:
 * - Time-to-Live (TTL) expiration
 * - Least Recently Used (LRU) eviction
 * - Automatic cleanup of expired entries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = void 0;
exports.createLRUCache = createLRUCache;
exports.createTTLCache = createTTLCache;
/**
 * Generic cache with TTL and LRU eviction
 * Uses Map for O(1) access and maintains access order for LRU
 */
class Cache {
    cache;
    maxSize;
    defaultTtl;
    cleanupTimer;
    constructor(options = {}) {
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
    get(key) {
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
    set(key, value, ttl) {
        const actualTtl = ttl ?? this.defaultTtl;
        const now = Date.now();
        // If key exists, delete it first (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        else if (this.cache.size >= this.maxSize) {
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
    has(key) {
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
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get current cache size
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Get all keys in cache
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];
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
    evictLRU() {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
            this.cache.delete(firstKey);
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            defaultTtl: this.defaultTtl,
        };
    }
    /**
     * Destroy the cache and cleanup resources
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cache.clear();
    }
}
exports.Cache = Cache;
/**
 * Create a simple LRU cache
 */
function createLRUCache(maxSize = 1000) {
    return new Cache({ maxSize, ttl: Infinity, cleanupInterval: 0 });
}
/**
 * Create a simple TTL cache without LRU eviction
 */
function createTTLCache(ttl = 3600000) {
    return new Cache({ maxSize: Infinity, ttl, cleanupInterval: 60000 });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjYWNoZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7R0FPRzs7O0FBNk1ILHdDQUlDO0FBS0Qsd0NBSUM7QUFqTUQ7OztHQUdHO0FBQ0gsTUFBYSxLQUFLO0lBQ1IsS0FBSyxDQUE2QjtJQUN6QixPQUFPLENBQVM7SUFDaEIsVUFBVSxDQUFTO0lBQzVCLFlBQVksQ0FBa0M7SUFFdEQsWUFBWSxVQUF3QixFQUFFO1FBQ3BDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxpQkFBaUI7UUFFM0QsMEJBQTBCO1FBQzFCLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxlQUFlLElBQUksS0FBSyxDQUFDLENBQUMsbUJBQW1CO1FBQzdFLElBQUksZUFBZSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxZQUFZLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRTtnQkFDbkMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2pCLENBQUMsRUFBRSxlQUFlLENBQUMsQ0FBQztZQUVwQix5Q0FBeUM7WUFDekMsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUM1QixJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQzVCLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILEdBQUcsQ0FBQyxHQUFXO1FBQ2IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFbEMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFD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QixjQUFjLENBQzVCLE1BQWMsT0FBTztJQUVyQixPQUFPLElBQUksS0FBSyxDQUFJLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsZUFBZSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDMUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ2FjaGUgSW1wbGVtZW50YXRpb24gd2l0aCBUVEwgYW5kIExSVSBzdXBwb3J0XG4gKiBcbiAqIFByb3ZpZGVzIGluLW1lbW9yeSBjYWNoaW5nIHdpdGg6XG4gKiAtIFRpbWUtdG8tTGl2ZSAoVFRMKSBleHBpcmF0aW9uXG4gKiAtIExlYXN0IFJlY2VudGx5IFVzZWQgKExSVSkgZXZpY3Rpb25cbiAqIC0gQXV0b21hdGljIGNsZWFudXAgb2YgZXhwaXJlZCBlbnRyaWVzXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBDYWNoZU9wdGlvbnMge1xuICAvKipcbiAgICogTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgaW4gY2FjaGUgKGRlZmF1bHQ6IDEwMDApXG4gICAqL1xuICBtYXhTaXplPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBUaW1lLXRvLWxpdmUgaW4gbWlsbGlzZWNvbmRzIChkZWZhdWx0OiAzNjAwMDAwID0gMSBob3VyKVxuICAgKi9cbiAgdHRsPzogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBJbnRlcnZhbCBmb3IgYXV0b21hdGljIGNsZWFudXAgaW4gbWlsbGlzZWNvbmRzIChkZWZhdWx0OiA2MDAwMCA9IDEgbWludXRlKVxuICAgKiBTZXQgdG8gMCB0byBkaXNhYmxlIGF1dG9tYXRpYyBjbGVhbnVwXG4gICAqL1xuICBjbGVhbnVwSW50ZXJ2YWw/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBDYWNoZUVudHJ5PFQ+IHtcbiAgdmFsdWU6IFQ7XG4gIGV4cGlyZXNBdDogbnVtYmVyO1xufVxuXG4vKipcbiAqIEdlbmVyaWMgY2FjaGUgd2l0aCBUVEwgYW5kIExSVSBldmljdGlvblxuICogVXNlcyBNYXAgZm9yIE8oMSkgYWNjZXNzIGFuZCBtYWludGFpbnMgYWNjZXNzIG9yZGVyIGZvciBMUlVcbiAqL1xuZXhwb3J0IGNsYXNzIENhY2hlPFQ+IHtcbiAgcHJpdmF0ZSBjYWNoZTogTWFwPHN0cmluZywgQ2FjaGVFbnRyeTxUPj47XG4gIHByaXZhdGUgcmVhZG9ubHkgbWF4U2l6ZTogbnVtYmVyO1xuICBwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRUdGw6IG51bWJlcjtcbiAgcHJpdmF0ZSBjbGVhbnVwVGltZXI/OiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRJbnRlcnZhbD47XG5cbiAgY29uc3RydWN0b3Iob3B0aW9uczogQ2FjaGVPcHRpb25zID0ge30pIHtcbiAgICB0aGlzLmNhY2hlID0gbmV3IE1hcCgpO1xuICAgIHRoaXMubWF4U2l6ZSA9IG9wdGlvbnMubWF4U2l6ZSA/PyAxMDAwO1xuICAgIHRoaXMuZGVmYXVsdFR0bCA9IG9wdGlvbnMudHRsID8/IDM2MDAwMDA7IC8vIDEgaG91ciBkZWZhdWx0XG5cbiAgICAvLyBTZXR1cCBhdXRvbWF0aWMgY2xlYW51cFxuICAgIGNvbnN0IGNsZWFudXBJbnRlcnZhbCA9IG9wdGlvbnMuY2xlYW51cEludGVydmFsID8/IDYwMDAwOyAvLyAxIG1pbnV0ZSBkZWZhdWx0XG4gICAgaWYgKGNsZWFudXBJbnRlcnZhbCA+IDApIHtcbiAgICAgIHRoaXMuY2xlYW51cFRpbWVyID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICB0aGlzLmNsZWFudXAoKTtcbiAgICAgIH0sIGNsZWFudXBJbnRlcnZhbCk7XG5cbiAgICAgIC8vIERvbid0IHByZXZlbnQgdGhlIHByb2Nlc3MgZnJvbSBleGl0aW5nXG4gICAgICBpZiAodGhpcy5jbGVhbnVwVGltZXIudW5yZWYpIHtcbiAgICAgICAgdGhpcy5jbGVhbnVwVGltZXIudW5yZWYoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IGEgdmFsdWUgZnJvbSBjYWNoZVxuICAgKiBNb3ZlcyB0aGUgaXRlbSB0byB0aGUgZW5kIChtb3N0IHJlY2VudGx5IHVzZWQpXG4gICAqL1xuICBnZXQoa2V5OiBzdHJpbmcpOiBUIHwgbnVsbCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLmNhY2hlLmdldChrZXkpO1xuXG4gICAgaWYgKCFlbnRyeSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgZXhwaXJlZFxuICAgIGlmIChEYXRlLm5vdygpID4gZW50cnkuZXhwaXJlc0F0KSB7XG4gICAgICB0aGlzLmNhY2hlLmRlbGV0ZShrZXkpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gTW92ZSB0byBlbmQgZm9yIExSVSAoZGVsZXRlIGFuZCByZS1hZGQgbWFpbnRhaW5zIGluc2VydGlvbiBvcmRlcilcbiAgICB0aGlzLmNhY2hlLmRlbGV0ZShrZXkpO1xuICAgIHRoaXMuY2FjaGUuc2V0KGtleSwgZW50cnkpO1xuXG4gICAgcmV0dXJuIGVudHJ5LnZhbHVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBhIHZhbHVlIGluIGNhY2hlXG4gICAqL1xuICBzZXQoa2V5OiBzdHJpbmcsIHZhbHVlOiBULCB0dGw/OiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBhY3R1YWxUdGwgPSB0dGwgPz8gdGhpcy5kZWZhdWx0VHRsO1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cbiAgICAvLyBJZiBrZXkgZXhpc3RzLCBkZWxldGUgaXQgZmlyc3QgKHRvIHVwZGF0ZSBwb3NpdGlvbilcbiAgICBpZiAodGhpcy5jYWNoZS5oYXMoa2V5KSkge1xuICAgICAgdGhpcy5jYWNoZS5kZWxldGUoa2V5KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY2FjaGUuc2l6ZSA+PSB0aGlzLm1heFNpemUpIHtcbiAgICAgIC8vIElmIGNhY2hlIGlzIGZ1bGwgYW5kIHRoaXMgaXMgYSBuZXcga2V5LCBldmljdCBMUlUgKGZpcnN0IGl0ZW0pXG4gICAgICB0aGlzLmV2aWN0TFJVKCk7XG4gICAgfVxuXG4gICAgdGhpcy5jYWNoZS5zZXQoa2V5LCB7XG4gICAgICB2YWx1ZSxcbiAgICAgIGV4cGlyZXNBdDogbm93ICsgYWN0dWFsVHRsLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIGtleSBleGlzdHMgaW4gY2FjaGUgKGFuZCBpcyBub3QgZXhwaXJlZClcbiAgICovXG4gIGhhcyhrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5jYWNoZS5nZXQoa2V5KTtcblxuICAgIGlmICghZW50cnkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBleHBpcmVkXG4gICAgaWYgKERhdGUubm93KCkgPiBlbnRyeS5leHBpcmVzQXQpIHtcbiAgICAgIHRoaXMuY2FjaGUuZGVsZXRlKGtleSk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGEgdmFsdWUgZnJvbSBjYWNoZVxuICAgKi9cbiAgZGVsZXRlKGtleTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuY2FjaGUuZGVsZXRlKGtleSk7XG4gIH1cblxuICAvKipcbiAgICogQ2xlYXIgYWxsIGNhY2hlIGVudHJpZXNcbiAgICovXG4gIGNsZWFyKCk6IHZvaWQge1xuICAgIHRoaXMuY2FjaGUuY2xlYXIoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY3VycmVudCBjYWNoZSBzaXplXG4gICAqL1xuICBnZXQgc2l6ZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmNhY2hlLnNpemU7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCBrZXlzIGluIGNhY2hlXG4gICAqL1xuICBrZXlzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmNhY2hlLmtleXMoKSk7XG4gIH1cblxuICAvKipcbiAgICogQ2xlYW51cCBleHBpcmVkIGVudHJpZXNcbiAgICovXG4gIGNsZWFudXAoKTogbnVtYmVyIHtcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IGV4cGlyZWRLZXlzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBba2V5LCBlbnRyeV0gb2YgdGhpcy5jYWNoZS5lbnRyaWVzKCkpIHtcbiAgICAgIGlmIChub3cgPiBlbnRyeS5leHBpcmVzQXQpIHtcbiAgICAgICAgZXhwaXJlZEtleXMucHVzaChrZXkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoY29uc3Qga2V5IG9mIGV4cGlyZWRLZXlzKSB7XG4gICAgICB0aGlzLmNhY2hlLmRlbGV0ZShrZXkpO1xuICAgIH1cblxuICAgIHJldHVybiBleHBpcmVkS2V5cy5sZW5ndGg7XG4gIH1cblxuICAvKipcbiAgICogRXZpY3QgdGhlIGxlYXN0IHJlY2VudGx5IHVzZWQgZW50cnkgKGZpcnN0IGl0ZW0gaW4gTWFwKVxuICAgKi9cbiAgcHJpdmF0ZSBldmljdExSVSgpOiB2b2lkIHtcbiAgICBjb25zdCBmaXJzdEtleSA9IHRoaXMuY2FjaGUua2V5cygpLm5leHQoKS52YWx1ZTtcbiAgICBpZiAoZmlyc3RLZXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jYWNoZS5kZWxldGUoZmlyc3RLZXkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY2FjaGUgc3RhdGlzdGljc1xuICAgKi9cbiAgZ2V0U3RhdHMoKToge1xuICAgIHNpemU6IG51bWJlcjtcbiAgICBtYXhTaXplOiBudW1iZXI7XG4gICAgZGVmYXVsdFR0bDogbnVtYmVyO1xuICB9IHtcbiAgICByZXR1cm4ge1xuICAgICAgc2l6ZTogdGhpcy5jYWNoZS5zaXplLFxuICAgICAgbWF4U2l6ZTogdGhpcy5tYXhTaXplLFxuICAgICAgZGVmYXVsdFR0bDogdGhpcy5kZWZhdWx0VHRsLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogRGVzdHJveSB0aGUgY2FjaGUgYW5kIGNsZWFudXAgcmVzb3VyY2VzXG4gICAqL1xuICBkZXN0cm95KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmNsZWFudXBUaW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmNsZWFudXBUaW1lcik7XG4gICAgfVxuICAgIHRoaXMuY2FjaGUuY2xlYXIoKTtcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZSBhIHNpbXBsZSBMUlUgY2FjaGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxSVUNhY2hlPFQ+KFxuICBtYXhTaXplOiBudW1iZXIgPSAxMDAwXG4pOiBDYWNoZTxUPiB7XG4gIHJldHVybiBuZXcgQ2FjaGU8VD4oeyBtYXhTaXplLCB0dGw6IEluZmluaXR5LCBjbGVhbnVwSW50ZXJ2YWw6IDAgfSk7XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgc2ltcGxlIFRUTCBjYWNoZSB3aXRob3V0IExSVSBldmljdGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVFRMQ2FjaGU8VD4oXG4gIHR0bDogbnVtYmVyID0gMzYwMDAwMFxuKTogQ2FjaGU8VD4ge1xuICByZXR1cm4gbmV3IENhY2hlPFQ+KHsgbWF4U2l6ZTogSW5maW5pdHksIHR0bCwgY2xlYW51cEludGVydmFsOiA2MDAwMCB9KTtcbn1cbiJdfQ==