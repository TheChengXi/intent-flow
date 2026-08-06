# Test Report — GuardToggleService

## 文件路径

- 被测文件：`src/application/services/GuardToggleService.ts`
- 测试文件：`src/application/services/GuardToggleService.test.ts`
- 依赖签名来源：`src/data/services/guard/GuardToggleStore.ts`（仅接口部分）

## 接口签名清单（供 code-writer 使用）

```ts
export class GuardToggleService implements IGuardToggleService {
  constructor(private store: GuardToggleStore);
  isEnabled(): boolean;
  async toggle(): Promise<boolean>;
}
```

依赖 `GuardToggleStore` 签名：

```ts
export class GuardToggleStore {
  read(): boolean;                    // 同步，任何异常回退安全态 true，不抛异常
  async write(enabled: boolean): Promise<void>;  // 异步，失败抛错
}
```

## 覆盖的测试场景

| # | 验收条件 | 测试用例 |
|---|---------|---------|
| 1 | 构造时经 store.read() 同步加载初始状态，构造后 isEnabled() 反映持久化状态 | `构造后 isEnabled() 反映 store 持久化状态（read()=true → isEnabled()=true）`、`（read()=false → isEnabled()=false）`（it.each，真实 store + 落盘）；`构造时同步调用 store.read() 加载状态（fake read 返回 false → isEnabled() false）`（fake store，锁定"构造时同步读"） |
| 2 | toggle() 翻转内存并成功写回，返回新状态，true→false→true 连续翻转正确 | `toggle() 翻转内存状态、写回 store，并返回新状态`（fake store，断言返回值 + isEnabled() + write 调用参数 `[false, true]`）；`连续 toggle() true→false→true 翻转正确，且落盘状态一致`（真实 store，最终 `new GuardToggleStore().read() === false`） |
| 3 | toggle() 写失败抛错，且 isEnabled() 已为新值（内存先翻转） | `toggle() 写失败时抛错，且 isEnabled() 已为新值`（fake store write 抛错）；`toggle() 写失败后再次 toggle 仍基于已翻转的内存状态`（本次会话生效的延续锁定） |
| 4 | isEnabled() 为同步调用且不抛异常 | `isEnabled() 为同步调用且不抛异常`（真实 store 无文件场景，连续调用断言 boolean 且不抛） |
| 附加 | 边界：构造时读取失败由 store 兜底，本类不做二次兜底 | `构造时 store.read() 抛错向上传播（本类不做二次兜底）`（fake store read 抛错，构造器直接抛出） |

## 测试隔离说明

- 全部用例 `beforeEach` 用 `fs.mkdtempSync(join(os.tmpdir(), 'guard-toggle-service-'))` + `process.chdir()` 隔离 cwd，`afterEach` 恢复原 cwd 并 `rmSync` 清理（模式同 `GuardToggleStore.test.ts`）。
- 不 mock 被测类；大多数场景用真实 `GuardToggleStore` + 真实文件系统；仅写失败场景注入 fake store。
- fake store 采用 TS 结构类型（实现 `read()/write()` 签名），因 `GuardToggleStore` 含 private 成员 `configPath`，纯对象字面量无法直接结构赋值，经 `as unknown as GuardToggleStore` 桥接；默认 write 记录调用参数供断言。
- 使用 vitest，import 风格与项目既有测试一致。

## 运行验证

`npx vitest run src/application/services/GuardToggleService.test.ts` — 9 个测试全部收集并执行，当前全部失败（原因：被测类为 `not implemented` 占位实现，构造器先抛错，预期行为）；fake store 类型桥接、cwd 隔离、it.each 参数化均编译与运行正常。
