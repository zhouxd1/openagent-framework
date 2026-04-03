# 创建自定义工具

工具（Tool）是 Agent 的能力扩展机制。本教程将教你如何创建强大、安全、可复用的自定义工具。

---

## 🎯 工具基础

### 什么是 Tool？

Tool 是 Agent 可以调用的函数，用于执行特定任务：

- 查询数据库
- 调用外部 API
- 执行系统命令
- 处理文件
- 进行计算

### Tool 接口

```typescript
interface Tool {
  name: string;                    // 工具名称（唯一）
  description: string;             // 工具描述（LLM 使用）
  parameters: JSONSchema;          // 参数 Schema
  execute: (params: any) => Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;     // 执行是否成功
  data?: any;          // 返回数据
  error?: string;      // 错误信息
  metadata?: {         // 元数据
    duration?: number;  // 执行时长
    [key: string]: any;
  };
}
```

---

## 📝 实现示例

### 示例 1: 数据库查询工具

```typescript
import { Tool, ToolResult } from '@openagent/core';
import { Pool } from 'pg';

// 数据库连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const databaseQueryTool: Tool = {
  name: 'database_query',
  description: 'Execute SQL queries on the database (SELECT only)',
  
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'SQL SELECT query to execute',
      },
      params: {
        type: 'array',
        items: { type: 'string' },
        description: 'Query parameters for prepared statement',
      },
    },
    required: ['query'],
  },

  execute: async (params: any): Promise<ToolResult> => {
    const startTime = Date.now();
    
    try {
      // 安全检查：只允许 SELECT 查询
      const query = params.query.trim().toUpperCase();
      if (!query.startsWith('SELECT')) {
        return {
          success: false,
          error: 'Only SELECT queries are allowed',
        };
      }

      // 执行查询
      const result = await pool.query(params.query, params.params || []);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        data: {
          rows: result.rows,
          rowCount: result.rowCount,
        },
        metadata: {
          duration,
          rowCount: result.rowCount,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Query failed: ${error.message}`,
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  },
};
```

### 示例 2: HTTP API 工具

```typescript
import { Tool, ToolResult } from '@openagent/core';
import fetch from 'node-fetch';

export const apiRequestTool: Tool = {
  name: 'api_request',
  description: 'Make HTTP requests to external APIs',
  
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'API endpoint URL',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'HTTP method',
      },
      headers: {
        type: 'object',
        description: 'Request headers',
      },
      body: {
        type: 'object',
        description: 'Request body (for POST/PUT)',
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
      },
    },
    required: ['url', 'method'],
  },

  execute: async (params: any): Promise<ToolResult> => {
    const startTime = Date.now();
    
    try {
      // URL 验证
      const url = new URL(params.url);
      
      // 白名单检查
      const allowedDomains = ['api.github.com', 'api.twitter.com'];
      if (!allowedDomains.includes(url.hostname)) {
        return {
          success: false,
          error: `Domain ${url.hostname} is not allowed`,
        };
      }

      // 发送请求
      const response = await fetch(params.url, {
        method: params.method,
        headers: {
          'Content-Type': 'application/json',
          ...params.headers,
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
        timeout: params.timeout || 10000,
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      return {
        success: response.ok,
        data,
        metadata: {
          duration,
          status: response.status,
          statusText: response.statusText,
          url: params.url,
          method: params.method,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Request failed: ${error.message}`,
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  },
};
```

### 示例 3: 文件处理工具

```typescript
import { Tool, ToolResult } from '@openagent/core';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileProcessorTool implements Tool {
  name = 'file_processor';
  description = 'Process files (read, write, analyze)';
  
  parameters = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['read', 'write', 'analyze', 'delete'],
        description: 'Operation to perform',
      },
      path: {
        type: 'string',
        description: 'File path (relative to base directory)',
      },
      content: {
        type: 'string',
        description: 'Content to write (for write operation)',
      },
    },
    required: ['operation', 'path'],
  };

  private baseDir: string;
  private allowedExtensions: string[];

  constructor(config: {
    baseDir: string;
    allowedExtensions?: string[];
  }) {
    this.baseDir = config.baseDir;
    this.allowedExtensions = config.allowedExtensions || ['*'];
  }

  async execute(params: any): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // 验证路径安全性
      const absolutePath = path.resolve(this.baseDir, params.path);
      if (!absolutePath.startsWith(this.baseDir)) {
        return {
          success: false,
          error: 'Access denied: path outside base directory',
        };
      }

      // 验证文件扩展名
      const ext = path.extname(absolutePath);
      if (this.allowedExtensions[0] !== '*' && 
          !this.allowedExtensions.includes(ext)) {
        return {
          success: false,
          error: `File extension ${ext} is not allowed`,
        };
      }

      let result: any;

      switch (params.operation) {
        case 'read':
          result = await this.readFile(absolutePath);
          break;
        case 'write':
          result = await this.writeFile(absolutePath, params.content);
          break;
        case 'analyze':
          result = await this.analyzeFile(absolutePath);
          break;
        case 'delete':
          result = await this.deleteFile(absolutePath);
          break;
        default:
          return {
            success: false,
            error: `Unknown operation: ${params.operation}`,
          };
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: result,
        metadata: {
          duration,
          operation: params.operation,
          path: params.path,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Operation failed: ${error.message}`,
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  }

  private async readFile(filePath: string) {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content };
  }

  private async writeFile(filePath: string, content: string) {
    await fs.writeFile(filePath, content, 'utf-8');
    return { 
      message: 'File written successfully',
      size: content.length,
    };
  }

  private async analyzeFile(filePath: string) {
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      lines: content.split('\n').length,
      characters: content.length,
      words: content.split(/\s+/).length,
    };
  }

  private async deleteFile(filePath: string) {
    await fs.unlink(filePath);
    return { message: 'File deleted successfully' };
  }
}
```

### 示例 4: 数据分析工具

```typescript
import { Tool, ToolResult } from '@openagent/core';

export const dataAnalysisTool: Tool = {
  name: 'analyze_data',
  description: 'Analyze numerical data and calculate statistics',
  
  parameters: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of numbers to analyze',
      },
      operations: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['mean', 'median', 'std', 'min', 'max', 'sum'],
        },
        description: 'Statistical operations to perform',
      },
    },
    required: ['data', 'operations'],
  },

  execute: async (params: any): Promise<ToolResult> => {
    const startTime = Date.now();
    const { data, operations } = params;

    try {
      if (!Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          error: 'Data must be a non-empty array',
        };
      }

      const results: Record<string, number> = {};

      for (const op of operations) {
        switch (op) {
          case 'mean':
            results.mean = data.reduce((a, b) => a + b, 0) / data.length;
            break;
          case 'median':
            const sorted = [...data].sort((a, b) => a - b);
            const mid = Math.floor(data.length / 2);
            results.median = data.length % 2 !== 0
              ? sorted[mid]
              : (sorted[mid - 1] + sorted[mid]) / 2;
            break;
          case 'std':
            const mean = data.reduce((a, b) => a + b, 0) / data.length;
            const variance = data.reduce((sum, val) => 
              sum + Math.pow(val - mean, 2), 0) / data.length;
            results.std = Math.sqrt(variance);
            break;
          case 'min':
            results.min = Math.min(...data);
            break;
          case 'max':
            results.max = Math.max(...data);
            break;
          case 'sum':
            results.sum = data.reduce((a, b) => a + b, 0);
            break;
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: results,
        metadata: {
          duration,
          dataPoints: data.length,
          operations: operations,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Analysis failed: ${error.message}`,
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
  },
};
```

---

## ✨ 高级特性

### 使用 Zod 进行参数验证

```typescript
import { Tool, ToolResult } from '@openagent/core';
import { z } from 'zod';

// 定义参数 Schema
const UserQuerySchema = z.object({
  userId: z.string().uuid(),
  includeDetails: z.boolean().optional(),
  fields: z.array(z.enum(['name', 'email', 'created'])).optional(),
});

export const userQueryTool: Tool = {
  name: 'query_user',
  description: 'Query user information by ID',
  
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        format: 'uuid',
        description: 'User UUID',
      },
      includeDetails: {
        type: 'boolean',
        description: 'Include detailed information',
      },
      fields: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['name', 'email', 'created'],
        },
        description: 'Fields to return',
      },
    },
    required: ['userId'],
  },

  execute: async (params: any): Promise<ToolResult> => {
    try {
      // 验证参数
      const validated = UserQuerySchema.parse(params);
      
      // 执行查询
      const user = await queryUser(validated.userId, validated.fields);
      
      return {
        success: true,
        data: user,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Validation failed: ${error.errors.map(e => e.message).join(', ')}`,
        };
      }
      return {
        success: false,
        error: `Query failed: ${error.message}`,
      };
    }
  },
};
```

### 超时控制

```typescript
export const longRunningTaskTool: Tool = {
  name: 'long_task',
  description: 'Perform long-running task',
  parameters: { type: 'object', properties: {} },
  
  execute: async (params: any): Promise<ToolResult> => {
    const timeout = 30000; // 30 秒超时
    
    try {
      const result = await Promise.race([
        performTask(params),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);
      
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};
```

### 重试机制

```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError;
}

export const reliableApiTool: Tool = {
  name: 'reliable_api',
  description: 'Call external API with retry',
  parameters: { type: 'object', properties: {} },
  
  execute: async (params: any): Promise<ToolResult> => {
    try {
      const result = await executeWithRetry(
        () => callExternalApi(params),
        3,  // 最多重试 3 次
        1000  // 初始延迟 1 秒
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed after retries: ${error.message}`,
      };
    }
  },
};
```

### 缓存结果

```typescript
import { Cache } from '@openagent/core';

const cache = new Cache<{ data: any; timestamp: number }>({
  maxSize: 100,
  ttl: 60000, // 1 分钟
});

export const cachedQueryTool: Tool = {
  name: 'cached_query',
  description: 'Query with caching',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      useCache: { type: 'boolean' },
    },
    required: ['query'],
  },
  
  execute: async (params: any): Promise<ToolResult> => {
    const cacheKey = `query:${params.query}`;
    
    // 检查缓存
    if (params.useCache !== false) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached.data,
          metadata: {
            fromCache: true,
            cachedAt: cached.timestamp,
          },
        };
      }
    }
    
    // 执行查询
    const result = await executeQuery(params.query);
    
    // 缓存结果
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });
    
    return {
      success: true,
      data: result,
      metadata: {
        fromCache: false,
      },
    };
  },
};
```

---

## 🔐 安全最佳实践

### 1. 输入验证

```typescript
// ✅ 总是验证输入
execute: async (params: any) => {
  // 类型检查
  if (typeof params.path !== 'string') {
    return { success: false, error: 'Invalid path type' };
  }
  
  // 长度限制
  if (params.path.length > 255) {
    return { success: false, error: 'Path too long' };
  }
  
  // 正则验证
  if (!/^[a-zA-Z0-9_-]+$/.test(params.path)) {
    return { success: false, error: 'Invalid path format' };
  }
  
  // 继续处理...
}

// ❌ 不要信任输入
execute: async (params: any) => {
  // 直接使用，危险！
  return dangerousOperation(params.path);
}
```

### 2. 路径遍历防护

```typescript
// ✅ 安全的路径处理
execute: async (params: any) => {
  const baseDir = '/safe/directory';
  const absolutePath = path.resolve(baseDir, params.filename);
  
  // 检查是否在基础目录内
  if (!absolutePath.startsWith(baseDir)) {
    return { 
      success: false, 
      error: 'Access denied: path traversal attempt' 
    };
  }
  
  // 继续处理...
}

// ❌ 不安全的路径处理
execute: async (params: any) => {
  // 可能被利用：../../etc/passwd
  return fs.readFile(params.filename);
}
```

### 3. 命令注入防护

```typescript
// ✅ 安全的命令执行
execute: async (params: any) => {
  // 白名单验证
  const allowedCommands = ['ls', 'cat', 'grep'];
  const command = params.command.split(' ')[0];
  
  if (!allowedCommands.includes(command)) {
    return { 
      success: false, 
      error: 'Command not allowed' 
    };
  }
  
  // 使用参数化执行
  return execFile(command, params.args);
}

// ❌ 不安全的命令执行
execute: async (params: any) => {
  // 可能被注入恶意命令
  return exec(params.command);
}
```

### 4. 资源限制

```typescript
// ✅ 限制资源使用
execute: async (params: any) => {
  // 文件大小限制
  const maxSize = 10 * 1024 * 1024; // 10MB
  const stats = await fs.stat(params.path);
  
  if (stats.size > maxSize) {
    return { 
      success: false, 
      error: 'File too large' 
    };
  }
  
  // 超时控制
  const timeout = 5000;
  const result = await Promise.race([
    processFile(params.path),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    ),
  ]);
  
  return { success: true, data: result };
}
```

### 5. 敏感数据处理

```typescript
// ✅ 过滤敏感信息
execute: async (params: any) => {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [params.userId]);
  
  // 过滤敏感字段
  const safeUser = {
    id: user.id,
    name: user.name,
    email: maskEmail(user.email),  // 隐藏部分邮箱
    // password: user.password,  // 不返回密码
    // apiKey: user.apiKey,      // 不返回 API Key
  };
  
  return { success: true, data: safeUser };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}
```

---

## 📊 性能优化

### 1. 批量处理

```typescript
export const batchQueryTool: Tool = {
  name: 'batch_query',
  description: 'Query multiple items in batch',
  parameters: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of item IDs',
      },
    },
    required: ['ids'],
  },
  
  execute: async (params: any): Promise<ToolResult> => {
    // 批量查询，而不是循环单个查询
    const results = await db.query(
      'SELECT * FROM items WHERE id = ANY($1)',
      [params.ids]
    );
    
    return {
      success: true,
      data: results,
    };
  },
};
```

### 2. 懒加载

```typescript
export class HeavyTool implements Tool {
  name = 'heavy_tool';
  description = 'Tool with heavy dependencies';
  parameters = { type: 'object', properties: {} };
  
  private heavyLib: any;
  
  async execute(params: any): Promise<ToolResult> {
    // 懒加载重依赖
    if (!this.heavyLib) {
      this.heavyLib = await import('heavy-library');
    }
    
    const result = await this.heavyLib.process(params);
    return { success: true, data: result };
  }
}
```

### 3. 并发控制

```typescript
import { Queue } from '@openagent/core';

const queue = new Queue({ concurrency: 5 });

export const rateLimitedTool: Tool = {
  name: 'rate_limited',
  description: 'Tool with rate limiting',
  parameters: { type: 'object', properties: {} },
  
  execute: async (params: any): Promise<ToolResult> => {
    // 使用队列控制并发
    const result = await queue.add(() => callExternalApi(params));
    return { success: true, data: result };
  },
};
```

---

## 🧪 测试工具

```typescript
import { describe, it, expect } from 'vitest';
import { databaseQueryTool } from './database-query-tool';

describe('Database Query Tool', () => {
  it('should execute valid SELECT query', async () => {
    const result = await databaseQueryTool.execute({
      query: 'SELECT * FROM users WHERE id = $1',
      params: ['user-123'],
    });
    
    expect(result.success).toBe(true);
    expect(result.data.rows).toBeDefined();
    expect(result.metadata.duration).toBeDefined();
  });

  it('should reject non-SELECT queries', async () => {
    const result = await databaseQueryTool.execute({
      query: 'DELETE FROM users',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Only SELECT queries');
  });

  it('should handle query errors', async () => {
    const result = await databaseQueryTool.execute({
      query: 'SELECT * FROM non_existent_table',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

---

## 📚 下一步

- **[API 文档 - Tools API](../api/tools-api.md)** - 完整的内置工具列表
- **[最佳实践 - 工具开发](../best-practices/tool-development.md)** - 更多最佳实践
- **[示例代码](../../examples/)** - 实际工具实现

---

**开始创建你自己的工具吧！** 🔧
