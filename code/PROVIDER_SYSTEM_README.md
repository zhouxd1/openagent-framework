# OpenAgent 多提供商配置系统

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 📖 概述

OpenAgent Framework 的多提供商配置系统允许您轻松管理和切换多个 LLM 提供商，包括 OpenAI、智谱 GLM、DeepSeek、Ollama 等。

## ✨ 特性

- 🎯 **多提供商支持** - 支持 10+ 主流 LLM 提供商
- 🔄 **快速切换** - 一键切换不同的 AI 模型
- 🎨 **交互式配置** - 友好的命令行交互界面
- 🔒 **安全存储** - 支持环境变量和加密存储
- 📦 **预设模板** - 常用提供商一键配置
- 🔄 **向后兼容** - 完全兼容旧版配置格式
- 🎯 **配置优先级** - 灵活的配置覆盖机制

## 🚀 快速开始

### 安装

```bash
cd packages/cli
npm install
npm run build
```

### 添加提供商

```bash
# 交互式添加
openagent provider add

# 命令行添加
openagent provider add openai --api-key sk-xxx
openagent provider add zhipu --api-key zhipu-xxx
openagent provider add deepseek --api-key sk-xxx
```

### 使用提供商

```bash
# 使用默认提供商
openagent chat

# 使用指定提供商
openagent chat --provider zhipu

# 使用指定模型
openagent chat --provider openai --model gpt-4-turbo
```

## 📚 文档

- [使用指南](docs/multi-provider-guide.md) - 完整的使用文档
- [实现总结](docs/multi-provider-implementation.md) - 技术实现细节
- [配置示例](examples/config.example.json) - 配置文件示例

## 🛠️ 命令

### Provider 管理命令

```bash
# 列出所有提供商
openagent provider list

# 添加提供商
openagent provider add <name> --api-key <key>

# 设置默认提供商
openagent provider set-default <name>

# 删除提供商
openagent provider remove <name>
```

### Chat 命令

```bash
# 使用默认提供商
openagent chat

# 使用指定提供商
openagent chat --provider <name>

# 使用指定模型
openagent chat --provider <name> --model <model>
```

### Run 命令

```bash
# 执行单个任务
openagent run "你的问题"

# 使用指定提供商
openagent run "你的问题" --provider <name>

# JSON 输出
openagent run "你的问题" --output json
```

## 🌐 支持的提供商

| 提供商 | 模型 | API 格式 |
|--------|------|---------|
| **OpenAI** | GPT-4, GPT-3.5 | OpenAI |
| **智谱 GLM** | GLM-4, GLM-3-Turbo | OpenAI 兼容 |
| **DeepSeek** | DeepSeek Chat/Coder | OpenAI 兼容 |
| **Anthropic** | Claude 3 系列 | Anthropic |
| **Ollama** | Llama2, Mistral 等 | OpenAI 兼容 |
| **Moonshot** | Kimi | OpenAI 兼容 |
| **通义千问** | Qwen 系列 | OpenAI 兼容 |
| **零一万物** | Yi 系列 | OpenAI 兼容 |
| **百川** | Baichuan2 | OpenAI 兼容 |
| **MiniMax** | ABAB | OpenAI 兼容 |

## ⚙️ 配置

### 配置文件位置

```
~/.openagent/config.json
```

### 配置示例

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
    }
  }
}
```

### 环境变量

```bash
# OpenAI
export OPENAI_API_KEY=sk-xxx

# 智谱
export ZHIPU_API_KEY=zhipu-xxx

# DeepSeek
export DEEPSEEK_API_KEY=sk-xxx
```

## 🎯 配置优先级

从高到低：

1. 命令行参数 (`--api-key`)
2. 环境变量 (`PROVIDER_API_KEY`)
3. 提供商配置 (`config.providers[name]`)
4. 旧版 API Keys (`config.apiKeys[name]`)

## 📦 项目结构

```
packages/cli/
├── src/
│   ├── lib/
│   │   ├── config-manager.ts       # 配置管理器
│   │   └── provider-templates.ts   # 提供商模板
│   └── commands/
│       ├── provider/
│       │   ├── add.ts              # 添加提供商
│       │   ├── list.ts             # 列出提供商
│       │   ├── set-default.ts      # 设置默认
│       │   └── remove.ts           # 删除提供商
│       ├── chat.ts                 # 聊天命令（已更新）
│       └── run.ts                  # 运行命令（已更新）
├── docs/
│   ├── multi-provider-guide.md          # 使用指南
│   └── multi-provider-implementation.md # 实现总结
└── examples/
    └── config.example.json         # 配置示例
```

## 🧪 测试

### 验证脚本

```bash
# Linux/Mac
bash scripts/verify-provider-system.sh

# Windows
scripts\verify-provider-system.bat
```

### 功能测试

```bash
# 1. 添加提供商
openagent provider add openai --api-key test-key

# 2. 列出提供商
openagent provider list

# 3. 设置默认
openagent provider set-default openai

# 4. 测试聊天
openagent chat --provider openai

# 5. 删除提供商
openagent provider remove openai
```

## 🔧 开发

### 构建

```bash
cd packages/cli
npm run build
```

### 开发模式

```bash
npm run dev
```

### 代码统计

- **核心文件**: 8 个
- **代码行数**: ~3000 行
- **提供商模板**: 10+ 个

## 📝 API 使用

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
```

## 🤝 贡献

欢迎贡献代码！请查看 [贡献指南](CONTRIBUTING.md)。

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢所有 LLM 提供商提供的 API 服务。

## 📞 支持

如有问题，请：
- 📖 查看 [使用指南](docs/multi-provider-guide.md)
- 🐛 提交 Issue
- 💬 加入讨论

---

**Made with ❤️ by OpenAgent Team**
