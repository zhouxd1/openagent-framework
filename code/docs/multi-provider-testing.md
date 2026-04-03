# OpenAgent 多提供商配置系统 - 测试指南

## 📋 测试前准备

### 1. 修复依赖问题

由于 `@openagent/tools` 包存在 TypeScript 编译错误，需要先修复：

```bash
# 查看错误详情
cd packages/tools
npm run build

# 修复 http-tool.ts 和 shell-tool.ts 中的语法错误
# 然后重新构建
npm run build
```

### 2. 构建项目

```bash
cd packages/cli
npm run build
```

## ✅ 功能测试清单

### 测试 1: Provider List（空列表）

**命令**:
```bash
./bin/run provider list
```

**预期输出**:
```
No providers configured.

To add a provider, use:
  openagent provider add <name>

Examples:
  openagent provider add openai
  openagent provider add zhipu --api-key your-key
```

**验证点**:
- ✅ 显示空状态消息
- ✅ 提示如何添加提供商
- ✅ 显示示例命令

### 测试 2: Provider Add（交互式）

**命令**:
```bash
./bin/run provider add
```

**预期行为**:
1. 显示提供商选择列表
2. 选择提供商后，提示输入 API Key
3. 询问是否使用默认 Base URL
4. 询问是否使用默认模型
5. 显示配置摘要

**验证点**:
- ✅ 提供商列表正确显示
- ✅ API Key 输入被隐藏
- ✅ 默认值正确应用
- ✅ 配置成功保存

### 测试 3: Provider Add（命令行）

**命令**:
```bash
# 添加 OpenAI
./bin/run provider add openai --api-key sk-test1234567890

# 添加智谱
./bin/run provider add zhipu --api-key zhipu-test1234567890

# 添加 DeepSeek 并设为默认
./bin/run provider add deepseek --api-key sk-test1234567890 --set-default
```

**预期输出**:
```
✓ Provider "openai" added

Configuration Summary:
  Provider: OpenAI
  Base URL: https://api.openai.com/v1
  Default Model: gpt-4
  API Key: ***7890

Test your configuration:
  openagent chat --provider openai
```

**验证点**:
- ✅ 提供商成功添加
- ✅ 预设模板自动应用
- ✅ API Key 被掩码显示
- ✅ 显示测试提示

### 测试 4: Provider List（有数据）

**命令**:
```bash
./bin/run provider list
```

**预期输出**:
```
Configured Providers:

  OpenAI (openai)
    Base URL: https://api.openai.com/v1
    Model: gpt-4
    API Key: ***7890

  智谱 GLM (zhipu) ✓ (default)
    Base URL: https://open.bigmodel.cn/api/paas/v4/
    Model: glm-4
    API Key: ***7890

  DeepSeek (deepseek)
    Base URL: https://api.deepseek.com/v1
    Model: deepseek-chat
    API Key: ***7890

Configuration file: ~/.openagent/config.json

Usage:
  openagent chat --provider <name>
  openagent run "task" --provider <name>
```

**验证点**:
- ✅ 显示所有提供商
- ✅ 正确标记默认提供商
- ✅ 显示详细信息
- ✅ 显示配置文件路径

### 测试 5: Provider Set-Default

**命令**:
```bash
./bin/run provider set-default openai
```

**预期输出**:
```
✓ Default provider set to OpenAI (openai)

All future commands will use this provider by default.
You can override with --provider flag:
  openagent chat --provider openai
```

**验证点**:
- ✅ 默认提供商更新
- ✅ 显示使用提示

### 测试 6: Provider Remove

**命令**:
```bash
./bin/run provider remove zhipu
```

**预期输出**:
```
? Remove provider "智谱 GLM" (zhipu)? (y/N)
```

输入 `y` 后：
```
✓ Provider "智谱 GLM" (zhipu) removed

Remaining providers:
  - OpenAI (openai)
  - DeepSeek (deepseek)
```

**验证点**:
- ✅ 确认提示
- ✅ 提供商成功删除
- ✅ 更新剩余提供商列表

### 测试 7: Chat 命令（使用提供商）

**命令**:
```bash
# 使用默认提供商
./bin/run chat

# 使用指定提供商
./bin/run chat --provider zhipu

# 使用指定提供商和模型
./bin/run chat --provider openai --model gpt-4-turbo
```

**预期输出**:
```
Initializing agent...
Agent ready with X tools

Session started with gpt-4-turbo (OpenAI)
Type your message or 'exit' to quit

You: Hello!
```

**验证点**:
- ✅ 正确使用指定的提供商
- ✅ 显示提供商和模型信息
- ✅ 提供商不存在时显示错误

### 测试 8: Run 命令（使用提供商）

**命令**:
```bash
./bin/run run "What is 2+2?" --provider openai

# JSON 输出
./bin/run run "What is 2+2?" --provider zhipu --output json
```

**预期输出**:
```
The answer is 4.
```

JSON 格式：
```json
{
  "success": true,
  "message": "The answer is 4.",
  "metadata": {
    "duration": 1234,
    "tokensUsed": { "total": 50 },
    "finishReason": "stop"
  }
}
```

**验证点**:
- ✅ 正确执行任务
- ✅ 使用指定的提供商
- ✅ JSON 输出格式正确
- ✅ 显示元数据（debug 模式）

### 测试 9: 环境变量

**命令**:
```bash
# 设置环境变量
export ZHIPU_API_KEY=zhipu-env-test-key

# 添加提供商（不提供 API Key）
./bin/run provider add zhipu

# 使用提供商
./bin/run chat --provider zhipu
```

**验证点**:
- ✅ 从环境变量读取 API Key
- ✅ 环境变量优先级高于配置文件

### 测试 10: 向后兼容

**准备**:
创建旧版配置文件 `~/.openagent/config.json`:
```json
{
  "apiKeys": {
    "openai": "sk-old-format-key"
  },
  "defaultModel": "gpt-3.5-turbo"
}
```

**命令**:
```bash
./bin/run chat
```

**验证点**:
- ✅ 成功读取旧版配置
- ✅ 使用旧版 API Key
- ✅ 显示兼容性消息

### 测试 11: 配置文件验证

**命令**:
```bash
# 查看配置文件
cat ~/.openagent/config.json

# 或在 Windows 上
type %USERPROFILE%\.openagent\config.json
```

**预期内容**:
```json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "apiKey": "sk-xxx",
      "baseURL": "https://api.openai.com/v1",
      "defaultModel": "gpt-4"
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

**验证点**:
- ✅ JSON 格式正确
- ✅ 所有字段存在
- ✅ API Key 已保存

### 测试 12: 错误处理

#### 12.1 提供商不存在

**命令**:
```bash
./bin/run chat --provider nonexistent
```

**预期输出**:
```
Error: Provider "nonexistent" is not configured.

To add this provider:
  openagent provider add nonexistent

Or list available providers:
  openagent provider list
```

#### 12.2 API Key 缺失

**命令**:
```bash
./bin/run provider add openai
# (不输入 API Key)
```

**预期输出**:
```
Error: No API key found for provider "openai".

Please set it using:
  openagent provider add openai --api-key YOUR_API_KEY

Or set the environment variable: OPENAI_API_KEY
```

#### 12.3 设置不存在的默认提供商

**命令**:
```bash
./bin/run provider set-default nonexistent
```

**预期输出**:
```
Error: Provider "nonexistent" does not exist.

Available providers: openai, zhipu

To add a new provider:
  openagent provider add nonexistent
```

## 🧪 集成测试

### 场景 1: 完整工作流

```bash
# 1. 列出空列表
./bin/run provider list

# 2. 添加 OpenAI
./bin/run provider add openai --api-key sk-test

# 3. 列出提供商
./bin/run provider list

# 4. 使用 OpenAI 聊天
./bin/run chat --provider openai

# 5. 添加智谱
./bin/run provider add zhipu --api-key zhipu-test

# 6. 切换默认
./bin/run provider set-default zhipu

# 7. 使用默认提供商
./bin/run chat

# 8. 使用 OpenAI 运行任务
./bin/run run "Hello" --provider openai

# 9. 删除提供商
./bin/run provider remove openai

# 10. 最终列表
./bin/run provider list
```

### 场景 2: 多提供商切换

```bash
# 添加多个提供商
./bin/run provider add openai --api-key sk-test1
./bin/run provider add zhipu --api-key zhipu-test2
./bin/run provider add deepseek --api-key sk-test3
./bin/run provider add ollama

# 在不同提供商间切换
./bin/run chat --provider openai
./bin/run chat --provider zhipu
./bin/run chat --provider deepseek
./bin/run chat --provider ollama
```

## 📊 性能测试

### 测试配置加载性能

```bash
# 多次运行查看响应时间
time ./bin/run provider list
time ./bin/run provider list
time ./bin/run provider list
```

**预期**: < 100ms

### 测试配置缓存

```bash
# 第一次运行（无缓存）
./bin/run provider list

# 第二次运行（有缓存）
./bin/run provider list
```

**预期**: 第二次应该更快

## 📝 测试报告模板

```markdown
# OpenAgent 多提供商配置系统 - 测试报告

**测试日期**: YYYY-MM-DD
**测试人员**: [姓名]
**版本**: v0.1.0-alpha.1

## 测试环境
- OS: [操作系统]
- Node.js: [版本]
- npm: [版本]

## 测试结果

| 测试项 | 状态 | 备注 |
|--------|------|------|
| Provider List (空) | ✅/❌ | |
| Provider Add (交互式) | ✅/❌ | |
| Provider Add (命令行) | ✅/❌ | |
| Provider List (有数据) | ✅/❌ | |
| Provider Set-Default | ✅/❌ | |
| Provider Remove | ✅/❌ | |
| Chat 命令 | ✅/❌ | |
| Run 命令 | ✅/❌ | |
| 环境变量 | ✅/❌ | |
| 向后兼容 | ✅/❌ | |
| 错误处理 | ✅/❌ | |

## 发现的问题
1. [问题描述]
2. [问题描述]

## 建议
1. [改进建议]
2. [改进建议]

## 结论
[测试结论]
```

## 🎯 自动化测试（未来实现）

```typescript
// tests/provider.test.ts
import { expect } from 'chai';
import { ConfigManager } from '../src/lib/config-manager';

describe('ConfigManager', () => {
  it('should load config', async () => {
    const config = await ConfigManager.load();
    expect(config).to.exist;
  });

  it('should add provider', async () => {
    await ConfigManager.addProvider('test', {
      apiKey: 'test-key',
    });
    const provider = await ConfigManager.getProvider('test');
    expect(provider.apiKey).to.equal('test-key');
  });

  // ... 更多测试
});
```

## 📋 测试清单

在提交之前，确保：

- [ ] 所有文件已创建
- [ ] TypeScript 编译无错误
- [ ] 所有命令可以运行
- [ ] 配置文件格式正确
- [ ] 错误处理正确
- [ ] 文档完整
- [ ] 示例可运行

---

**准备好测试了吗？开始吧！** 🚀
