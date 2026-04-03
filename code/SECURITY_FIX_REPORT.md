# Logger 敏感信息脱敏 Bug 修复报告

## 问题描述
Logger 敏感信息脱敏功能存在 bug，导致 API Key 等敏感信息可能被记录到日志。

## 问题位置
`packages/core/src/logger.ts` 第 87 行

## 根本原因
```typescript
// 修复前（有 bug）
if (['password', 'apiKey', 'token', 'secret'].includes(key.toLowerCase()))
```
- 数组中的 `'apiKey'` 使用了驼峰命名
- 但 `key.toLowerCase()` 会将键名转换为小写 `'apikey'`
- 导致 `'apiKey' !== 'apikey'`，无法匹配，脱敏失败

## 修复方案
```typescript
// 修复后（正确）
if (['password', 'apikey', 'token', 'secret'].includes(key.toLowerCase()))
```
将数组中的所有敏感字段名称改为小写，确保能匹配 `key.toLowerCase()` 的结果。

## 验证结果

### 1. 单元测试结果
✅ `ConsoleTransport > should redact sensitive fields` 测试通过
- 该测试使用 `apiKey`（驼峰命名）作为测试用例
- 修复后能正确识别并脱敏

### 2. 手动验证结果
测试了多种大小写形式的敏感字段：

| 字段名 | 原始值 | 脱敏结果 |
|--------|--------|----------|
| `apiKey` (驼峰) | secret-api-key-123 | ✅ ***REDACTED*** |
| `apikey` (小写) | secret-apikey-123 | ✅ ***REDACTED*** |
| `ApiKey` (首字母大写) | secret-ApiKey-123 | ✅ ***REDACTED*** |
| `APIKEY` (全大写) | secret-APIKEY-123 | ✅ ***REDACTED*** |
| `password` | my-password | ✅ ***REDACTED*** |
| `token` | bearer-token-xyz | ✅ ***REDACTED*** |
| `secret` | my-secret-key | ✅ ***REDACTED*** |
| `normalField` (普通字段) | normal-value | ✅ 保留原值 |

### 3. 完整测试套件结果
- ✅ Logger 脱敏相关测试全部通过
- ⚠️ 2 个无关测试失败（已存在的问题，非本次修复引入）：
  - `logger.test.ts > Logger > timing > should log errors during timed operations`
  - `validator.test.ts > Validator > validate > should include context in error message`

## 安全影响
**严重性：高**
- 修复前，使用驼峰命名 `apiKey` 的敏感信息会被明文记录到日志
- 可能导致 API Keys、Tokens 等凭证泄露
- 修复后，所有大小写形式的敏感字段都能被正确脱敏

## 修复内容确认
- ✅ 修复已应用到源代码
- ✅ TypeScript 已重新编译
- ✅ 脱敏功能正常工作
- ✅ 无新问题引入
- ✅ 测试验证通过

## 建议
1. **立即部署**：此修复应立即部署到所有环境
2. **日志审计**：检查历史日志是否包含未脱敏的敏感信息
3. **代码审查**：检查其他可能存在类似问题的地方
