# Code Report — GuardToggleStore

## 文件路径
- `src/data/services/guard/GuardToggleStore.ts`（实现 GuardToggleStore）

## 实现内容
- `read(): boolean` — 同步 `readFileSync` 读取 `<process.cwd()>/.intentflow/guard-state.json`，`JSON.parse` 后校验 `enabled` 字段为 boolean 才返回其值；文件不存在 / JSON 解析失败 / 非对象 / enabled 缺失或类型非法，一律 catch 后返回 `true`（默认安全态），不抛异常。
- `write(enabled: boolean): Promise<void>` — `node:fs/promises` 的 `mkdir(..., { recursive: true })` 确保 `.intentflow` 目录存在，再 `writeFile` 写入 `JSON.stringify({ enabled })`。失败直接抛出，不做兜底。
- 类名/构造签名保持不变（无构造参数），无额外导出；文件顶部 @intent 注释未改动。
- 导入调整：`writeFile` 从 `node:fs`（回调版）改为 `node:fs/promises`（Promise 版），与异步 write 语义匹配；新增 `mkdir` 导入。

## GREEN 验证
- 类型自检：`npx tsc --noEmit src/data/services/guard/GuardToggleStore.ts --module commonjs --target es2022 --moduleResolution node --skipLibCheck` → exit 0，无语法/类型错误。
- 未运行测试文件（按要求不读取测试文件），实现严格对照 test-writer 锁定的接口签名与 @intent 边界。

## 决策点
1. **异步 IO 选型**：@intent 允许 `node:fs/promises` 的 writeFile。write() 本身是 async，故 mkdir + writeFile 均用 promises 版本，保持全异步、无回调嵌套；read() 必须同步，用 `readFileSync`。
2. **JSON 内容格式**：`JSON.stringify({ enabled })` 紧凑格式（无缩进），满足 `{ enabled: <boolean> }` 要求，解析侧不依赖格式。
3. **安全态判断顺序**：先判 parsed 为对象（含 null 排除），再取 `enabled` 字段做 `typeof === 'boolean'` 收窄，避免 `as` 断言误伤；非 boolean 一律 true。

## 疑虑 / 卡点
- 无。实现路径与 @intent 验收条件逐条对应。

---

# Code Report — GuardToggleService

## 文件路径
- `src/application/services/GuardToggleService.ts`（实现 GuardToggleService）
- 依赖：`src/data/services/guard/GuardToggleStore.ts`、`src/application/services/IGuardToggleService.ts`（仅读取，未改动）

## 实现内容
- 新增私有字段 `private enabled: boolean`；构造函数（签名保持 `constructor(private store: GuardToggleStore)` 不变）内 `this.enabled = this.store.read()` 一次性同步加载初始状态，store 内部已兜底安全态 true，本类不做二次兜底。
- `isEnabled(): boolean` — 直接返回内存状态，同步且不抛异常。
- `toggle(): Promise<boolean>` — 先翻转内存 `this.enabled = !this.enabled`，再 `await this.store.write(this.enabled)` 异步写回，返回新状态；写失败时异常向上传播，但内存已翻转（本次会话生效）。
- 文件顶部 @intent 注释未改动；无额外导出；无过度设计（无缓存、无重试、无并发控制）。

## GREEN 验证
- 类型自检：`npx tsc --noEmit`（含该文件 + 依赖两文件，`--strict --module commonjs --target es2022`）→ exit 0，无语法/类型错误。
- 未运行测试文件（按要求不读取测试文件），实现严格对照锁定的接口签名与 @intent 边界。

## 决策点
1. **内存状态字段命名与初始化位置**：字段声明与构造参数属性（parameter property）并列，赋值放构造函数体内，满足 strict 属性初始化检查，且保持构造签名不变。
2. **toggle 顺序**：先翻内存再写盘，严格符合 @intent“写失败抛错，但内存已翻转”的语义；返回值取翻转后的内存值（`this.enabled`）而非局部变量，语义一致且更简洁。
3. **不做二次兜底**：构造时若 store.read() 抛错（按契约不应发生，store 自身 catch），本类直接向上传播，不吞异常。

## 疑虑 / 卡点
- 无。依赖方向正确：application 层依赖 data 层（import type GuardToggleStore），无反向/跨层依赖。
