# @openagent/cli

OpenAgent Framework 命令行工具 - 通过命令行与 AI Agent 进行交互。

## 功能特性

- 🤖 **交互式对话** - 启动 REPL 会话与 Agent 进行多轮对话
- ⚡ **单次任务执行** - 非交互模式下执行单个任务
- 🔧 **工具集成** - 自动注册内置工具（文件操作、HTTP 请求等）
- 💾 **配置管理** - 简单的配置系统，支持 API Key 管理
- 🎨 **美化输出** - Markdown 渲染、彩色输出、进度指示器

## 安装

### 全局安装

```bash
npm install -g @openagent/cli
```

### 从源码安装

```bash
cd packages/cli
npm install
npm run build
npm link
```

## 使用

### 设置 API Key

首先需要设置 OpenAI API Key：

```bash
# 使用配置命令设置
openagent config set apiKeys.openai sk-xxx

# 或者设置环境变量
export OPENAI_API_KEY=sk-xxx
```

### 交互式对话

启动交互式聊天会话：

```bash
# 使用默认配置（gpt-4, openai）
openagent chat

# 指定模型
openagent chat --model gpt-4-turbo

# 指定提供商和模型
openagent chat --provider openai --model gpt-3.5-turbo

# 调整温度参数
openagent chat --temperature 0.9
```

**REPL 内置命令**：

| 命令 | 描述 |
|------|------|
| `exit` | 退出对话 |
| `help` | 显示帮助信息 |
| `clear` | 清屏 |
| `history` | 显示对话历史 |
| `tools` | 显示可用工具 |
| `reset` | 清除对话历史 |

### 执行单次任务

在非交互模式下执行单个任务：

```bash
# 执行任务
openagent run "列出当前目录的文件"

# 使用 JSON 输出格式
openagent run "计算 123 * 456" --output json

# 指定模型
openagent run "翻译这段文字" --model gpt-4-turbo
```

### 配置管理

管理 CLI 配置：

```bash
# 查看所有配置
openagent config list

# 获取单个配置项
openagent config get defaultModel

# 设置配置项
openagent config set defaultModel gpt-4-turbo
openagent config set defaultProvider openai

# 设置 API Key
openagent config set apiKeys.openai sk-xxx
```

**配置文件路径**: `~/.openagent/config.json`

**配置选项**：

| 配置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `defaultProvider` | string | openai | 默认 LLM 提供商 |
| `defaultModel` | string | gpt-4 | 默认模型 |
| `apiKeys.{provider}` | string | - | API Key（按提供商） |
| `tools.enabled` | string[] | [] | 启用的工具列表 |
| `tools.disabled` | string[] | [] | 禁用的工具列表 |
| `output.format` | text/json | text | 默认输出格式 |
| `output.color` | boolean | true | 启用彩色输出 |

## 命令参考

### `openagent chat`

启动交互式聊天会话。

**选项**：

- `-m, --model <model>` - LLM 模型（默认：gpt-4）
- `-p, --provider <provider>` - LLM 提供商（默认：openai）
- `--api-key <key>` - API Key
- `-t, --temperature <temp>` - 温度参数（默认：0.7）
- `--debug` - 启用调试模式

### `openagent run <task>`

执行单个任务。

**参数**：

- `task` - 任务描述（必需）

**选项**：

- `-m, --model <model>` - LLM 模型（默认：gpt-4）
- `-p, --provider <provider>` - LLM 提供商（默认：openai）
- `--api-key <key>` - API Key
- `-o, --output <format>` - 输出格式：text/json（默认：text）
- `-t, --temperature <temp>` - 温度参数（默认：0.7）
- `--debug` - 启用调试模式

### `openagent config get [key]`

获取配置值。

**参数**：

- `key` - 配置键（支持点号分隔）

**选项**：

- `--json` - JSON 格式输出

### `openagent config set <key> <value>`

设置配置值。

**参数**：

- `key` - 配置键（支持点号分隔）
- `value` - 配置值（自动解析 JSON）

**选项**：

- `-f, --force` - 强制覆盖

### `openagent config list`

列出所有配置。

**选项**：

- `--json` - JSON 格式输出

## 环境变量

| 变量名 | 描述 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `AZURE_API_KEY` | Azure API Key |
| `GOOGLE_API_KEY` | Google API Key |

**优先级**：环境变量 > 配置文件

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 测试

```bash
npm test
```

## 示例

### 示例 1: 基本对话

```bash
$ openagent chat

🚀 OpenAgent Chat
   模型: gpt-4 | 提供商: openai
   输入 "exit" 退出, "help" 查看帮助

> 你好，请介绍一下自己

🤖 Agent:
你好！我是 OpenAgent，一个 AI 助手。我可以帮助你完成各种任务，
包括回答问题、处理文件、执行 HTTP 请求等。

> tools

可用工具:
  file_read            读取文件内容
  file_write           写入文件
  http_request         发送 HTTP 请求
  shell_exec           执行 shell 命令
  calculator           计算器

> exit

👋 再见！感谢使用 OpenAgent
```

### 示例 2: 单次任务

```bash
$ openagent run "用 Python 写一个 Hello World 程序"

这是一个简单的 Python Hello World 程序：

\`\`\`python
print("Hello, World!")
\`\`\`

运行方式：
1. 保存为 hello.py
2. 执行 python hello.py

$ openagent run "1+1等于几？" --output json
{
  "success": true,
  "message": "1+1等于2。",
  "metadata": {
    "duration": 234,
    "tokensUsed": {
      "total": 15
    }
  }
}
```

## 故障排除

### API Key 未找到

```
Error: No API key found for provider "openai".
Please set it using:
  openagent config set apiKeys.openai YOUR_API_KEY
Or set the environment variable: OPENAI_API_KEY
```

**解决方案**：设置 API Key 或环境变量。

### 配置文件损坏

```bash
# 重置配置
rm ~/.openagent/config.json
openagent config list  # 会自动创建默认配置
```

## 许可证

MIT

## 相关链接

- [OpenAgent Framework](https://github.com/openagent/framework)
- [文档](https://github.com/openagent/framework/docs)
- [问题反馈](https://github.com/openagent/framework/issues)
