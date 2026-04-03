/**
 * @fileoverview OpenAgent Permission System - Enterprise-grade RBAC implementation
 * @module @openagent/permission
 */

// Core types
export * from './types';

// Permission Manager - Main entry point
export { PermissionManager } from './permission-manager';

// Role Manager
export { RoleManager } from './role-manager';

// Policy Engine
export { PolicyEngine } from './policy-engine';

// Audit Logger
export { AuditLogger, AuditLogFormatter } from './audit-logger';

// Resource Manager
export { ResourceManager } from './resource-manager';

// SSO Integration
export { SAMLAuth } from './sso/saml';
export { OIDCAuth } from './sso/oidc';
export { APIKeyManager } from './sso/api-key';
