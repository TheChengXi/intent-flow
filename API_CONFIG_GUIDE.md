# CDD Framework API 配置指南

## 支持的 API 提供商

CDD Framework 现在支持两种 API 格式：
1. **Anthropic API** - Claude 官方 API
2. **OpenAI API** - OpenAI 兼容格式（包括 DeepSeek、魔搭社区等）

## 配置方法

### 1. Anthropic API（默认）

```json
{
  "cdd.apiKey": "sk-ant-xxx",
  "cdd.apiBaseUrl": "",  // 留空或不配置
  "cdd.modelId": "claude-sonnet-4-20250514"
}
```

### 2. OpenAI API

```json
{
  "cdd.apiKey": "sk-xxx",
  "cdd.apiBaseUrl": "https://api.openai.com/v1",
  "cdd.modelId": "gpt-4"
}
```

### 3. 魔搭社区（ModelScope）

**注意：魔搭社区的 API 可能不稳定，建议使用 DeepSeek 官方 API**

```json
{
  "cdd.apiKey": "your-modelscope-token",
  "cdd.apiBaseUrl": "https://api-inference.modelscope.cn/v1",
  "cdd.modelId": "deepseek-ai/DeepSeek-V4-Pro"
}
```

如果遇到 404 错误，可能是魔搭社区的端点问题，建议切换到 DeepSeek 官方 API。

### 4. DeepSeek 官方 API

```json
{
  "cdd.apiKey": "sk-xxx",
  "cdd.apiBaseUrl": "https://api.deepseek.com/v1",
  "cdd.modelId": "deepseek-chat"
}
```

## 自动检测机制

ClaudeAPIService 会根据 `apiBaseUrl` 自动检测使用哪种 API 格式：

- 包含 `openai`、`v1/chat`、`modelscope`、`deepseek` → 使用 OpenAI 格式
- 其他或留空 → 使用 Anthropic 格式

## 配置步骤

1. 打开 VSCode 设置（Ctrl+,）
2. 搜索 `cdd`
3. 配置以下三项：
   - `CDD: Api Key` - 你的 API 密钥
   - `CDD: Api Base Url` - API 端点地址
   - `CDD: Model Id` - 模型 ID

## 常见问题

### Q: 429 错误（速率限制）
**A:** 魔搭社区免费额度有限，建议：
- 使用付费 API（DeepSeek 官方、OpenAI）
- 降低使用频率
- 等待速率限制重置

### Q: 500 错误（No choices in OpenAI response）
**A:** 可能原因：
- 模型 ID 不正确
- API 端点不支持该模型
- 请求格式不兼容

解决方法：
- 检查 `modelId` 是否正确
- 确认 API 端点支持该模型
- 查看控制台详细错误信息

### Q: 如何切换 API 提供商？
**A:** 只需修改 `apiBaseUrl` 和 `modelId`，系统会自动检测格式。

## 推荐配置

### 开发测试（省钱）
```json
{
  "cdd.apiKey": "your-modelscope-token",
  "cdd.apiBaseUrl": "https://api-inference.modelscope.cn/v1",
  "cdd.modelId": "deepseek-ai/DeepSeek-V4-Pro"
}
```

### 生产使用（稳定）
```json
{
  "cdd.apiKey": "sk-xxx",
  "cdd.apiBaseUrl": "https://api.deepseek.com/v1",
  "cdd.modelId": "deepseek-chat"
}
```

### 最佳体验（推荐）
```json
{
  "cdd.apiKey": "sk-ant-xxx",
  "cdd.apiBaseUrl": "",
  "cdd.modelId": "claude-sonnet-4-20250514"
}
```

## 技术细节

### API 格式差异

**Anthropic 格式：**
```typescript
{
  model: "claude-sonnet-4-20250514",
  max_tokens: 8192,
  system: "系统提示",
  messages: [{ role: "user", content: "用户消息" }]
}
```

**OpenAI 格式：**
```typescript
{
  model: "gpt-4",
  max_tokens: 8192,
  messages: [
    { role: "system", content: "系统提示" },
    { role: "user", content: "用户消息" }
  ]
}
```

### 响应格式统一

无论使用哪种 API，ClaudeAPIService 都会返回统一格式：
```typescript
{
  content: string,
  usage: {
    inputTokens: number,
    outputTokens: number
  }
}
```
