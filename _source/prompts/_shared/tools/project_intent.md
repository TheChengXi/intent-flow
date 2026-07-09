# project_intent

创建文件并写入 @intent 注释。自动创建父目录，根据文件后缀名选择注释语法。Phase 1 调用这个工具来投射文件骨架。

## 参数

`path`（必填）— 目标文件路径，绝对路径或相对路径均可。

`intent`（必填）— @intent 正文内容，纯文本。工具自动添加 `@intent` 前缀和注释符号，不要自己加。

`force`（可选，默认 false）— 文件已存在时是否覆盖。不传 force 时文件已存在则跳过不修改。

## 返回值

`path` — 目标文件路径。

`created` — 是否为新创建的文件。

`updated` — 是否因 force=true 而覆盖了已有文件。

## 注释语法

根据文件扩展名自动选择注释格式：
- `.ts` `.js` `.go` `.java` `.kt` `.swift` `.c` `.cpp` `.rs` `.css` 等 → `/** @intent */` 块注释
- `.py` `.rb` → `""" @intent """` 文档字符串
- `.md` `.yaml` `.json` `.toml` 等 → 纯文本，无注释符号

## 何时调用

Phase 1 中，每从分层设计文档读到一个需要创建的文件条目，就调一次这个工具。同一文件在 Phase 1 重跑时传 `force: true` 覆盖 @intent。
