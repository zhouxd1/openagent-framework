# OpenAgent Framework 文档

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/your-org/openagent-framework)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/your-org/openagent-framework)

完整的 AI Agent 开发框架，支持多 LLM 揎商商商、工具集成。

---

## 📚 文档目录

### 快速开始

- **[安装指南](./getting-started/installation.md)** - 详细的安装步骤和配置
- **[第一个 Agent](./getting-started/first-agent.md)** - 5 分钟创建你的第一个 Agent
- **[自定义工具](./getting-started/custom-tools.md)** - 创建和使用自定义工具
- **[配置指南](./getting-started/configuration.md)** - 完整的配置选项

### API 参考

- **[Core API](./api/core-api.md)** - 核心 API 文档
- **[Tools API](./api/tools-api.md)** - 工具 API 文档
- **[LLM Adapters](./api/llm-adapters.md)** - LLM 适配器文档
- **[Advanced API](./api/advanced-api.md)** - 高级功能 API

### 架构设计

- **[架构概览](./architecture/overview.md)** - 系统整体架构
- **[核心引擎](./architecture/core-engine.md)** - Agent 和工具执行引擎
- **[工具系统](./architecture/tool-system.md)** - 工具开发和执行
- **[LLM 集成](./architecture/llm-integration.md)** - LLM 提供商集成

### 最佳实践

- **[工具开发最佳实践](./best-practices/tool-development.md)** - 工具开发指南
- **[Agent 设计最佳实践](./best-practices/agent-design.md)** - Agent 设计模式
- **[性能优化](./best-practices/performance-optimization.md)** - 性能优化策略
- **[安全最佳实践](./best-practices/security.md)** - 安全开发指南

### 其他资源

- **[常见问题 FAQ](./faq.md)** - 常见问题解答
- **[示例代码](../examples/)** - 完整的示例项目

---

## 🚀 快速开始

### 最小示例
```typescript
import { ReActAgent } from '@openagent/core';
import { OpenAIAdapter } from '@openagent/llm-openai';
import { getWeatherTool } from '@openagent/tools';

const agent = new ReActAgent({
  id: 'weather-agent',
  name: 'Weather Assistant',
  provider: 'openai',
  mode: 'react',
  systemPrompt: 'You are a weather assistant.',
  llm: new OpenAIAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4-turbo-preview',
  }),
  tools: [getWeatherTool],
});

async function main() {
  await agent.initialize();
  const response = await agent.run("What's the weather in Beijing?");
  console.log(response.message);
}

main();
```

### Docker 启动
```bash
# 克隆项目
git clone https://github.com/your-org/openagent-framework.git
cd openagent-framework

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加 API Keys

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

---

## 💡 核心特性

### 多 LLM 支持
支持多种大语言模型：
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3)
- DeepSeek
- 智谱 GLM
- Ollama (本地部署)

### 工具系统
- 内置工具库（HTTP 请求、文件操作、计算器等）
- 自定义工具开发
- 工具权限控制
- 工具执行监控

### Agent 能力
- ReAct 模式（推理+行动）
- Function Calling 模式
- 多 Agent 编排
- 工作流引擎

### 企业级功能
- 会话管理
- 消息历史
- 缓存系统
- 权限控制
- 审计日志
- 监控指标

---

## 📖 学习路径

### 初学者 (1-2 天)
1. 阅读 [安装指南](./getting-started/installation.md)
2. 完成 [第一个 Agent](./getting-started/first-agent.md)
3. 尝试 [创建自定义工具](./getting-started/custom-tools.md)
4. 查看 [配置选项](./getting-started/configuration.md)

### 中级开发者 (3-5 天)
1. 学习 [Core API](./api/core-api.md)
2. 探索 [工具系统](./architecture/tool-system.md)
3. 理解 [LLM 集成](./architecture/llm-integration.md)
4. 阅读 [最佳实践](./best-practices/)

### 高级开发者 (1-2 周)
1. 深入 [架构设计](./architecture/)
2. 实现自定义 LLM 适配器
3. 开发复杂的工作流
4. 性能优化和调试
5. 贡献代码

---

## 🔗 快速链接

- 📦 [GitHub 仓库](https://github.com/your-org/openagent-framework)
- 🐛 [报告问题](https://github.com/your-org/openagent-framework/issues)
- 💬 [Discord 社区](https://discord.gg/openagent)
- 📧 [邮件支持](mailto:support@openagent.dev)

---

## 📊 文档统计

| 类别 | 文档数量 | 页数 |
|------|---------|------|
| 快速开始 | 4 | 20+ |
| API 参考 | 4 | 50+ |
| 架构设计 | 4 | 40+ |
| 最佳实践 | 4 | 35+ |
| 其他 | 1 FAQ | 15+ |
| **总计** | **17** | **160+** |

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 贡献方式
- 📝 改进文档
- 🐛 报告 Bug
- 💡 提出新功能
- 🔧 提交代码

### 开发设置
```bash
# Fork 并克隆仓库
git clone https://github.com/your-username/openagent-framework.git
cd openagent-framework

# 安装依赖
npm install

# 运行测试
npm test

# 创建分支
git checkout -b feature/your-feature

# 提交更改
git commit -am "Add your feature"

# 推送分支
git push origin feature/your-feature

# 创建 Pull Request
```

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](../LICENSE) 文件了解详情。

---

## 🙏 致谢

感谢所有贡献者的付出！

特别感谢：
- OpenAI 提供的 GPT API
- Anthropic 提供的 Claude API
- 所有开源社区贡献者

---

**Happy Coding! 🚀**

如有任何问题，请查看 [FAQ](./faq.md) 或 [联系我们](mailto:support@openagent.dev)。
