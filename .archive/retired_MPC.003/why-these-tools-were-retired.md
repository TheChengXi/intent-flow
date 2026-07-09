# MCP 工具归档说明

这些工具犯了一个共同错误：**把基础设施/调试功能硬包装成 MCP 工具，但没想过 AI 什么时候会用、为什么要用。**

## 工具清单与删除理由

| 工具 | 问题 |
|------|------|
| `analyze_project_structure` | 实现有 bug，返回空结果。从来没修过。 |
| `check_layer_compliance` | check_file_size 的翻版 + 分层废话。行数阈值是拍脑袋的。 |
| `extract_full_context` | 和 generate_capability_list 功能重叠。VSCode 有独立引用，只归档 MCP 层。 |
| `extract_partial_context` | extract_full_context 的变体。当前流程不需要"截取代码段"。 |
| `extract_intent` | 纯基础设施。读 @intent 是 generate_capability_list 的内部步骤，不应该独立成工具。 |
| `search_contract` | 完全不可用。报错说"这是 VSCode 专用方法"。半成品。 |
| `search_function_definition` | 返回结果不完整，只能找到签名找不到函数体。半残品。 |
| `get_cache_stats` | 调试工具。缓存自动 LRU 淘汰，AI 不需要查缓存状态。 |
| `clear_cache` | 调试工具。同上。 |

## 忏悔

这些工具是 AI 生成后直接部署的，从来没有亲手测试过。10 个工具里 3 个不能用、3 个半残、4 个根本不需要。

因为我没检查 AI 生成的东西，结果后面又提了同样的需求让 AI 重新设计了一遍——extract_full_context 和 generate_capability_list 就是典型。功能早就写好了，但没跑过测试，所以谁都不知道它存在，于是花了两份钱做同一件事。

另一个教训是不了解 MCP 是什么就往上堆功能。MCP 工具暴露给 AI 调用的接口，不是开发者的工具箱。把 get_cache_stats、clear_cache 这种东西挂上去，相当于给用户一个"查看发动机转速"的按键——没人会按，按了也没用。

省流：AI 写出的东西你不测试，它就等于不存在。你不存在的功能，下次会再生成一遍，再花一遍钱。
