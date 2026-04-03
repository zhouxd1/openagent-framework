# 工具开发最佳实践

本文档提供 OpenAgent Framework 工具开发的最佳实践和设计模式，帮助开发者创建高质量、可维护的工具。

---

## 📋 目录

1. [命名规范](#命名规范)
2. [错误处理](#错误处理)
3. [性能优化](#性能优化)
4. [安全考虑](#安全考虑)
5. [测试策略](#测试策略)
6. [文档编写](#文档编写)

---

## 📝 命名规范

### 工具命名

**✅ 推荐做法**：

```typescript
// ✅ 使用 snake_case
const goodTools = [
  'get_weather',           // 获取天气
  'send_email',            // 发送邮件
  'query_database',        // 查询数据库
  'calculate_metrics',     // 计算指标
  'search_products',       // 搜索产品
  'translate_text',        // 翻译文本
];
```

**❌ 避免的做法**：

```typescript
// ❌ 不要使用 camelCase
const badTools = [
  'getWeather',            // 不一致
  'send-Email',            // 混合风格
  'QueryDatabase',         // PascalCase
  'search products',       // 包含空格
  'searchProducts123',     // 包含数字
];
```

**命名规则**：

1. **格式**: `动词_名词`（verb_noun）
2. **大小写**: 全小写，单词间用下划线分隔
3. **长度**: 3-30 个字符
4. **语义**: 清晰表达工具的功能

### 参数命名

```typescript
const tool: Tool = {
  name: 'send_email',
  description: 'Send an email to a recipient',
  
  parameters: {
    type: 'object',
    properties: {
      // ✅ 使用清晰的参数名
      recipient_email: {
        type: 'string',
        description: 'Email address of the recipient',
      },
      subject: {
        type: 'string',
        description: 'Subject line of the email',
      },
      body: {
        type: 'string',
        description: 'Main content of the email',
      },
      
      // ❌ 避免模糊的参数名
      // email: { type: 'string' },
      // text: { type: 'string' },
      // data: { type: 'object' },
    },
    required: ['recipient_email', 'subject', 'body'],
  },
  
  execute: async (params) => {
    // 实现
  },
};
```

### 返回格式

**✅ 标准返回格式**：

```typescript
// 成功响应
const successResult: ToolResult = {
  success: true,
  data: {
    // 结构化数据
    messageId: 'msg_123456',
    status: 'sent',
    timestamp: '2024-01-15T10:30:00Z',
  },
  metadata: {
    duration: 150,
    provider: 'sendgrid',
  },
};

// 错误响应
const errorResult: ToolResult = {
  success: false,
  error: 'Failed to send email: Invalid recipient address',
  metadata: {
    duration: 50,
    errorCode: 'INVALID_EMAIL',
  },
};

// 部分成功
const partialResult: ToolResult = {
  success: true,
  data: {
    processed: 95,
    failed: 5,
    total: 100,
  },
  metadata: {
    duration: 5000,
    warnings: ['5 records skipped due to validation errors'],
  },
};
```

---

## ⚠️ 错误处理

### 错误类型

定义清晰的错误类型：

```typescript
// packages/tools/src/errors.ts

/**
 * 工具错误基类
 */
export class ToolError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

/**
 * 参数验证错误
 */
export class ValidationError extends ToolError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}

/**
 * 权限错误
 */
export class PermissionError extends ToolError {
  constructor(message: string, public readonly permission?: string) {
    super(message, 'PERMISSION_DENIED', { permission });
    this.name = 'PermissionError';
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends ToolError {
  constructor(message: string, public readonly timeout: number) {
    super(message, 'TIMEOUT', { timeout });
    this.name = 'TimeoutError';
  }
}

/**
 * 外部服务错误
 */
export class ExternalServiceError extends ToolError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly statusCode?: number
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', { service, statusCode });
    this.name = 'ExternalServiceError';
  }
}
```

### 错误消息

**✅ 好的错误消息**：

```typescript
const goodErrors = {
  // 具体且可操作
  invalidEmail: 'Invalid email address "john.doe@": Missing domain name',
  
  // 包含上下文
  databaseError: 'Failed to connect to database "users" at localhost:5432: Connection refused',
  
  // 提供解决方案
  rateLimited: 'API rate limit exceeded. Please retry after 60 seconds or upgrade your plan',
  
  // 包含相关数据
  validationFailed: 'Validation failed for field "age": Value must be between 0 and 120, got 150',
};
```

**❌ 差的错误消息**：

```typescript
const badErrors = {
  // 太模糊
  invalidEmail: 'Invalid email',
  
  // 无上下文
  databaseError: 'Connection failed',
  
  // 无解决方案
  rateLimited: 'Too many requests',
  
  // 无细节
  validationFailed: 'Validation error',
};
```

### 错误恢复

```typescript
const resilientTool: Tool = {
  name: 'fetch_data',
  description: 'Fetch data from external API with retry',
  
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      retries: { type: 'number', default: 3 },
    },
    required: ['url'],
  },
  
  execute: async (params) => {
    const maxRetries = params.retries || 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(params.url);
        
        if (!response.ok) {
          throw new ExternalServiceError(
            `HTTP ${response.status}: ${response.statusText}`,
            'http',
            response.status
          );
        }
        
        const data = await response.json();
        
        return {
          success: true,
          data,
          metadata: {
            attempt,
            cached: false,
          },
        };
      } catch (error: any) {
        lastError = error;
        
        // 判断是否应该重试
        const shouldRetry = 
          attempt < maxRetries &&
          (error instanceof ExternalServiceError && 
           error.statusCode && 
           error.statusCode >= 500);
        
        if (!shouldRetry) {
          break;
        }
        
        // 指数退避
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await sleep(delay);
      }
    }
    
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      metadata: {
        attempts: maxRetries,
      },
    };
  },
};
```

---

## 🚀 性能优化

### 异步处理

**✅ 正确使用异步**：

```typescript
const goodTool: Tool = {
  name: 'batch_process',
  description: 'Process multiple items in parallel',
  
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { type: 'string' },
      },
      concurrency: {
        type: 'number',
        default: 5,
      },
    },
    required: ['items'],
  },
  
  execute: async (params) => {
    const { items, concurrency = 5 } = params;
    
    // 使用并发控制
    const results = await pMap(
      items,
      async (item) => {
        return processItem(item);
      },
      { concurrency }
    );
    
    return {
      success: true,
      data: {
        processed: results.length,
        results,
      },
    };
  },
};

// pMap 实现（简化版）
async function pMap<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  options: { concurrency: number }
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = mapper(item).then(result => {
      results.push(result);
    });
    
    executing.push(promise);
    
    if (executing.length >= options.concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}
```

### 缓存策略

```typescript
// 带缓存的工具
const cachedTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string' },
      units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
    },
    required: ['location'],
  },
  
  execute: async (params) => {
    // 检查缓存
    const cacheKey = `weather:${params.location}:${params.units || 'celsius'}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        data: cached,
        metadata: { cached: true },
      };
    }
    
    // 获取数据
    const weather = await fetchWeather(params.location, params.units);
    
    // 缓存结果（5分钟）
    await cache.set(cacheKey, weather, { ttl: 300000 });
    
    return {
      success: true,
      data: weather,
      metadata: { cached: false },
    };
  },
};

// 注册时配置缓存
registry.register(cachedTool, {
  cache: {
    enabled: true,
    ttl: 300000, // 5 分钟
    keyGenerator: (params) => `weather:${params.location}:${params.units || 'celsius'}`,
  },
});
```

### 批量操作

```typescript
// 支持批量操作的工具
const batchTool: Tool = {
  name: 'query_users',
  description: 'Query multiple users by IDs',
  
  parameters: {
    type: 'object',
    properties: {
      userIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of user IDs to query',
      },
      batchSize: {
        type: 'number',
        description: 'Number of IDs per batch',
        default: 100,
      },
    },
    required: ['userIds'],
  },
  
  execute: async (params) => {
    const { userIds, batchSize = 100 } = params;
    const results: any[] = [];
    const errors: string[] = [];
    
    // 分批处理
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      try {
        const batchResults = await queryDatabase(batch);
        results.push(...batchResults);
      } catch (error: any) {
        errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      data: {
        users: results,
        total: userIds.length,
        found: results.length,
      },
      metadata: {
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  },
};
```

---

## 🔒 安全考虑

### 参数验证

```typescript
const secureTool: Tool = {
  name: 'execute_query',
  description: 'Execute a database query',
  
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        minLength: 1,
        maxLength: 1000,
        pattern: '^SELECT',  // 只允许 SELECT 语句
      },
      params: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 50,
      },
    },
    required: ['query'],
  },
  
  execute: async (params) => {
    // 额外的安全验证
    if (containsSQLInjection(params.query)) {
      return {
        success: false,
        error: 'Invalid query: Potential SQL injection detected',
      };
    }
    
    // 使用参数化查询
    const result = await database.query(params.query, params.params);
    
    return {
      success: true,
      data: result,
    };
  },
};

function containsSQLInjection(query: string): boolean {
  const dangerousPatterns = [
    /DROP\s+TABLE/i,
    /DELETE\s+FROM/i,
    /INSERT\s+INTO/i,
    /UPDATE\s+.*SET/i,
    /UNION\s+SELECT/i,
    /--/,
    /;\s*/,
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(query));
}
```

### 权限检查

```typescript
const adminTool: Tool = {
  name: 'delete_user',
  description: 'Delete a user account (admin only)',
  
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID to delete',
      },
    },
    required: ['userId'],
  },
  
  execute: async (params, context?: ExecutionContext) => {
    // 检查权限
    if (!context?.permissions?.includes('admin')) {
      return {
        success: false,
        error: 'Permission denied: Admin privileges required',
      };
    }
    
    // 执行删除
    await userManager.delete(params.userId);
    
    return {
      success: true,
      data: { deleted: true, userId: params.userId },
    };
  },
};

// 注册时设置所需权限
registry.register(adminTool, {
  permissions: ['admin', 'user:delete'],
});
```

### 敏感数据处理

```typescript
const safeTool: Tool = {
  name: 'send_sms',
  description: 'Send SMS message',
  
  parameters: {
    type: 'object',
    properties: {
      phone: {
        type: 'string',
        description: 'Phone number',
      },
      message: {
        type: 'string',
        maxLength: 160,
      },
    },
    required: ['phone', 'message'],
  },
  
  execute: async (params) => {
    // 脱敏手机号（用于日志）
    const maskedPhone = maskPhoneNumber(params.phone);
    
    logger.info('Sending SMS', {
      phone: maskedPhone,
      messageLength: params.message.length,
    });
    
    // 发送 SMS
    const result = await smsService.send(params.phone, params.message);
    
    return {
      success: true,
      data: {
        messageId: result.id,
        phone: maskedPhone,  // 返回时也脱敏
      },
    };
  },
};

function maskPhoneNumber(phone: string): string {
  // 保留前3位和后4位
  if (phone.length >= 7) {
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  }
  return '***';
}
```

---

## 🧪 测试策略

### 单元测试

```typescript
// tests/tools/weather.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { getWeatherTool } from '@/tools/weather';

describe('Weather Tool', () => {
  let tool: Tool;
  
  beforeEach(() => {
    tool = getWeatherTool;
  });
  
  describe('parameter validation', () => {
    it('should require location parameter', async () => {
      const result = await tool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('location');
    });
    
    it('should accept valid location', async () => {
      // Mock API
      mockWeatherAPI({ temperature: 25 });
      
      const result = await tool.execute({
        location: 'Beijing',
      });
      
      expect(result.success).toBe(true);
      expect(result.data.temperature).toBe(25);
    });
    
    it('should validate units parameter', async () => {
      const result = await tool.execute({
        location: 'Beijing',
        units: 'kelvin',  // 无效单位
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('units');
    });
  });
  
  describe('execution', () => {
    it('should return weather data', async () => {
      mockWeatherAPI({
        temperature: 20,
        humidity: 60,
        condition: 'sunny',
      });
      
      const result = await tool.execute({
        location: 'Shanghai',
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        temperature: 20,
        humidity: 60,
        condition: 'sunny',
      });
    });
    
    it('should handle API errors gracefully', async () => {
      mockWeatherAPIError(new Error('API timeout'));
      
      const result = await tool.execute({
        location: 'Unknown City',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API timeout');
    });
    
    it('should handle invalid city', async () => {
      mockWeatherAPIError(new Error('City not found'), 404);
      
      const result = await tool.execute({
        location: 'InvalidCity123',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('caching', () => {
    it('should cache results', async () => {
      const mockAPI = mockWeatherAPI({ temperature: 25 });
      
      // 第一次调用
      await tool.execute({ location: 'Beijing' });
      
      // 第二次调用
      const result = await tool.execute({ location: 'Beijing' });
      
      // 应该只调用一次 API
      expect(mockAPI.callCount).toBe(1);
      expect(result.metadata.cached).toBe(true);
    });
  });
});
```

### 集成测试

```typescript
// tests/integration/tool-execution.test.ts

import { describe, it, expect } from 'vitest';
import { ToolExecutor } from '@/core/tool-executor';
import { ToolRegistry } from '@/core/tool-registry';

describe('Tool Execution Integration', () => {
  let executor: ToolExecutor;
  let registry: ToolRegistry;
  
  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ToolExecutor(registry);
    
    // 注册测试工具
    registry.register({
      name: 'test_tool',
      description: 'Test tool',
      parameters: {
        type: 'object',
        properties: {
          value: { type: 'number' },
        },
        required: ['value'],
      },
      execute: async (params) => ({
        success: true,
        data: { doubled: params.value * 2 },
      }),
    });
  });
  
  it('should execute tool successfully', async () => {
    const result = await executor.execute('test_tool', { value: 5 });
    
    expect(result.success).toBe(true);
    expect(result.data.doubled).toBe(10);
  });
  
  it('should validate parameters before execution', async () => {
    const result = await executor.execute('test_tool', {
      value: 'not a number',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('validation');
  });
  
  it('should enforce timeout', async () => {
    // 注册一个慢工具
    registry.register({
      name: 'slow_tool',
      description: 'Slow tool',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        await sleep(10000);  // 10秒
        return { success: true };
      },
    }, { timeout: 1000 });  // 1秒超时
    
    const result = await executor.execute('slow_tool', {});
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });
});
```

### 性能测试

```typescript
// tests/performance/tool-performance.test.ts

import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Tool Performance', () => {
  it('should execute within time limit', async () => {
    const tool = getWeatherTool;
    const iterations = 100;
    const maxDuration = 100; // ms
    
    const durations: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      await tool.execute({ location: 'Beijing' });
      
      const duration = performance.now() - start;
      durations.push(duration);
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;
    const p95 = durations.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
    
    console.log('Average duration:', avgDuration);
    console.log('P95 duration:', p95);
    
    expect(avgDuration).toBeLessThan(maxDuration);
    expect(p95).toBeLessThan(maxDuration * 2);
  });
  
  it('should handle concurrent requests', async () => {
    const tool = getWeatherTool;
    const concurrentRequests = 50;
    
    const start = performance.now();
    
    const promises = Array(concurrentRequests)
      .fill(null)
      .map(() => tool.execute({ location: 'Beijing' }));
    
    const results = await Promise.all(promises);
    
    const duration = performance.now() - start;
    
    expect(results.every(r => r.success)).toBe(true);
    expect(duration).toBeLessThan(5000); // 5秒
  });
});
```

---

## 📖 文档编写

### 工具文档模板

```typescript
/**
 * 发送邮件工具
 * 
 * @description
 * 发送邮件到指定的收件人地址。
 * 支持纯文本和 HTML 格式的邮件内容。
 * 
 * @example
 * // 发送简单邮件
 * {
 *   recipient_email: 'user@example.com',
 *   subject: 'Hello',
 *   body: 'This is the email content'
 * }
 * 
 * @example
 * // 发送 HTML 邮件
 * {
 *   recipient_email: 'user@example.com',
 *   subject: 'Hello',
 *   body: '<h1>Hello</h1><p>This is HTML content</p>',
 *   is_html: true
 * }
 * 
 * @param {string} recipient_email - 收件人邮箱地址
 * @param {string} subject - 邮件主题
 * @param {string} body - 邮件正文
 * @param {boolean} [is_html=false] - 是否为 HTML 格式
 * @param {string[]} [cc=[]] - 抄送列表
 * @param {string[]} [bcc=[]] - 密送列表
 * 
 * @returns {Promise<ToolResult>}
 * - success: true - 发送成功
 * - success: false - 发送失败，error 包含错误信息
 * 
 * @throws {ValidationError} - 参数验证失败
 * @throws {ExternalServiceError} - 邮件服务不可用
 * 
 * @see https://docs.openagent.dev/tools/email
 */
export const sendEmailTool: Tool = {
  name: 'send_email',
  description: 'Send an email to a recipient',
  
  parameters: {
    type: 'object',
    properties: {
      recipient_email: {
        type: 'string',
        description: 'Email address of the recipient',
        format: 'email',
      },
      subject: {
        type: 'string',
        description: 'Subject line of the email',
        minLength: 1,
        maxLength: 200,
      },
      body: {
        type: 'string',
        description: 'Main content of the email',
        minLength: 1,
        maxLength: 10000,
      },
      is_html: {
        type: 'boolean',
        description: 'Whether the body contains HTML',
        default: false,
      },
      cc: {
        type: 'array',
        items: { type: 'string', format: 'email' },
        description: 'List of CC recipients',
      },
      bcc: {
        type: 'array',
        items: { type: 'string', format: 'email' },
        description: 'List of BCC recipients',
      },
    },
    required: ['recipient_email', 'subject', 'body'],
  },
  
  execute: async (params) => {
    // 实现...
  },
};
```

### README 模板

```markdown
# Tool Name

Brief description of what this tool does.

## Installation

\`\`\`bash
npm install @openagent/tools-email
\`\`\`

## Usage

\`\`\`typescript
import { createAgent } from '@openagent/core';
import { sendEmailTool } from '@openagent/tools-email';

const agent = createAgent({
  tools: [sendEmailTool],
});

// Use the tool
const result = await agent.run('Send an email to user@example.com');
\`\`\`

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `recipient_email` | string | Yes | Email address of the recipient |
| `subject` | string | Yes | Subject line of the email |
| `body` | string | Yes | Main content of the email |
| `is_html` | boolean | No | Whether the body contains HTML |
| `cc` | string[] | No | List of CC recipients |
| `bcc` | string[] | No | List of BCC recipients |

## Examples

### Send a simple email

\`\`\`typescript
const result = await tool.execute({
  recipient_email: 'user@example.com',
  subject: 'Hello',
  body: 'This is the email content',
});
\`\`\`

### Send an HTML email

\`\`\`typescript
const result = await tool.execute({
  recipient_email: 'user@example.com',
  subject: 'Hello',
  body: '<h1>Hello</h1><p>This is HTML content</p>',
  is_html: true,
});
\`\`\`

## Error Handling

The tool returns a `ToolResult` object:

\`\`\`typescript
interface ToolResult {
  success: boolean;
  data?: {
    messageId: string;
    status: string;
  };
  error?: string;
  metadata?: {
    duration: number;
    provider: string;
  };
}
\`\`\`

## Security Considerations

- Email addresses are validated before sending
- Rate limiting is applied to prevent abuse
- All emails are logged for audit purposes

## License

MIT
```

---

## 📚 相关文档

- **[工具系统](../architecture/tool-system.md)** - 工具系统架构
- **[安全最佳实践](./security.md)** - 安全开发指南
- **[性能优化](./performance-optimization.md)** - 性能优化策略
- **[创建自定义工具](../getting-started/custom-tools.md)** - 工具开发教程

---

**工具开发最佳实践文档完成！构建高质量工具！** 🛠️
