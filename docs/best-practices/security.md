# 安全最佳实践

本文档提供 OpenAgent Framework 安全开发的最佳实践，包括权限控制、敏感数据处理、审计日志和常见安全问题防护。

---

## 📋 目录

1. [权限控制](#权限控制)
2. [敏感数据处理](#敏感数据处理)
3. [审计日志](#审计日志)
4. [常见安全问题](#常见安全问题)
5. [安全配置](#安全配置)

---

## 🔐 权限控制

### RBAC 实现

```typescript
// RBAC 权限系统
class RBACSystem {
  private roles: Map<string, RoleDefinition> = new Map();
  private userRoles: Map<string, string[]> = new Map();
  
  constructor() {
    this.initializeRoles();
  }
  
  /**
   * 初始化角色定义
   */
  private initializeRoles(): void {
    // 超级管理员
    this.roles.set('super_admin', {
      permissions: ['*'],
      description: 'Full system access',
    });
    
    // 管理员
    this.roles.set('admin', {
      permissions: [
        'agent:*',
        'tool:*',
        'user:read',
        'user:update',
        'session:*',
        'analytics:read',
      ],
      description: 'Administrative access',
    });
    
    // 开发者
    this.roles.set('developer', {
      permissions: [
        'agent:create',
        'agent:read',
        'agent:update',
        'tool:create',
        'tool:read',
        'tool:execute',
      ],
      description: 'Developer access',
    });
    
    // 普通用户
    this.roles.set('user', {
      permissions: [
        'agent:read',
        'tool:execute',
        'session:create',
        'session:read',
      ],
      description: 'Standard user access',
    });
  }
  
  /**
   * 检查权限
   */
  hasPermission(
    userId: string,
    permission: string
  ): boolean {
    const roles = this.userRoles.get(userId) || [];
    
    for (const roleName of roles) {
      const role = this.roles.get(roleName);
      if (!role) continue;
      
      if (this.matchPermission(role.permissions, permission)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 分配角色
   */
  assignRole(userId: string, role: string): void {
    if (!this.roles.has(role)) {
      throw new Error(`Invalid role: ${role}`);
    }
    
    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, []);
    }
    
    const roles = this.userRoles.get(userId)!;
    if (!roles.includes(role)) {
      roles.push(role);
    }
  }
  
  /**
   * 移除角色
   */
  removeRole(userId: string, role: string): void {
    const roles = this.userRoles.get(userId);
    if (roles) {
      const index = roles.indexOf(role);
      if (index > -1) {
        roles.splice(index, 1);
      }
    }
  }
  
  /**
   * 权限匹配
   */
  private matchPermission(
    permissions: string[],
    required: string
  ): boolean {
    for (const permission of permissions) {
      if (permission === '*') {
        return true;
      }
      
      // 支持通配符
      if (permission.endsWith(':*')) {
        const prefix = permission.slice(0, -2);
        if (required.startsWith(prefix + ':')) {
          return true;
        }
      }
      
      if (permission === required) {
        return true;
      }
    }
    
    return false;
  }
}

interface RoleDefinition {
  permissions: string[];
  description: string;
}

// 使用 RBAC
const rbac = new RBACSystem();

// 分配角色
rbac.assignRole('user-123', 'developer');

// 检查权限
if (rbac.hasPermission('user-123', 'tool:create')) {
  // 允许创建工具
}
```

### 权限中间件

```typescript
// 权限检查中间件
function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!rbac.hasPermission(userId, permission)) {
      return res.status(403).json({ 
        error: 'Permission denied',
        required: permission,
      });
    }
    
    next();
  };
}

// 应用到路由
app.post(
  '/api/tools',
  requirePermission('tool:create'),
  async (req, res) => {
    // 创建工具
  }
);

app.delete(
  '/api/agents/:id',
  requirePermission('agent:delete'),
  async (req, res) => {
    // 删除 Agent
  }
);
```

---

## 🔒 敏感数据处理

### 数据加密

```typescript
// 加密工具
import crypto from 'crypto';

class Encryption {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;
  
  constructor(encryptionKey: string) {
    // 从 base64 编码的密钥派生
    this.key = crypto.scryptSync(
      encryptionKey,
      'salt',
      32
    );
  }
  
  /**
   * 加密数据
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.key,
      iv
    );
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // 返回格式: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  /**
   * 解密数据
   */
  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      iv
    );
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * 哈希数据（不可逆）
   */
  hash(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }
}

// 使用加密
const encryption = new Encryption(process.env.ENCRYPTION_KEY!);

// 加密敏感数据
const encrypted = encryption.encrypt('sensitive-data');

// 解密
const decrypted = encryption.decrypt(encrypted);

// 哈希（用于密码等）
const passwordHash = encryption.hash('user-password');
```

### 日志脱敏

```typescript
// 日志脱敏处理器
class LogSanitizer {
  private sensitiveFields = [
    'password',
    'token',
    'apiKey',
    'api_key',
    'secret',
    'authorization',
    'creditCard',
    'credit_card',
    'ssn',
  ];
  
  /**
   * 脱敏对象
   */
  sanitize(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item));
    }
    
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // 检查是否为敏感字段
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = this.maskValue(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  /**
   * 遮蔽值
   */
  private maskValue(value: any): string {
    if (typeof value !== 'string') {
      return '***REDACTED***';
    }
    
    if (value.length <= 8) {
      return '***';
    }
    
    // 保留前3位和后2位
    return value.slice(0, 3) + '***' + value.slice(-2);
  }
}

// 使用脱敏器
const sanitizer = new LogSanitizer();

// 敏感数据
const userData = {
  username: 'john',
  password: 'secret123',
  email: 'john@example.com',
  apiKey: 'sk-1234567890abcdef',
};

// 脱敏后
const safeData = sanitizer.sanitize(userData);
console.log(safeData);
// {
//   username: 'john',
//   password: 'sec***23',
//   email: 'john@example.com',
//   apiKey: 'sk-***ef'
// }
```

### 环境变量管理

```typescript
// .env.example
# 必需的环境变量
NODE_ENV=production
PORT=3000

# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379

# 加密密钥
ENCRYPTION_KEY=your-256-bit-encryption-key

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# LLM API Keys（使用加密存储）
OPENAI_API_KEY_ENCRYPTED=encrypted-key-here
ANTHROPIC_API_KEY_ENCRYPTED=encrypted-key-here

# 其他
LOG_LEVEL=info
```

```typescript
// 环境变量验证
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number),
  
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  
  ENCRYPTION_KEY: z.string().min(32),
  
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string(),
  
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
});

// 验证环境变量
const env = envSchema.parse(process.env);

export default env;
```

---

## 📝 审计日志

### 审计日志系统

```typescript
// 审计日志记录器
class AuditLogger {
  private db: Database;
  private logger: Logger;
  
  constructor() {
    this.db = new Database();
    this.logger = createLogger('audit');
  }
  
  /**
   * 记录审计日志
   */
  async log(entry: AuditEntry): Promise<void> {
    // 添加时间戳
    const auditLog: AuditLog = {
      id: generateId(),
      timestamp: new Date(),
      ...entry,
    };
    
    // 保存到数据库
    await this.db.query(
      `INSERT INTO audit_logs 
       (id, timestamp, user_id, action, resource, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        auditLog.id,
        auditLog.timestamp,
        auditLog.userId,
        auditLog.action,
        auditLog.resource,
        JSON.stringify(auditLog.details),
        auditLog.ipAddress,
        auditLog.userAgent,
      ]
    );
    
    // 同时写入日志文件
    this.logger.info('Audit log', auditLog);
  }
  
  /**
   * 查询审计日志
   */
  async query(filters: AuditFilters): Promise<AuditLog[]> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (filters.userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(filters.userId);
    }
    
    if (filters.action) {
      query += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }
    
    if (filters.startDate) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT 1000';
    
    const result = await this.db.query(query, params);
    
    return result.rows.map(this.mapRowToAuditLog);
  }
  
  /**
   * 记录工具调用
   */
  async logToolCall(
    userId: string,
    toolName: string,
    params: any,
    result: any,
    context: RequestContext
  ): Promise<void> {
    await this.log({
      userId,
      action: 'tool_execute',
      resource: `tool:${toolName}`,
      details: {
        params: this.sanitizeParams(params),
        success: result.success,
        error: result.error,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
  
  /**
   * 记录敏感操作
   */
  async logSensitiveAction(
    userId: string,
    action: string,
    resource: string,
    context: RequestContext
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      details: {
        sensitive: true,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
  
  private mapRowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      timestamp: row.timestamp,
      userId: row.user_id,
      action: row.action,
      resource: row.resource,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    };
  }
  
  private sanitizeParams(params: any): any {
    return sanitizer.sanitize(params);
  }
}

interface AuditEntry {
  userId: string;
  action: string;
  resource: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditLog extends AuditEntry {
  id: string;
  timestamp: Date;
}

interface AuditFilters {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
}

// 创建审计表
const createAuditTable = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  INDEX idx_user_id (user_id),
  INDEX idx_timestamp (timestamp DESC),
  INDEX idx_action (action)
);
`;
```

### 审计中间件

```typescript
// 审计中间件
function auditMiddleware(auditLogger: AuditLogger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // 监听响应完成
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      
      // 只记录重要操作
      if (req.method !== 'GET' || res.statusCode >= 400) {
        await auditLogger.log({
          userId: req.user?.id || 'anonymous',
          action: `${req.method}:${req.path}`,
          resource: req.path,
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            body: sanitizer.sanitize(req.body),
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      }
    });
    
    next();
  };
}

// 应用审计中间件
app.use(auditMiddleware(auditLogger));
```

---

## 🛡️ 常见安全问题

### SQL 注入防护

```typescript
// ❌ 危险：SQL 注入
async function getUserDangerous(username: string) {
  const query = `SELECT * FROM users WHERE username = '${username}'`;
  return db.query(query);
}

// ✅ 安全：参数化查询
async function getUserSafe(username: string) {
  const query = 'SELECT * FROM users WHERE username = $1';
  return db.query(query, [username]);
}

// ✅ 使用 ORM
async function getUserORM(username: string) {
  return User.findOne({ where: { username } });
}
```

### XSS 防护

```typescript
// XSS 防护
import xss from 'xss';

// 输入清理
function sanitizeInput(input: string): string {
  return xss(input, {
    whiteList: {},           // 不允许任何 HTML 标签
    stripIgnoreTag: true,    // 移除所有不在白名单的标签
    stripIgnoreTagBody: ['script'],  // 移除 script 标签及其内容
  });
}

// 输出编码
function escapeOutput(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// 使用
app.post('/api/messages', (req, res) => {
  const message = sanitizeInput(req.body.message);
  // 存储到数据库
});
```

### CSRF 防护

```typescript
// CSRF 保护
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });

// 应用到路由
app.use(csrfProtection);

// 提供 CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// 受保护的路由
app.post('/api/data', (req, res) => {
  // 自动验证 CSRF token
  res.json({ success: true });
});

// 前端使用
// 1. 获取 token
const { csrfToken } = await fetch('/api/csrf-token').then(r => r.json());

// 2. 在请求中包含 token
await fetch('/api/data', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify(data),
});
```

---

## 🔧 安全配置

### 安全 Headers

```typescript
// 安全 headers
import helmet from 'helmet';

app.use(helmet());

// 或自定义配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.openai.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

### HTTPS 配置

```typescript
// 强制 HTTPS
import fs from 'fs';
import https from 'https';

// 生产环境
if (process.env.NODE_ENV === 'production') {
  const sslOptions = {
    key: fs.readFileSync('/path/to/private-key.pem'),
    cert: fs.readFileSync('/path/to/certificate.pem'),
    ca: fs.readFileSync('/path/to/ca-bundle.pem'),
  };
  
  https.createServer(sslOptions, app).listen(443, () => {
    console.log('HTTPS server running on port 443');
  });
  
  // HTTP 重定向到 HTTPS
  http.createServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    res.end();
  }).listen(80);
} else {
  // 开发环境使用 HTTP
  app.listen(3000, () => {
    console.log('HTTP server running on port 3000');
  });
}
```

### 安全检查清单

```markdown
## 部署前安全检查清单

### 认证和授权
- [ ] 使用强密码策略
- [ ] 实现账户锁定机制
- [ ] 使用安全的会话管理
- [ ] 实施 JWT 刷新机制
- [ ] 验证所有用户输入

### 数据保护
- [ ] 加密敏感数据
- [ ] 使用 HTTPS
- [ ] 实施适当的访问控制
- [ ] 定期备份数据
- [ ] 数据库连接加密

### API 安全
- [ ] 实施速率限制
- [ ] 验证 API 密钥
- [ ] 使用 CORS 策略
- [ ] 启用 CSP headers
- [ ] 防止 SQL 注入

### 日志和监控
- [ ] 记录所有安全事件
- [ ] 监控异常活动
- [ ] 设置告警规则
- [ ] 定期审查日志
- [ ] 脱敏敏感信息

### 工具安全
- [ ] 验证工具参数
- [ ] 限制工具权限
- [ ] 监控工具使用
- [ ] 审计工具调用
- [ ] 实施超时控制

### 依赖安全
- [ ] 定期更新依赖
- [ ] 扫描已知漏洞
- [ ] 锁定依赖版本
- [ ] 使用可信源
- [ ] 最小化依赖数量
```

---

## 📚 相关文档

- **[工具开发最佳实践](./tool-development.md)** - 安全的工具开发
- **[Agent 设计最佳实践](./agent-design.md)** - 安全的 Agent 设计
- **[配置指南](../getting-started/configuration.md)** - 安全配置

---

**安全最佳实践文档完成！保护你的系统！** 🔒
