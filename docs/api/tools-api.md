# Tools API 参考

OpenAgent Framework 内置工具的完整 API 参考文档。

---

## 📋 目录

1. [Shell Tool](#shell-tool)
2. [File Tool](#file-tool)
3. [HTTP Tool](#http-tool)
4. [JSON Tool](#json-tool)
5. [自定义工具](#自定义工具)

---

## 🐚 Shell Tool

执行系统命令的工具。

### 安装

```bash
npm install @openagent/tools
```

### 导入

```typescript
import { ShellTool, ShellToolConfig } from '@openagent/tools';
```

### 配置

```typescript
interface ShellToolConfig {
  // 允许的命令白名单
  allowedCommands?: string[];
  
  // 禁止的命令黑名单
  blockedCommands?: string[];
  
  // 超时时间（毫秒）
  timeout?: number;
  
  // 工作目录
  cwd?: string;
  
  // 环境变量
  env?: Record<string, string>;
  
  // 最大缓冲区大小（字节）
  maxBuffer?: number;
}
```

### 使用示例

```typescript
import { ShellTool } from '@openagent/tools';
import { ReActAgent } from '@openagent/core';

// 创建 Shell 工具
const shellTool = new ShellTool({
  allowedCommands: ['ls', 'cat', 'grep', 'find'],
  timeout: 5000,
  cwd: '/home/user/project',
  env: {
    NODE_ENV: 'production',
  },
});

// 添加到 Agent
const agent = new ReActAgent(config);
agent.addTool(shellTool);

// 或使用 ToolExecutor
import { ToolExecutor } from '@openagent/core';

const executor = new ToolExecutor();
executor.register(shellTool, shellTool.execute);

// 执行命令
const result = await executor.execute('shell', {
  command: 'ls -la',
});

console.log(result.data.stdout);
console.log(result.metadata.duration);
```

### 参数

```typescript
{
  command: string;          // 要执行的命令
  args?: string[];          // 命令参数
  cwd?: string;             // 工作目录（覆盖配置）
  env?: Record<string, string>;  // 环境变量（覆盖配置）
  timeout?: number;         // 超时时间（覆盖配置）
}
```

### 返回值

```typescript
{
  success: boolean;
  data: {
    stdout: string;         // 标准输出
    stderr: string;         // 标准错误
    exitCode: number;       // 退出代码
    signal?: string;        // 信号（如果被杀死）
  };
  metadata: {
    duration: number;       // 执行时长（毫秒）
    command: string;        // 执行的命令
    pid?: number;           // 进程 ID
  };
}
```

### 完整示例

```typescript
const shellTool = new ShellTool({
  allowedCommands: ['git', 'npm', 'node'],
  timeout: 10000,
});

// 执行 git 命令
const result = await shellTool.execute({
  command: 'git status',
  cwd: '/path/to/repo',
});

if (result.success) {
  console.log('Git status:', result.data.stdout);
} else {
  console.error('Error:', result.error);
}
```

### 安全注意事项

```typescript
// ✅ 推荐：使用白名单
const safeShellTool = new ShellTool({
  allowedCommands: ['ls', 'cat'],
});

// ❌ 不推荐：无限制
const unsafeShellTool = new ShellTool({});

// ✅ 推荐：限制工作目录
const shellTool = new ShellTool({
  cwd: '/safe/directory',
  allowedCommands: ['ls', 'grep'],
});

// ✅ 推荐：设置超时
const shellTool = new ShellTool({
  timeout: 5000,  // 防止长时间运行
});
```

---

## 📄 File Tool

文件系统操作工具。

### 导入

```typescript
import { FileTool, FileToolConfig } from '@openagent/tools';
```

### 配置

```typescript
interface FileToolConfig {
  // 基础目录（限制访问范围）
  baseDir?: string;
  
  // 允许的文件扩展名
  allowedExtensions?: string[];
  
  // 禁止的文件扩展名
  blockedExtensions?: string[];
  
  // 最大文件大小（字节）
  maxFileSize?: number;
  
  // 是否允许创建目录
  allowCreateDir?: boolean;
  
  // 是否允许删除
  allowDelete?: boolean;
}
```

### 使用示例

```typescript
import { FileTool } from '@openagent/tools';

const fileTool = new FileTool({
  baseDir: '/home/user/project',
  allowedExtensions: ['.txt', '.json', '.md'],
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  allowCreateDir: true,
  allowDelete: false,
});

// 读取文件
const readResult = await fileTool.execute({
  operation: 'read',
  path: 'data/config.json',
});

console.log(readResult.data.content);

// 写入文件
const writeResult = await fileTool.execute({
  operation: 'write',
  path: 'output/result.txt',
  content: 'Hello, World!',
});

// 追加内容
const appendResult = await fileTool.execute({
  operation: 'append',
  path: 'logs/app.log',
  content: 'New log entry\n',
});

// 列出目录
const listResult = await fileTool.execute({
  operation: 'list',
  path: 'src',
});

console.log(listResult.data.files);

// 删除文件
const deleteResult = await fileTool.execute({
  operation: 'delete',
  path: 'temp/cache.tmp',
});

// 创建目录
const mkdirResult = await fileTool.execute({
  operation: 'mkdir',
  path: 'data/backups',
});

// 检查文件是否存在
const existsResult = await fileTool.execute({
  operation: 'exists',
  path: 'config.json',
});

// 获取文件信息
const statResult = await fileTool.execute({
  operation: 'stat',
  path: 'package.json',
});

console.log(statResult.data.size);
console.log(statResult.data.modified);
```

### 操作类型

```typescript
type FileOperation = 
  | 'read'      // 读取文件
  | 'write'     // 写入文件
  | 'append'    // 追加内容
  | 'delete'    // 删除文件
  | 'list'      // 列出目录
  | 'mkdir'     // 创建目录
  | 'exists'    // 检查存在
  | 'stat'      // 获取信息
  | 'copy'      // 复制文件
  | 'move';     // 移动文件
```

### 参数和返回值

#### read

```typescript
// 参数
{
  operation: 'read';
  path: string;
  encoding?: BufferEncoding;  // 默认: 'utf-8'
}

// 返回值
{
  success: boolean;
  data: {
    content: string;
    path: string;
    size: number;
  };
  metadata: {
    duration: number;
    encoding: string;
  };
}
```

#### write

```typescript
// 参数
{
  operation: 'write';
  path: string;
  content: string;
  encoding?: BufferEncoding;
  mode?: number;  // 文件权限，默认: 0o644
}

// 返回值
{
  success: boolean;
  data: {
    path: string;
    size: number;
    bytesWritten: number;
  };
  metadata: {
    duration: number;
  };
}
```

#### list

```typescript
// 参数
{
  operation: 'list';
  path: string;
  recursive?: boolean;  // 递归列出
  pattern?: string;     // glob 模式
}

// 返回值
{
  success: boolean;
  data: {
    files: Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      modified: Date;
    }>;
    total: number;
  };
  metadata: {
    duration: number;
  };
}
```

#### stat

```typescript
// 参数
{
  operation: 'stat';
  path: string;
}

// 返回值
{
  success: boolean;
  data: {
    path: string;
    isFile: boolean;
    isDirectory: boolean;
    size: number;
    created: Date;
    modified: Date;
    accessed: Date;
    mode: number;
  };
  metadata: {
    duration: number;
  };
}
```

### 完整示例

```typescript
const fileTool = new FileTool({
  baseDir: '/home/user/safe-dir',
  allowedExtensions: ['.txt', '.json', '.md'],
  maxFileSize: 5 * 1024 * 1024,  // 5MB
});

// 安全地读取文件
async function safeReadFile(filename: string) {
  const result = await fileTool.execute({
    operation: 'read',
    path: filename,
  });
  
  if (result.success) {
    return result.data.content;
  } else {
    throw new Error(result.error);
  }
}

// 使用
try {
  const content = await safeReadFile('notes.txt');
  console.log(content);
} catch (error) {
  console.error('Failed to read file:', error.message);
}
```

---

## 🌐 HTTP Tool

HTTP 请求工具。

### 导入

```typescript
import { HttpTool, HttpToolConfig } from '@openagent/tools';
```

### 配置

```typescript
interface HttpToolConfig {
  // 允许的域名白名单
  allowedDomains?: string[];
  
  // 禁止的域名黑名单
  blockedDomains?: string[];
  
  // 默认超时（毫秒）
  timeout?: number;
  
  // 默认请求头
  headers?: Record<string, string>;
  
  // 最大响应大小（字节）
  maxResponseSize?: number;
  
  // 是否跟随重定向
  followRedirects?: boolean;
  
  // 最大重定向次数
  maxRedirects?: number;
}
```

### 使用示例

```typescript
import { HttpTool } from '@openagent/tools';

const httpTool = new HttpTool({
  allowedDomains: ['api.github.com', 'api.twitter.com'],
  timeout: 10000,
  headers: {
    'User-Agent': 'OpenAgent/1.0',
  },
});

// GET 请求
const getResult = await httpTool.execute({
  method: 'GET',
  url: 'https://api.github.com/users/octocat',
});

console.log(getResult.data.body);

// POST 请求
const postResult = await httpTool.execute({
  method: 'POST',
  url: 'https://api.example.com/data',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token',
  },
  body: {
    name: 'John',
    email: 'john@example.com',
  },
});

// PUT 请求
const putResult = await httpTool.execute({
  method: 'PUT',
  url: 'https://api.example.com/users/123',
  body: { name: 'Jane' },
});

// DELETE 请求
const deleteResult = await httpTool.execute({
  method: 'DELETE',
  url: 'https://api.example.com/users/123',
});

// 带查询参数
const queryResult = await httpTool.execute({
  method: 'GET',
  url: 'https://api.example.com/search',
  params: {
    q: 'openai',
    page: 1,
    limit: 10,
  },
});
```

### 参数

```typescript
{
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number>;  // 查询参数
  timeout?: number;
  followRedirects?: boolean;
}
```

### 返回值

```typescript
{
  success: boolean;
  data: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
  };
  metadata: {
    duration: number;
    url: string;
    method: string;
    size: number;  // 响应大小（字节）
  };
}
```

### 完整示例

```typescript
const httpTool = new HttpTool({
  allowedDomains: ['api.example.com'],
  timeout: 5000,
});

// 调用 API
async function callApi(endpoint: string, data?: any) {
  const result = await httpTool.execute({
    method: data ? 'POST' : 'GET',
    url: `https://api.example.com${endpoint}`,
    headers: {
      'Authorization': `Bearer ${process.env.API_KEY}`,
    },
    body: data,
  });
  
  if (result.success && result.data.status === 200) {
    return result.data.body;
  } else {
    throw new Error(`API call failed: ${result.error || result.data.statusText}`);
  }
}

// 使用
const users = await callApi('/users');
console.log(users);
```

---

## 📊 JSON Tool

JSON 数据处理工具。

### 导入

```typescript
import { JsonTool } from '@openagent/tools';
```

### 使用示例

```typescript
import { JsonTool } from '@openagent/tools';

const jsonTool = new JsonTool();

// 解析 JSON
const parseResult = await jsonTool.execute({
  operation: 'parse',
  data: '{"name": "John", "age": 30}',
});

console.log(parseResult.data.result);

// 字符串化 JSON
const stringifyResult = await jsonTool.execute({
  operation: 'stringify',
  data: { name: 'John', age: 30 },
  pretty: true,
});

console.log(stringifyResult.data.result);

// 查询 JSON (使用 JSONPath)
const queryResult = await jsonTool.execute({
  operation: 'query',
  data: {
    users: [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 },
    ],
  },
  path: '$.users[*].name',
});

console.log(queryResult.data.result);  // ['John', 'Jane']

// 合并 JSON
const mergeResult = await jsonTool.execute({
  operation: 'merge',
  data: { a: 1, b: 2 },
  target: { b: 3, c: 4 },
});

console.log(mergeResult.data.result);  // { a: 1, b: 3, c: 4 }

// 验证 JSON
const validateResult = await jsonTool.execute({
  operation: 'validate',
  data: '{"name": "John"}',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    required: ['name'],
  },
});

console.log(validateResult.data.valid);  // true
```

### 操作类型

```typescript
type JsonOperation =
  | 'parse'      // 解析 JSON 字符串
  | 'stringify'  // 转换为 JSON 字符串
  | 'query'      // 查询 JSON (JSONPath)
  | 'merge'      // 合并 JSON
  | 'validate'   // 验证 JSON Schema
  | 'transform'; // 转换 JSON
```

### 参数

```typescript
// parse
{
  operation: 'parse';
  data: string;
}

// stringify
{
  operation: 'stringify';
  data: any;
  pretty?: boolean;
}

// query
{
  operation: 'query';
  data: any;
  path: string;  // JSONPath 表达式
}

// merge
{
  operation: 'merge';
  data: any;
  target: any;
}

// validate
{
  operation: 'validate';
  data: any;
  schema: object;  // JSON Schema
}
```

---

## 🔧 自定义工具

除了内置工具，你可以创建自己的工具。

### 基础自定义工具

```typescript
import { Tool, ToolResult } from '@openagent/core';

const myTool: Tool = {
  name: 'my_custom_tool',
  description: 'A custom tool for specific tasks',
  
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter',
      },
    },
    required: ['input'],
  },
  
  execute: async (params: any): Promise<ToolResult> => {
    try {
      const result = await processInput(params.input);
      
      return {
        success: true,
        data: result,
        metadata: {
          processedAt: new Date().toISOString(),
        },
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

### 类工具

```typescript
export class MyTool implements Tool {
  name = 'my_tool';
  description = 'My custom tool';
  
  parameters = {
    type: 'object',
    properties: {
      value: { type: 'string' },
    },
    required: ['value'],
  };

  constructor(private config: any) {}

  async execute(params: any): Promise<ToolResult> {
    // 实现
    return {
      success: true,
      data: { result: params.value },
    };
  }
}

// 使用
const myTool = new MyTool({ someConfig: 'value' });
```

### 注册到 ToolExecutor

```typescript
import { ToolExecutor } from '@openagent/core';

const executor = new ToolExecutor();

// 注册工具
executor.register(myTool, myTool.execute);

// 执行
const result = await executor.execute('my_custom_tool', {
  input: 'test',
});
```

### 添加到 Agent

```typescript
import { ReActAgent } from '@openagent/core';

const agent = new ReActAgent(config);
agent.addTool(myTool);

// 现在 Agent 可以使用这个工具
const response = await agent.run('Use my custom tool with input "hello"');
```

---

## 📚 相关文档

- **[创建自定义工具](../getting-started/custom-tools.md)** - 详细教程
- **[Core API](./core-api.md)** - 核心 API 参考
- **[最佳实践 - 工具开发](../best-practices/tool-development.md)** - 最佳实践

---

**探索更多工具，扩展你的 Agent 能力！** 🛠️
