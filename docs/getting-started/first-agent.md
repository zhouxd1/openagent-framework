# 创建第一个 Agent

本教程将带你在 5 分钟内创建并运行你的第一个 AI Agent。

## ⚡ 5 分钟快速开始

### 前提条件
- ✅ 已完成 [安装](./installation.md)
- ✅ 至少配置了一个 LLM API Key

### 最小示例
创建 `hello-agent.ts`:
```typescript
import { ReActAgent } from '@openagent/core';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const agent = new ReActAgent({
    id: 'hello-agent',
    name: 'Hello Agent',
    provider: 'openai',
    mode: 'react',
    systemPrompt: 'You are a helpful assistant.',
    maxIterations: 10,
  });

  await agent.initialize();
  
  const response = await agent.run('Hello! What can you do?');
  console.log('🤖', response.message);
}

main().catch(console.error);
```

### 运行
```bash
npx ts-node hello-agent.ts
```

**预期输出:**
```
🤖 Hello! I'm a helpful AI assistant. How can I assist you today?
```

**恭喜!你已经创建并运行了第一个 Agent!** 🎉
