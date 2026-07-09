# 01 — 静态结构约定（Static Structure）

## 1. 总则

一个 UI 页面是一个**递归的组件树**。

每个节点是一个组件节点，节点内部可以包含子节点。没有独立的"页面层"或"布局层"——页面本身也是一个组件。

## 2. 组件节点格式

每个组件节点必须满足以下结构：

```yaml
# ─── 节点标识 ───
identity: string              # 树内唯一标识
type: string                  # 组件类型名，如 "navigation-bar"、"dashboard"
framework: "vue" | "react" | "svelte" | "agnostic"
                              # 默认 agnostic（框架无关）

# ─── 数据接口 ───
props:
  - name: string              # prop 名
    type: string              # 类型描述（人类可读）
    kind: "structural" | "content"
                              # structural = 结构参数（布局、行为、数据源）
                              # content = 内容参数（文案、标签、文本）
                              # content 类参数视为占位符，具体文案由外部注入
    required: boolean         # 是否必填
    default?: any             # 默认值
    description?: string      # 语义说明

# ─── 子节点插槽 ───
slots:
  - name: string              # 插槽名
    cardinality: "0-1" | "0-n" | "1-n"
                              # 子节点数量约束
    accepts?: string[]        # 允许的子组件 type 列表（空 = 不限）
    description?: string      # 插槽语义

# ─── CSS 骨架 ───
css:
  layout: "percentage"        # 布局单位必须是 percentage 或 token
  sizing:
    width: string             # 如 "60%", "100%", "auto"
    height?: string           # 如 "auto", "100%"
  spacing: string             # 间距单位，如 "2%"
  tokens: string[]            # 引用的设计 token，如 ["primary", "bg"]
  position?: string           # 定位方式，如 "static"、"relative"、"absolute"
```

### 2.1 identity 规则

- 在同一棵组件树内唯一
- 采用点号路径建议：`"page.dashboard.speed-gauge"`
- 由父节点生成子节点的 identity，不依赖外部 ID 生成器

### 2.2 type 命名规则

- 小写字母 + 连字符，如 `navigation-bar`、`speed-gauge`
- 不包含框架前缀（不要写 `vue-navigation-bar`）

## 3. 组件树的递归定义

一棵组件树是一个根节点，根节点可以包含任意深度的子节点：

```yaml
ComponentTree:
  root: ComponentNode
  # 递归：ComponentNode.slots[].children[] = ComponentNode[]
```

示例—地图页面：

```yaml
root:
  identity: "page"
  type: "page"
  props:
    - name: "bgImage"
      type: "url"
      required: true
  slots:
    - name: "default"
      cardinality: "0-n"
  css:
    layout: "percentage"
    width: "100%"
    height: "100%"
    tokens: ["bg"]
  children:
    - identity: "page.map"
      type: "map"
      props:
        - name: "zoom"
          type: "number"
          required: false
          default: 1
      slots:
        - name: "overlay"
          cardinality: "0-n"
      css:
        width: "100%"
        height: "80%"
        tokens: ["bg"]
      children:
        - identity: "page.map.dashboard"
          type: "dashboard"
          props:
            - name: "data"
              type: "{ speed: number, fuel: number }"
              required: true
          slots:
            - name: "gauges"
              cardinality: "0-n"
          css:
            width: "30%"
            height: "40%"
            position: "absolute"
            tokens: ["secondary", "bg"]
          children:
            - identity: "page.map.dashboard.speed-gauge"
              type: "gauge"
              props:
                - name: "value"
                  type: "number"
                  required: true
                - name: "min"
                  type: "number"
                  default: 0
                - name: "max"
                  type: "number"
                  default: 200
              css:
                width: "100%"
                height: "50%"
                tokens: ["accent"]
            - identity: "page.map.dashboard.warning-light"
              type: "warning-light"
              props:
                - name: "status"
                  type: "on" | "off"
                  required: true
              css:
                width: "20%"
                height: "20%"
                tokens: ["accent"]
    - identity: "page.navbar"
      type: "navigation-bar"
      props:
        - name: "items"
          type: "MenuItem[]"
          required: true
      css:
        width: "100%"
        height: "10%"
        tokens: ["primary"]
```

## 4. 容器组件 vs 叶子组件

```yaml
# 容器组件：有 slots，可以容纳子节点
ContainerComponent:
  slots: # 至少一个 slot
    - name: string
      cardinality: "0-n" | "1-n"

# 叶子组件：没有 slots，或 slots 的 cardinality 为 "0-1" 且为空
LeafComponent:
  slots: [] # 或全部 optional 且预期无子节点
```

规则：
- 容器组件不定义自己的交互行为影响子节点
- 叶子组件是交互行为的主要载体（按钮、仪表盘、滑块...）
- 容器组件可以透传向下传数据，但不能替子节点做交互决策

## 5. CSS 骨架规范

### 5.1 单位

| 优先 | 允许 | 禁止 |
|------|------|------|
| `%`（百分比） | `vw` / `vh` | `px`（除非是 1px 的边框） |
| `token` | `em` / `rem` | 固定像素宽高 |

### 5.2 Token 体系

token 不在此协议中定义具体值，由人类在审美阶段确定：

```
primary   → 人类定
secondary → 人类定
accent    → 人类定
bg        → 人类定
text      → 人类定
```

组件只引用 token 名，不引用具体色值。

### 5.3 定位

- 默认 `static`（文档流）
- `absolute` 仅在明确需要覆盖在另一个组件之上时使用
- `relative` 用于为子组件的 absolute 定位提供锚点

## 6. 内容占位（Content / Structure 分离）

### 6.1 原则

**文案和结构是两种不同的工程。**

对 LLM 而言，组件树结构（identity、props、slots、CSS）和文本内容（标题、按钮文案、描述）都是一份数据。但两者应分离——AI 应倾注全力于静态结构（组件树），文本内容应交给人或专门的文案工程处理。

这与「图片=插槽」是同一逻辑的延伸：

```
图片 = 插槽  →  组件只标记宽高比，不填充实际图片
文案 = 插槽  →  组件只标记文本位置和语义角色，不填充实际文案
```

### 6.2 Content props 的约束

props 中 `kind: "content"` 的字段，满足以下规则：

```yaml
# ✅ 合法：只声明需要什么内容，不写具体文案
- name: "title"
  type: "string"
  kind: "content"
  required: true
  description: "仪表盘标题"

- name: "buttonLabel"
  type: "string"
  kind: "content"
  default: "确认"   # 可以给一个通用默认值，人类可替换
  description: "按钮上的文案"

# ❌ 不合法：把具体文案写死在结构定义中
- name: "title"
  kind: "content"
  default: "欢迎来到我的仪表盘"   # 禁止：具体文案不应出现在结构定义里
```

### 6.3 Content 参数的注入来源

content 参数的来源不是协议关心的事，但协议声明其注入方式：

```yaml
ContentInjection:
  sources:
    - type: "human"           # 人类直接填写
      scope: "任意字段"
    - type: "copywriter"      # 专门的文案 AI 或服务生成
      scope: "整段文案"
    - type: "i18n"            # 国际化资源文件
      scope: "多语言场景"
    - type: "default"         # 组件自带的默认值（仅占位用）
      scope: "content 字段的 default"
      note: "默认值不是正式文案，只是让组件在开发时可见的占位文本"
```

### 6.4 混写 vs 分离 的对比

```yaml
# ❌ 混写：AI 同时处理结构和文案，两者边界模糊
props:
  - name: "title"
    value: "欢迎来到饭店管理系统"     # AI 既要搭结构又要写文案
  - name: "menuItems"
    value: ["宫保鸡丁", "鱼香肉丝"]   # 数据结构混着内容数据

# ✅ 分离：AI 只搭结构，文案留作占位
props:
  - name: "title"
    type: "string"
    kind: "content"               # AI 只声明这里需要文案
    # 具体文案 → 交给人类或文案 AI
  - name: "menuItems"
    type: "MenuItem[]"
    kind: "content"               # AI 只声明菜单数据结构
    # 具体菜单项 → 交给饭店老板或菜单管理模块
```

## 7. 约束规则（组件必须满足）

```
约束清单
──────────────────────────
① 树必须有且只有一个根节点
② 每个节点 identity 在树内唯一
③ props 中 required 的字段，父组件必须提供
④ 子节点 type 必须匹配父节点 slots.accepts（如有约束）
⑤ CSS 不允许固定 px（边框线宽除外）
⑥ 颜色只引用 token，不引用具体色值
⑦ 容器组件不越界操作子组件的内部状态
⑧ content 类 props 不得携带具体业务文案作为 default
⑨ content 类 props 必须由外部注入，组件不自生产文案
```
