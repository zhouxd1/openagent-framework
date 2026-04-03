# 多提供商配置系统 - 使用指南

## 概述

OpenAgent CLI 现已支持多个 LLM 提供商配置，您可以轻松切换不同的 AI 模型提供商。

## 支持的提供商

- **OpenAI** - GPT-4, GPT-3.5 等
- **智谱 GLM** - GLM-4, GLM-3-Turbo 等
- **DeepSeek** - DeepSeek Chat, DeepSeek Coder
- **Anthropic** - Claude 3 系列
- **Ollama** - 本地运行的开源模型
- **Moonshot** - 月之暗面 Kimi 系列
- **通义千问** - 阿里云 Qwen 系列
- **零一万物** - Yi 系列模型
- **百川** - Baichuan 系列模型
- **MiniMax** - MiniMax AI 模型

## 配置文件

配置文件位于：`~/.openagent/config.json`

### 配置文件示例

```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "apiKey": "sk-xxx",
      "baseURL": "https://api.openai.com/v1",
      "defaultModel": "gpt-4"
    },
    "zhipu": {
      "apiKey": "zhipu-xxx",
      "baseURL": "https://open.bigmodel.cn/api/paas/v4/",
      "defaultModel": "glm-4"
    },
    "deepseek": {
      "apiKey": "sk-xxx",
      "baseURL": "https://api.deepseek.com/v1",
      "defaultModel": "deepseek-chat"
    },
    "ollama": {
      "baseURL": "http://localhost:11434/v1",
      "defaultModel": "llama2"
    }
  },
  "output": {
    "format": "text",
    "color": true
  },
  "history": {
    "enabled": true,
    "maxSize": 1000
  }
}
```

## 命令使用

### 1. 添加提供商

#### 交互式添加

```bash
openagent provider add
```

系统会提示您选择提供商类型并输入相关信息。

#### 命令行添加

```bash
# 添加 OpenAI
openagent provider add openai --api-key sk-xxx

# 添加智谱 GLM
openagent provider add zhipu --api-key zhipu-xxx

# 添加 DeepSeek
openagent provider add deepseek --api-key sk-xxx --base-url https://api.deepseek.com/v1

# 添加并设置为默认
openagent provider add openai --api-key sk-xxx --set-default

# 添加自定义提供商
openagent provider add custom --api-key xxx --base-url https://api.custom.com/v1 --default-model custom-v1
```

#### 参数说明

- `--api-key, -k`: API 密钥
- `--base-url, -u`: API 基础 URL
- `--default-model, -m`: 默认模型
- `--set-default, -d`: 设为默认提供商
- `--organization, -o`: 组织 ID（OpenAI）

### 2. 列出所有提供商

```bash
openagent provider list

# 或使用简写
openagent provider ls
```

输出示例：

```
Configured Providers:

  OpenAI (openai) ✓ (default)
    Base URL: https://api.openai.com/v1
    Model: gpt-4
    API Key: ***xxxx

  智谱 GLM (zhipu)
    Base URL: https://open.bigmodel.cn/api/paas/v4/
    Model: glm-4
    API Key: ***xxxx
```

### 3. 设置默认提供商

```bash
# 设置智谱为默认
openagent provider set-default zhipu

# 设置 DeepSeek 为默认
openagent provider set-default deepseek
```

### 4. 删除提供商

```bash
# 交互式删除
openagent provider remove

# 删除指定提供商
openagent provider remove openai

# 强制删除（跳过确认）
openagent provider remove openai --force

# 使用简写
openagent provider rm zhipu
```

## 使用提供商

### Chat 命令

```bash
# 使用默认提供商
openagent chat

# 使用指定提供商
openagent chat --provider zhipu

# 使用指定提供商和模型
openagent chat --provider openai --model gpt-4-turbo

# 使用简写
openagent chat -p deepseek -m deepseek-chat
```

### Run 命令

```bash
# 使用默认提供商
openagent run "解释量子计算"

# 使用指定提供商
openagent run "列出当前目录文件" --provider openai

# 使用指定提供商和模型
openagent run "计算 123 * 456" --provider zhipu --model glm-4

# JSON 输出格式
openagent run "分析这段文本的情感" --provider deepseek --output json
```

## 环境变量

您也可以使用环境变量来配置 API Key，环境变量的优先级最高。

```bash
# OpenAI
export OPENAI_API_KEY=sk-xxx

# 智谱
export ZHIPU_API_KEY=zhipu-xxx

# DeepSeek
export DEEPSEEK_API_KEY=sk-xxx

# 通用（所有提供商）
export OPENAI_API_KEY=sk-xxx
```

## 配置优先级

配置加载优先级从高到低：

1. **命令行参数** (如 `--api-key`, `--base-url`)
2. **环境变量** (如 `ZHIPU_API_KEY`)
3. **提供商配置** (`config.providers[name]`)
4. **旧版 API Keys** (`config.apiKeys[name]`) - 向后兼容

## 向后兼容

系统完全向后兼容旧版配置格式：

```json
{
  "apiKeys": {
    "openai": "sk-xxx"
  },
  "defaultModel": "gpt-4"
}
```

旧版配置会自动转换为新格式。

## 故障排除

### 1. 找不到提供商

```
Error: Provider "zhipu" is not configured.
```

**解决方案**：添加提供商配置

```bash
openagent provider add zhipu --api-key your-key
```

### 2. API Key 无效

```
Error: No API key found for provider "openai".
```

**解决方案**：设置 API Key

```bash
# 方法 1: 使用命令
openagent provider add openai --api-key your-key

# 方法 2: 使用环境变量
export OPENAI_API_KEY=your-key
```

### 3. 连接超时

**解决方案**：检查 baseURL 是否正确，或设置更长的超时时间

```bash
openagent provider add custom --base-url https://api.example.com/v1 --timeout 120000
```

## 开发说明

### 配置文件结构

```typescript
interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
}

interface Config {
  defaultProvider?: string;
  providers?: Record<string, ProviderConfig>;
  apiKeys?: Record<string, string>; // 向后兼容
  defaultModel?: string;
  tools?: {
    enabled?: string[];
    disabled?: string[];
  };
  output?: {
    format?: 'text' | 'json';
    color?: boolean;
  };
  history?: {
    enabled?: boolean;
    maxSize?: number;
  };
}
```

### API 使用

```typescript
import { ConfigManager } from '@openagent/cli';

// 加载配置
const config = await ConfigManager.load();

// 获取提供商配置
const providerConfig = await ConfigManager.getProvider('zhipu');

// 添加提供商
await ConfigManager.addProvider('custom', {
  apiKey: 'xxx',
  baseURL: 'https://api.custom.com/v1',
  defaultModel: 'custom-v1',
});

// 设置默认提供商
await ConfigManager.setDefaultProvider('zhipu');

// 获取所有提供商名称
const providers = await ConfigManager.getProviderNames();
```

## 最佳实践

1. **使用环境变量存储敏感信息**：将 API Key 存储在环境变量中，而不是配置文件
2. **设置默认提供商**：为常用操作设置默认提供商
3. **使用提供商模板**：添加提供商时使用预设模板，只需提供 API Key
4. **定期更新配置**：使用 `provider list` 查看当前配置

## 示例场景

### 场景 1：切换到智谱 GLM

```bash
# 1. 添加智谱提供商
openagent provider add zhipu --api-key zhipu-xxx --set-default

# 2. 开始聊天
openagent chat

# 3. 使用特定模型
openagent chat --model glm-3-turbo
```

### 场景 2：使用本地 Ollama

```bash
# 1. 添加 Ollama（无需 API Key）
openagent provider add ollama

# 2. 使用本地模型
openagent chat --provider ollama --model llama2
```

### 场景 3：多提供商切换

```bash
# 查看所有提供商
openagent provider list

# 使用 OpenAI
openagent chat --provider openai

# 切换到 DeepSeek
openagent chat --provider deepseek

# 设置 DeepSeek 为默认
openagent provider set-default deepseek
```

## 总结

多提供商配置系统让您可以：

- ✅ 轻松管理多个 LLM 提供商
- ✅ 快速切换不同的 AI 模型
- ✅ 使用预设模板快速配置
- ✅ 通过环境变量保护 API Key
- ✅ 向后兼容旧版配置

开始使用：

```bash
# 查看帮助
openagent provider --help

# 添加第一个提供商
openagent provider add openai --api-key your-key

# 开始聊天
openagent chat
```
