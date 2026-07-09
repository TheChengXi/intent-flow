# trace_dependency_chain

沿入口文件追踪直接依赖链 + @intent。

## 参数

`entryFile`（必填）— 入口文件路径，支持绝对路径或相对于项目根目录的路径。

`projectRoot`（可选）— 项目根目录，默认 `process.cwd()`。

`layerConfig`（可选）— 架构层级检测配置，默认按 CCD 三层（data/application/adapter）匹配。用于非 CCD 项目的同层/跨层分组。格式：
```json
{
  "rules": [
    { "name": "<层级名>", "pattern": "<正则>", "subModule": true/false }
  ]
}
```
- `rules`：层匹配规则数组，按优先级匹配，首条命中即止。
- `rules[].pattern`：正则字符串，须包含一个捕获组匹配目录名，如 `"/(cmd)(/|$)"`。
- `rules[].subModule`：可选，是否将该层后第一个子目录作为子模块名。例如 adapter 层开启后，文件 `src/adapter/mcp/foo.ts` → 层级 `adapter/mcp`。

## 返回值

`entry` — 入口文件信息（filePath、intent、layer）。

`dependencies.same_layer` — 同架构层 + 同子模块的依赖。

`dependencies.cross_layer` — 跨架构层或跨适配器子模块的依赖。

## 边界

文件不存在时抛错误。无 @intent 时用文件名 fallback。外部包不会出现在结果中。单个依赖读取失败时跳过该依赖不影响整体。路径支持正斜杠和反斜杠。
