---
name: test
description: 测试 include 参考规范是否被正确加载到 sub-agent 的 system prompt 中
---

# Test — include 加载测试

测试 `spawn_agent` 的 include 机制是否正常：include/ 目录下的 .md 文件应该被自动注入到 sub-agent 的 system prompt 中。

## 流程

调用 `spawn_agent`：
- `agent`: `"echo2"`
- `task`: `"输出你收到的所有参考规范内容"`

然后直接输出 sub-agent 返回的结果。
