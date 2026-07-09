# 04 资源引用：组件的外部数据契约

资源引用是协议的第四维度。定义组件如何引用外部文本和图片资源，而非在协议中直接内联。

## 定位

| 协议维度 | 管什么 |
|----------|--------|
| 01 static.md | 组件长什么样（节点 / CSS / props / slots） |
| 02 behavior.md | 组件怎么动（状态机 / 迁移 / 运动参数） |
| 03 runtime.md | 运行时数据怎么流（快照 / dryRun / invokeAction） |
| **04 resource.md** | **组件引用什么外部资源（文本 / 图片的引用契约）** |

## 引用语法

### 文本引用

```
@text.<分类>.<键名>
```

例：`@text.dialog.confirm`、`@text.message.error`

### 图片引用

```
@image.<分类>.<键名>
```

例：`@image.icon.folder`、`@image.logo.brand`

## 在协议中使用

```typescript
// 协议中引用资源（格式自定，此处仅展示引用语法）
const dialogProtocol = {
  type: "dialog",
  props: {
    title: "@text.dialog.title",       // 引用文本资源
    confirmLabel: "@text.base.confirm",
    icon: "@image.icon.dialog-info",   // 引用图片资源
  }
}
```

## 推荐大纲（推荐，非强制）

文本和图片的物理文件用什么格式存储，由使用者自定。可以是 TypeScript 变量声明、JSON、YAML，或其他任何格式。**协议只规定如何引用，不规定如何存储。**

### 文本资源推荐大纲

按语义角色分层，而不是按 UI 组件归属。这样非开发人员只需改 value，不碰组件逻辑。

下面以 TypeScript 变量声明为例：

```
resource/text/
├── 00-base.ts          ← 原子级语义：确认/取消/修改/删除/保存……
├── 01-dialog.ts        ← 对话框级：你确定要修改吗？……
├── 02-message.ts       ← 提示信息级：操作成功/网络错误/……
├── 03-content.ts       ← 内容级：大段正文/说明文/多段文档
├── 04-label.ts         ← 标签级：占位符/按钮文字/图例
└── 99-legacy.ts        ← 历史兼容/废弃保留
```

文件内容示例（TS）：

```typescript
// 00-base.ts
export const base = {
  dialog: {
    confirm: "确认",
    deny: "否认",
    cancel: "取消",
    modify: "修改",
  }
}

// 01-dialog.ts
export const dialog = {
  confirmModify: "你确定要修改吗？",
  confirmDeny: "你确定要否认吗？",
  confirmDelete: "你确定要删除吗？",
}

// 03-content.ts
export const content = {
  main: `此处可以是几万行长文……
完整文档内容……`,
  section: `此处可以是几千字分段内容……`,
}
```

**key 的设计原则**：key 是语义路径，供 LLM 直接理解文本角色。value 是纯文案，非开发人员直接修改 value 即可，不需要理解 UI 组件逻辑。

> 如果需要论文式的结构，key 可以精细到段落级别，选择判断的语义粒度由架构师自行决定。变量导入成本极低，自由度高。

不同团队也可以选择用 YAML 或 JSON 存储文本资源，只要保证 key 的语义路径唯一即可。

### 图片资源推荐大纲

按用途分类，方便查找和替换：

```
resource/image/
├── icon/               ← 图标类
│   ├── folder.svg
│   ├── file.svg
│   └── close.svg
├── logo/               ← 品牌类
│   └── brand.png
├── illustration/       ← 插画类
│   └── empty-state.svg
└── background/         ← 背景类
    └── texture.png
```

引用方式：图片推荐在组件的 render 层通过 import 导入，协议中只传标识符：

```typescript
// render.ts
import FolderIcon from '@resource/image/icon/folder.svg'

// 协议中 props.iconRef 只传 "folder"，render 层根据 ref 映射到实际 import
```

## 解析方式（按实现自选）

资源引用的解析时机取决于存储格式：

- **TypeScript 变量**：直接 `import`，编译时即完成，无需额外解析步骤
- **JSON / YAML**：在协议编译阶段加一步 Resource Resolver，将 `@text.xxx` 替换为实际文案

两种方式都不影响运行时数据流：

```
协议定义（含 @text / @image 引用）
    │
    ▼
Resource 解析（import 或 Resolver）
    │
    ▼
换算层 ── 收到的已经是解析后的值，不知道资源引用存在
    │
    ▼
运行时管理层 → 渲染执行层
```

## Pretext 预处理（推荐）

对于文本资源，推荐通过 `@chenglou/pretext` 统一预处理，将纯文本转为 PreparedText。

```typescript
import { prepareText } from '../resource/text'

// 经过 prepare 后，layout() 纯算术 0.0002ms，不触发 DOM 回流
const prepared = prepareText('确认', '14px sans-serif')
```

这并非强制要求。简单文本（标签、按钮文案）直接使用字符串即可，无需经过 Pretext。

## 约束

| # | 约束 | 违反后果 |
|---|------|---------|
| R1 | **引用不跨越**：`@text` 只能引用文本，`@image` 只能引用图片 | 解析失败 |
| R2 | **key 唯一**：同分类下的键名全局唯一 | 引用冲突 |
| R3 | **解析纯函数**：若使用 Resolver，则不依赖运行时状态 | 不可复用 |
