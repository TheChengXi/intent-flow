# 架构设计文档：VSCode 能力地图插件

## 能力 → 模块映射

| 核心能力 | 所属模块 | 层级 | 设计理由 |
|---------|---------|------|---------|
| 能力地图 Webview 渲染 | CapabilityMapPanel | adapter/vscode/ui | VSCode Webview API 在适配层，负责纯渲染 |
| 能力地图数据编排 | CapabilityMapController | adapter/vscode | 编排多个元能力（ListFolderIntents / trace_dependency_chain），属于适配层的编排逻辑 |
| 文件夹选择 + 意图清单获取 | ListFolderIntentsUseCase | application | 已有的元能力，插件只是消费者 |
| 入口文件依赖追踪 | TraceDependencyChainUseCase | application | 已有的元能力，插件只是消费者 |
| 能力分组持久化 | IntentPackageRepository | data | 已有的数据层，插件写入 `.cdd/packages/*.yml` |
| @intent 实时读取 | IFileRepository | data | 已有的数据层，插件直接读取文件 |

## 模块定义

### CapabilityMapPanel
- **层级**：adapter/vscode/ui
- **职责**：管理 VSCode Webview 面板的创建、销毁、消息通信；渲染图形界面（三角形/圆形/方形/箭头）
- **入口文件**：`src/adapter/vscode/ui/CapabilityMapPanel.ts`
- **依赖模块**：CapabilityMapController（获取数据）
- **被哪些模块依赖**：extension.ts（注册命令时创建）

### CapabilityMapController
- **层级**：adapter/vscode
- **职责**：接收 Webview 的消息，调用 CoreDIContainer 的元能力（ListFolderIntentsUseCase / TraceDependencyChainUseCase / IFileRepository），返回数据给 Webview
- **入口文件**：`src/adapter/vscode/CapabilityMapController.ts`
- **依赖模块**：CoreDIContainer（application + data），CapabilityMapPanel（发送消息）
- **被哪些模块依赖**：CapabilityMapPanel（调用）

### CapabilityMapCommand
- **层级**：adapter/vscode/commands
- **职责**：VSCode 命令 `cdd.openCapabilityMap` 的入口，创建 CapabilityMapPanel 实例
- **入口文件**：`src/adapter/vscode/commands/CapabilityMapCommand.ts`
- **依赖模块**：CapabilityMapPanel
- **被哪些模块依赖**：extension.ts（注册命令）

## 架构数据流

```
用户操作 Webview
    │ postMessage
    ▼
CapabilityMapPanel (adapter/vscode/ui)
    │ 委托
    ▼
CapabilityMapController (adapter/vscode)
    │ 调用 CoreDIContainer 元能力
    ▼
┌──────────────────────────────────────────┐
│  应用层 (Application)                    │
│  ListFolderIntentsUseCase                │
│  TraceDependencyChainUseCase             │
│  GenerateIntentPackageUseCase            │
│  MaintainIntentPackagesUseCase           │
└────────────┬─────────────────────────────┘
             │
┌────────────┴─────────────────────────────┐
│  数据层 (Data)                           │
│  IFileRepository (实时读 @intent)         │
│  IntentPackageRepository (读写 packages)  │
└──────────────────────────────────────────┘
```

## Webview ↔ Extension 通信协议

```typescript
// Webview → Extension 的消息
type WebviewMessage =
  | { type: 'selectFolder'; folder: string }
  | { type: 'openSubfolder'; folder: string }
  | { type: 'doubleClickGroup'; groupName: string; entryFile: string }
  | { type: 'saveGroups'; packageName: string; groups: IntentGroup[]; crossRefs: CrossReference[] }
  | { type: 'hoverFile'; filePath: string };

// Extension → Webview 的消息
type ExtensionMessage =
  | { type: 'folderData'; data: ListFolderIntentsResult & { groups?: IntentGroup[] } }
  | { type: 'traceData'; data: TraceDependencyChainOutput }
  | { type: 'intentDetail'; filePath: string; intent: string | null }
  | { type: 'saveResult'; success: boolean; message: string };
```

## 图形映射

| 图形 | 数据来源 | 消息类型 |
|------|---------|---------|
| △ 三角形 | `ListFolderIntentsResult.subdirectories[]` | `openSubfolder` |
| ⭕ 圆形 | `IntentPackage.groups[]` 或 LLM 聚类结果 | `doubleClickGroup` |
| ■ 方形 | `ListFolderIntentsResult.files[]` | `hoverFile` |
| → 箭头 | import 解析的同层依赖 | 预留 |

## 非默认决策

- **Webview 内渲染不依赖任何前端框架**：纯 HTML + CSS + Canvas/SVG 渲染，避免 webpack 构建依赖膨胀
- **不单独建数据模型文件**：复用已有的 `IntentPackage` / `ListFolderIntentsResult` / `TraceDependencyChainOutput` 类型，Webview 侧只做消费
- **CapabilityMapController 不做缓存**：@intent 详情实时读取文件系统；能力列表每次请求重新调用 UseCase（将来可按需加缓存层）
