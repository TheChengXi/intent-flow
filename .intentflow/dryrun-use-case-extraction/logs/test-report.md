# TDD 测试报告：dryrun-use-case-extraction

> 说明：sub-agent 通道不可用（list_agents 为空），由主会话以 TDD 精神执行（测试先行 → 实现 → 验证）。

## 目标文件
`src/application/useCases/DryRunUseCase.ts`

## 测试文件
`src/application/useCases/DryRunUseCase.test.ts`

## 接口签名列表（code-writer 的实现契约）

```typescript
class DryRunUseCase {
  static createDryRunUseCase(
    repository: IDryRunRepository,      // 系统边界：持久化（测试传 Fake）
    statisticsService: DryRunStatisticsService  // 纯计算，真实实现
  ): DryRunUseCase;

  toggle(): boolean;                    // 翻转状态，通知 onStateChange，返回新状态
  isEnabled(): boolean;                 // 当前状态，初始 false
  intercept(role: string, systemPrompt: string, userMessage: string): Promise<void>;
  onStateChange(callback: (enabled: boolean) => void): void;
  onIntercept(callback: (filePath: string) => void): void;
  onError(callback: (error: Error, content?: string) => void): void;
}
```

## 覆盖的测试场景（7 个）

1. 初始状态为未启用（isEnabled() === false）
2. toggle 翻转状态并返回新状态（true → false）
3. toggle 触发 onStateChange 监听器并传入新状态
4. 监听器抛错不阻断 toggle 状态翻转
5. 多个 onStateChange 监听器均被触发
6. intercept 完整链路：统计（真实 DryRunStatisticsService）→ 建记录 → repository.save（Fake 捕获 record/outputDir）→ 通知 onIntercept
7. intercept 保存失败：触发 onError（Error 对象 + 完整降级内容 # System Prompt 格式），不向上抛错

## Mock 边界
- FakeRepository：仅替代系统边界（文件 IO + vscode workspace），实现 IDryRunRepository，捕获 save 入参、可模拟失败
- DryRunStatisticsService：真实实现（零 import 纯计算），不 mock

## 验证结果
- RED：7/7 失败（Not implemented）
- GREEN：7/7 通过
