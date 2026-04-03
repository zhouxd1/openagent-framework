# @openagent/permission

Enterprise-grade permission system for OpenAgent Framework.

## Features

- ✅ **RBAC (Role-Based Access Control)** - Flexible role and permission management
- ✅ **Fine-grained permissions** - Resource and action-level access control
- ✅ **Role inheritance** - Hierarchical role structure with permission inheritance
- ✅ **Conditional permissions** - Time-based, IP-based, and attribute-based conditions
- ✅ **Audit logging** - Comprehensive audit trail with export capabilities
- ✅ **SSO integration** - SAML and OIDC support for enterprise authentication
- ✅ **API Key management** - Secure API key creation and validation
- ✅ **Type-safe** - Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @openagent/permission
```

## Quick Start

### Basic Usage

```typescript
import { PermissionManager } from '@openagent/permission';

const manager = new PermissionManager({
  database: {
    type: 'postgresql',
    url: process.env.DATABASE_URL,
  },
});

// Create role
const adminRole = await manager.createRole({
  name: 'admin',
  description: 'Administrator with full access',
  permissions: [
    { 
      id: 'perm_admin_all',
      resource: 'tool:*', 
      action: '*', 
      effect: 'allow' 
    },
  ],
});

// Create user
const user = await manager.createUser({
  email: 'admin@example.com',
  name: 'Admin User',
  roles: [adminRole.id],
});

// Check permission
const result = await manager.checkPermission(
  user.id,
  'tool:shell',
  'execute'
);

console.log(result.allowed); // true
```

### Role-Based Access Control (RBAC)

#### Creating Roles

```typescript
// Create a role with specific permissions
const editorRole = await manager.createRole({
  name: 'editor',
  description: 'Content editor',
  permissions: [
    {
      id: 'perm_editor_read',
      resource: 'content:*',
      action: 'read',
      effect: 'allow',
    },
    {
      id: 'perm_editor_write',
      resource: 'content:drafts',
      action: 'write',
      effect: 'allow',
    },
  ],
});
```

#### Role Inheritance

```typescript
// Create base role
const userRole = await manager.createRole({
  name: 'user',
  permissions: [
    {
      id: 'perm_user_read',
      resource: 'content:*',
      action: 'read',
      effect: 'allow',
    },
  ],
});

// Create derived role that inherits from base
const powerUserRole = await manager.createRole({
  name: 'power_user',
  permissions: [
    {
      id: 'perm_power_write',
      resource: 'content:drafts',
      action: 'write',
      effect: 'allow',
    },
  ],
  inherits: [userRole.id], // Inherits all permissions from user role
});

// Power user now has both read and write permissions
```

### Resource Patterns

The permission system supports flexible resource patterns:

```typescript
// Exact match
resource: 'tool:shell'           // Matches only tool:shell

// Wildcard match
resource: 'tool:*'               // Matches all tools (tool:shell, tool:file, etc.)
resource: 'file:/data/*'         // Matches all files under /data
resource: '*'                    // Matches everything

// Multiple actions
action: 'read'                   // Only read action
action: 'read,write,delete'      // Multiple specific actions
action: '*'                      // All actions
```

### Conditional Permissions

#### Time-Based Conditions

```typescript
const businessHoursRole = await manager.createRole({
  name: 'business_hours_user',
  permissions: [
    {
      id: 'perm_time',
      resource: 'tool:*',
      action: 'execute',
      effect: 'allow',
      conditions: [
        {
          type: 'time',
          operator: 'between',
          value: [540, 1080], // 9:00 AM - 6:00 PM (in minutes from midnight)
        },
      ],
    },
  ],
});
```

#### IP-Based Conditions

```typescript
const officeOnlyRole = await manager.createRole({
  name: 'office_only',
  permissions: [
    {
      id: 'perm_ip',
      resource: 'sensitive:*',
      action: '*',
      effect: 'allow',
      conditions: [
        {
          type: 'ip',
          operator: 'in',
          value: ['192.168.1.100', '192.168.1.101'], // Only these IPs
        },
      ],
    },
  ],
});
```

#### Attribute-Based Conditions

```typescript
const engineeringOnlyRole = await manager.createRole({
  name: 'engineering_only',
  permissions: [
    {
      id: 'perm_attr',
      resource: 'internal:*',
      action: '*',
      effect: 'allow',
      conditions: [
        {
          type: 'attribute',
          operator: 'eq',
          value: {
            attribute: 'department',
            value: 'engineering',
          },
        },
      ],
    },
  ],
});

// User must have department attribute set to 'engineering'
const engineer = await manager.createUser({
  email: 'engineer@example.com',
  roles: [engineeringOnlyRole.id],
  attributes: {
    department: 'engineering',
  },
});
```

### Deny Permissions

Explicit deny permissions take precedence over allow permissions:

```typescript
const restrictedRole = await manager.createRole({
  name: 'restricted',
  permissions: [
    // Allow all tools
    {
      id: 'perm_allow',
      resource: 'tool:*',
      action: '*',
      effect: 'allow',
    },
    // But deny shell execute
    {
      id: 'perm_deny',
      resource: 'tool:shell',
      action: 'execute',
      effect: 'deny',
    },
  ],
});
```

### Permission Checks

```typescript
// Basic permission check
const result = await manager.checkPermission(
  userId,
  'tool:shell',
  'execute'
);

if (result.allowed) {
  console.log('Access granted');
} else {
  console.log('Access denied:', result.reason);
}

// Permission check with context
const contextResult = await manager.checkPermission(
  userId,
  'sensitive:data',
  'read',
  {
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
    currentTime: new Date(),
  }
);
```

### Audit Logging

```typescript
// Query audit logs
const logs = await manager.queryAuditLogs({
  userId: 'user_123',
  action: 'execute',
  result: 'deny',
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-12-31'),
  limit: 100,
});

// Export audit logs
const jsonExport = await manager.exportAuditLogs('json');
const csvExport = await manager.exportAuditLogs('csv');

// Get audit statistics
const stats = await manager.getAuditStats();
console.log('Total logs:', stats.totalLogs);
console.log('Allow count:', stats.allowCount);
console.log('Deny count:', stats.denyCount);
console.log('Top actions:', stats.topActions);
```

### SSO Integration

#### SAML

```typescript
import { SAMLAuth } from '@openagent/permission';

const samlAuth = new SAMLAuth({
  entryPoint: 'https://idp.example.com/saml/sso',
  callbackUrl: 'https://myapp.com/auth/saml/callback',
  issuer: 'myapp',
  cert: 'IDP_CERTIFICATE',
});

// Get login URL
const loginUrl = await samlAuth.getLoginURL(redirectUrl);

// Validate SAML response
const user = await samlAuth.validateResponse(samlResponse);
console.log(user.email, user.name);
```

#### OIDC

```typescript
import { OIDCAuth } from '@openagent/permission';

const oidcAuth = new OIDCAuth({
  issuer: 'https://auth.example.com',
  client_id: 'your_client_id',
  client_secret: 'your_client_secret',
  redirect_uris: ['https://myapp.com/auth/callback'],
});

// Get authorization URL
const authUrl = await oidcAuth.getAuthorizationURL(redirectUrl);

// Exchange code for tokens
const user = await oidcAuth.exchangeToken(code, redirectUrl);
console.log(user.email, user.name);
```

### API Key Management

```typescript
import { APIKeyManager } from '@openagent/permission';

const apiKeyManager = new APIKeyManager({
  database: { type: 'postgresql', url: process.env.DATABASE_URL },
  encryptionKey: process.env.ENCRYPTION_KEY, // 32-byte key
});

// Create API key
const { id, key } = await apiKeyManager.createKey(
  userId,
  'CI/CD Key',
  ['read:repos', 'write:repos'],
  365 * 24 * 60 * 60 * 1000 // 1 year expiration
);

console.log('API Key:', key); // Show only once!

// Validate API key
const validatedUser = await apiKeyManager.validateKey(key);
if (validatedUser) {
  console.log('User ID:', validatedUser.userId);
  console.log('Scopes:', validatedUser.scopes);
}

// Revoke API key
await apiKeyManager.revokeKey(id);
```

## Architecture

### RBAC Model

The permission system implements a hierarchical RBAC model:

```
User
  └─ Roles
       └─ Permissions
            ├─ Resource (what)
            ├─ Action (how)
            ├─ Effect (allow/deny)
            └─ Conditions (when/where)
```

### Components

- **PermissionManager**: Main entry point for all permission operations
- **RoleManager**: Manages roles and users
- **PolicyEngine**: Evaluates permissions and conditions
- **AuditLogger**: Records all permission checks
- **ResourceManager**: Manages protected resources
- **SSO Providers**: SAML and OIDC integration
- **APIKeyManager**: API key lifecycle management

## API Reference

### PermissionManager

#### `checkPermission(userId, resource, action, context?)`
Check if a user has permission to perform an action on a resource.

#### `createRole(roleData)`
Create a new role.

#### `createUser(userData)`
Create a new user.

#### `grantRole(userId, roleId, grantedBy)`
Grant a role to a user.

#### `revokeRole(userId, roleId, revokedBy)`
Revoke a role from a user.

#### `getUser(userId)`
Get user by ID.

#### `getUserByEmail(email)`
Get user by email.

#### `getRole(roleId)`
Get role by ID.

#### `listRoles()`
List all roles.

#### `queryAuditLogs(filter)`
Query audit logs.

#### `exportAuditLogs(format)`
Export audit logs (json or csv).

## Testing

```bash
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
```

## Configuration

### Database Configuration

```typescript
{
  database: {
    type: 'postgresql', // or 'mysql', 'sqlite'
    url: 'postgresql://user:pass@host:port/db',
    // For SQLite:
    // file: './database.sqlite'
  }
}
```

### Cache Configuration

```typescript
{
  cache: {
    enabled: true,
    ttl: 60000,        // Cache TTL in milliseconds
    maxSize: 1000      // Maximum cache size
  }
}
```

### Audit Logger Configuration

```typescript
{
  audit: {
    enabled: true,
    flushInterval: 5000,  // Flush buffer every 5 seconds
    bufferSize: 100       // Buffer size before auto-flush
  }
}
```

## Best Practices

1. **Principle of Least Privilege**: Grant only the minimum permissions needed
2. **Use Role Inheritance**: Build hierarchical role structures
3. **Explicit Deny**: Use deny permissions for sensitive resources
4. **Audit Everything**: Enable audit logging in production
5. **Regular Reviews**: Periodically review roles and permissions
6. **Secure API Keys**: Rotate API keys regularly
7. **Conditional Permissions**: Use conditions for additional security layers

## Security Considerations

- API keys are encrypted at rest using AES-256-GCM
- Passwords should never be stored (use SSO instead)
- Audit logs are immutable
- Permission checks are logged for accountability
- Cache is invalidated on permission changes

## Documentation

See [docs/permission.md](../../docs/permission.md) for full documentation.

## License

MIT
