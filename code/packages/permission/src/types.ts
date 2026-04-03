/**
 * @fileoverview Type definitions for the permission system
 * @module @openagent/permission/types
 */

/**
 * Role interface for RBAC model
 */
export interface Role {
  /** Unique role identifier */
  id: string;
  /** Role name */
  name: string;
  /** Role description */
  description?: string;
  /** List of permissions assigned to this role */
  permissions: Permission[];
  /** Role IDs this role inherits from */
  inherits?: string[];
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Role creation timestamp */
  createdAt: Date;
  /** Role last update timestamp */
  updatedAt: Date;
}

/**
 * Permission interface for fine-grained access control
 */
export interface Permission {
  /** Unique permission identifier */
  id: string;
  /** Resource identifier pattern (e.g., tool:*, session:*, file:/path/*) */
  resource: string;
  /** Action type (read, write, execute, delete) */
  action: string;
  /** Optional conditions for this permission */
  conditions?: Condition[];
  /** Permission effect (allow or deny) */
  effect: 'allow' | 'deny';
}

/**
 * Condition for conditional permissions
 */
export interface Condition {
  /** Condition type */
  type: 'time' | 'ip' | 'attribute' | 'custom';
  /** Comparison operator */
  operator: 'eq' | 'ne' | 'in' | 'not_in' | 'between';
  /** Condition value (structure depends on type and operator) */
  value: any;
}

/**
 * User interface
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email?: string;
  /** User display name */
  name?: string;
  /** List of role IDs assigned to this user */
  roles: string[];
  /** User attributes (department, title, etc.) */
  attributes?: Record<string, any>;
  /** API keys associated with this user */
  apiKeys?: APIKey[];
  /** User creation timestamp */
  createdAt: Date;
  /** User last update timestamp */
  updatedAt: Date;
}

/**
 * API Key interface
 */
export interface APIKey {
  /** Unique API key identifier */
  id: string;
  /** User ID this key belongs to */
  userId: string;
  /** Encrypted key value */
  key: string;
  /** Human-readable key name */
  name: string;
  /** Permission scopes for this key */
  scopes: string[];
  /** Key expiration date */
  expiresAt?: Date;
  /** Last usage timestamp */
  lastUsedAt?: Date;
  /** Key creation timestamp */
  createdAt: Date;
}

/**
 * Resource interface
 */
export interface Resource {
  /** Unique resource identifier */
  id: string;
  /** Resource type (tool, session, file, api) */
  type: string;
  /** Resource name */
  name: string;
  /** Resource attributes */
  attributes?: Record<string, any>;
  /** Resource owner ID */
  ownerId?: string;
  /** Resource creation timestamp */
  createdAt: Date;
}

/**
 * Audit log entry
 */
export interface AuditLog {
  /** Unique audit log identifier */
  id: string;
  /** User ID performing the action */
  userId: string;
  /** Action performed */
  action: string;
  /** Resource accessed */
  resource: string;
  /** Access result */
  result: 'allow' | 'deny';
  /** Reason for denial (if applicable) */
  reason?: string;
  /** Client IP address */
  ip?: string;
  /** Client user agent */
  userAgent?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Log timestamp */
  timestamp: Date;
}

/**
 * Permission configuration
 */
export interface PermissionConfig {
  /** Database configuration */
  database: DatabaseConfig;
  /** Cache configuration */
  cache?: CacheConfig;
  /** Audit logger configuration */
  audit?: AuditLoggerConfig;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /** Database type */
  type: 'sqlite' | 'postgresql' | 'mysql';
  /** Database file path (for SQLite) */
  file?: string;
  /** Database URL (for PostgreSQL/MySQL) */
  url?: string;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Enable caching */
  enabled: boolean;
  /** Cache TTL in milliseconds */
  ttl: number;
  /** Maximum cache size */
  maxSize?: number;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  /** Flush interval in milliseconds */
  flushInterval?: number;
  /** Buffer size before flush */
  bufferSize?: number;
  /** Enable audit logging */
  enabled?: boolean;
}

/**
 * Policy engine configuration
 */
export interface PolicyEngineConfig {
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
}

/**
 * Permission check context
 */
export interface PermissionContext {
  /** Client IP address */
  ip?: string;
  /** Client user agent */
  userAgent?: string;
  /** Current time (for time-based conditions) */
  currentTime?: Date;
  /** Additional context data */
  [key: string]: any;
}

/**
 * Evaluation context for policy engine
 */
export interface EvaluationContext extends PermissionContext {
  /** User being evaluated */
  user: User;
}

/**
 * Permission check result
 */
export interface PermissionResult {
  /** Whether the permission is allowed */
  allowed: boolean;
  /** Reason for denial (if applicable) */
  reason?: string;
}

/**
 * Audit log filter for queries
 */
export interface AuditLogFilter {
  /** Filter by user ID */
  userId?: string;
  /** Filter by action */
  action?: string;
  /** Filter by resource */
  resource?: string;
  /** Filter by result */
  result?: 'allow' | 'deny';
  /** Start time filter */
  startTime?: Date;
  /** End time filter */
  endTime?: Date;
  /** Maximum number of results */
  limit?: number;
}

/**
 * SAML configuration
 */
export interface SAMLConfig {
  /** Identity provider entry point URL */
  entryPoint: string;
  /** Service provider callback URL */
  callbackUrl: string;
  /** Identity provider issuer */
  issuer: string;
  /** Identity provider certificate */
  cert: string;
  /** Additional SAML options */
  [key: string]: any;
}

/**
 * SAML user profile
 */
export interface SAMLUser {
  /** User ID (nameID) */
  id: string;
  /** User email */
  email?: string;
  /** User display name */
  name?: string;
  /** Additional attributes */
  attributes?: Record<string, any>;
}

/**
 * OIDC configuration
 */
export interface OIDCConfig {
  /** OIDC issuer URL */
  issuer: string;
  /** Client ID */
  client_id: string;
  /** Client secret */
  client_secret: string;
  /** Redirect URIs */
  redirect_uris: string[];
}

/**
 * OIDC user profile
 */
export interface OIDCUser {
  /** User subject ID */
  id: string;
  /** User email */
  email?: string;
  /** User name */
  name?: string;
  /** Additional attributes */
  attributes?: Record<string, any>;
}

/**
 * API Key configuration
 */
export interface APIKeyConfig {
  /** Database configuration */
  database: DatabaseConfig;
  /** Encryption key for API keys */
  encryptionKey: string;
}

/**
 * Role manager configuration
 */
export interface RoleManagerConfig {
  /** Database configuration */
  database: DatabaseConfig;
}

/**
 * Resource manager configuration
 */
export interface ResourceManagerConfig {
  /** Database configuration */
  database: DatabaseConfig;
}
