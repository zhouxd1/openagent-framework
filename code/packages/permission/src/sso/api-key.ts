/**
 * @fileoverview API Key management
 * @module @openagent/permission/sso/api-key
 */

import { v4 as uuidv4 } from 'uuid';
import {
  APIKey,
  APIKeyConfig,
} from '../types';
import * as crypto from 'crypto';

/**
 * Simple encryption utility for API keys
 */
class EncryptionUtil {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor(encryptionKey: string) {
    // Derive a 32-byte key from the provided encryption key
    this.key = crypto.createHash('sha256').update(encryptionKey).digest();
  }

  /**
   * Encrypt a value
   */
  async encrypt(plaintext: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt a value
   */
  async decrypt(ciphertext: string): Promise<string> {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}

/**
 * API Key manager for creating and validating API keys
 * 
 * @example
 * ```typescript
 * const apiKeyManager = new APIKeyManager({
 *   database: { type: 'postgresql', url: process.env.DATABASE_URL },
 *   encryptionKey: process.env.ENCRYPTION_KEY
 * });
 * 
 * // Create API key
 * const { id, key } = await apiKeyManager.createKey(
 *   'user_123',
 *   'My API Key',
 *   ['read:files', 'write:files'],
 *   30 * 24 * 60 * 60 * 1000 // 30 days
 * );
 * 
 * // Validate API key
 * const user = await apiKeyManager.validateKey(key);
 * ```
 */
export class APIKeyManager {
  private apiKeys: Map<string, APIKey> = new Map();
  private encryption: EncryptionUtil;
  private config: APIKeyConfig;

  constructor(config: APIKeyConfig) {
    this.config = config;
    this.encryption = new EncryptionUtil(config.encryptionKey);
  }

  /**
   * Create a new API key
   * 
   * @param userId - User ID to associate with the key
   * @param name - Human-readable name for the key
   * @param scopes - Permission scopes for this key
   * @param expiresIn - Optional expiration time in milliseconds
   * @returns Object containing key ID and the raw key (shown only once)
   * 
   * @example
   * ```typescript
   * const { id, key } = await apiKeyManager.createKey(
   *   'user_123',
   *   'CI/CD Key',
   *   ['read:repos', 'write:repos'],
   *   365 * 24 * 60 * 60 * 1000 // 1 year
   * );
   * 
   * console.log('Save this key:', key); // Show only once!
   * ```
   */
  async createKey(
    userId: string,
    name: string,
    scopes: string[],
    expiresIn?: number
  ): Promise<{ id: string; key: string }> {
    const id = this.generateId();
    const rawKey = this.generateKey();
    const encryptedKey = await this.encryption.encrypt(rawKey);

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn)
      : undefined;

    const apiKey: APIKey = {
      id,
      userId,
      key: encryptedKey,
      name,
      scopes,
      expiresAt,
      createdAt: new Date(),
    };

    this.apiKeys.set(id, apiKey);

    return { id, key: rawKey };
  }

  /**
   * Validate an API key and return the associated user
   * 
   * @param key - Raw API key to validate
   * @returns User object if valid, null otherwise
   * 
   * @example
   * ```typescript
   * const user = await apiKeyManager.validateKey('sk_abc123...');
   * if (user) {
   *   console.log('Authenticated as:', user.email);
   * } else {
   *   console.log('Invalid or expired API key');
   * }
   * ```
   */
  async validateKey(key: string): Promise<{ userId: string; scopes: string[] } | null> {
    // Iterate through all stored API keys
    for (const [id, apiKey] of this.apiKeys.entries()) {
      try {
        const decrypted = await this.encryption.decrypt(apiKey.key);

        if (decrypted === key) {
          // Check expiration
          if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            // Key has expired
            this.apiKeys.delete(id);
            return null;
          }

          // Update last used time
          apiKey.lastUsedAt = new Date();
          this.apiKeys.set(id, apiKey);

          return {
            userId: apiKey.userId,
            scopes: apiKey.scopes,
          };
        }
      } catch (error) {
        // Decryption failed, skip this key
        continue;
      }
    }

    return null;
  }

  /**
   * Revoke an API key
   * 
   * @param keyId - API key ID to revoke
   * 
   * @example
   * ```typescript
   * await apiKeyManager.revokeKey('key_123');
   * ```
   */
  async revokeKey(keyId: string): Promise<void> {
    this.apiKeys.delete(keyId);
  }

  /**
   * List all API keys for a user
   * 
   * @param userId - User ID
   * @returns Array of API keys (without the actual key value)
   */
  async listKeys(userId: string): Promise<Omit<APIKey, 'key'>[]> {
    const keys: Omit<APIKey, 'key'>[] = [];

    for (const apiKey of this.apiKeys.values()) {
      if (apiKey.userId === userId) {
        const { key, ...keyWithoutValue } = apiKey;
        keys.push(keyWithoutValue);
      }
    }

    return keys;
  }

  /**
   * Get API key by ID
   * 
   * @param keyId - API key ID
   * @returns API key without the actual key value
   */
  async getKey(keyId: string): Promise<Omit<APIKey, 'key'> | undefined> {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) return undefined;

    const { key, ...keyWithoutValue } = apiKey;
    return keyWithoutValue;
  }

  /**
   * Update API key scopes
   * 
   * @param keyId - API key ID
   * @param scopes - New scopes
   */
  async updateScopes(keyId: string, scopes: string[]): Promise<void> {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    apiKey.scopes = scopes;
    this.apiKeys.set(keyId, apiKey);
  }

  /**
   * Delete all API keys for a user
   * 
   * @param userId - User ID
   */
  async deleteAllUserKeys(userId: string): Promise<void> {
    for (const [id, apiKey] of this.apiKeys.entries()) {
      if (apiKey.userId === userId) {
        this.apiKeys.delete(id);
      }
    }
  }

  /**
   * Clean up expired API keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    let deletedCount = 0;
    const now = new Date();

    for (const [id, apiKey] of this.apiKeys.entries()) {
      if (apiKey.expiresAt && apiKey.expiresAt < now) {
        this.apiKeys.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Generate unique API key ID
   */
  private generateId(): string {
    return `key_${Date.now()}_${uuidv4().replace(/-/g, '').substr(0, 9)}`;
  }

  /**
   * Generate random API key
   */
  private generateKey(): string {
    const randomBytes = crypto.randomBytes(32);
    // Use base64url encoding (no special chars)
    return `sk_${randomBytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
  }

  /**
   * Get API key statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    keysByUser: Record<string, number>;
  }> {
    const now = new Date();
    let activeKeys = 0;
    let expiredKeys = 0;
    const keysByUser: Record<string, number> = {};

    for (const apiKey of this.apiKeys.values()) {
      // Count by user
      keysByUser[apiKey.userId] = (keysByUser[apiKey.userId] || 0) + 1;

      // Count active/expired
      if (apiKey.expiresAt && apiKey.expiresAt < now) {
        expiredKeys++;
      } else {
        activeKeys++;
      }
    }

    return {
      totalKeys: this.apiKeys.size,
      activeKeys,
      expiredKeys,
      keysByUser,
    };
  }
}
