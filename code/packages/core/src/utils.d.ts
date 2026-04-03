/**
 * Utility functions for OpenAgent Framework
 */
import { JSONObject } from './types';
/**
 * Generate a unique ID
 */
export declare function generateId(): string;
/**
 * Deep clone an object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Safely parse JSON
 */
export declare function safeJsonParse<T>(str: string, fallback: T): T;
/**
 * Safely stringify JSON
 */
export declare function safeJsonStringify(obj: unknown): string | null;
/**
 * Delay execution
 */
export declare function delay(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, options?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
}): Promise<T>;
/**
 * Check if a value is a valid JSON string
 */
export declare function isValidJson(str: string): boolean;
/**
 * Format timestamp to ISO string
 */
export declare function formatTimestamp(date: Date): string;
/**
 * Parse timestamp from ISO string
 */
export declare function parseTimestamp(isoString: string): Date;
/**
 * Calculate TTL expiration time
 */
export declare function calculateExpiration(ttlSeconds: number): Date;
/**
 * Check if a timestamp is expired
 */
export declare function isExpired(timestamp: Date): boolean;
/**
 * Truncate string to specified length
 */
export declare function truncate(str: string, maxLength: number): string;
/**
 * Merge objects deeply
 */
export declare function deepMerge<T extends JSONObject>(target: T, source: Partial<T>): T;
/**
 * Remove undefined and null values from object
 */
export declare function removeNullish<T extends JSONObject>(obj: T): Partial<T>;
/**
 * Type guard for checking if value is a string
 */
export declare function isString(value: unknown): value is string;
/**
 * Type guard for checking if value is a number
 */
export declare function isNumber(value: unknown): value is number;
/**
 * Type guard for checking if value is a boolean
 */
export declare function isBoolean(value: unknown): value is boolean;
/**
 * Type guard for checking if value is an object (not null, not array)
 */
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
/**
 * Type guard for checking if value is an array
 */
export declare function isArray(value: unknown): value is unknown[];
/**
 * Safely get a nested property from an object
 */
export declare function getNestedValue<T = unknown>(obj: Record<string, unknown>, path: string, defaultValue?: T): T | undefined;
