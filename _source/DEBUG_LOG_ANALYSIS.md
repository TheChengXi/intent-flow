# 调试日志分析指南

## 目的
通过添加的 console.log 语句，定位 CompilerContextManager.prepare() 在第二轮编译时挂起的具体位置。

## 添加的日志点

### CompilerContextManager.prepare()
1. `[CompilerContextManager] 开始准备编译上下文`
2. `[CompilerContextManager] 解析注释...`
3. `[CompilerContextManager] 注释解析成功: {functionName}`
4. `[CompilerContextManager] 读取 COMPILE_SPEC...`
5. `[CompilerContextManager] COMPILE_SPEC 读取成功，长度: {length}`
6. `[CompilerContextManager] 读取上次编译记录...`
7. `[CompilerContextManager] 上次编译记录: 存在/不存在`
8. `[CompilerContextManager] 检测步骤差异...`
9. `[CompilerContextManager] 验证上次生成的代码...`
10. `[CompilerContextManager] 上次代码有效性: {boolean}`
11. `[CompilerContextManager] 调用 StepDiffDetector.detectDiff...`
12. `[CompilerContextManager] 步骤差异检测完成`
13. `[CompilerContextManager] 是否使用增量模式: {boolean}`
14. `[CompilerContextManager] 读取上次审查记录...`
15. `[CompilerContextManager] 上次审查记录: 存在/不存在`
16. `[CompilerContextManager] 提取引用的契约...`
17. `[CompilerContextManager] 调用 extractFunctionCallsFromText...`
18. `[CompilerContextManager] 提取到的函数调用数量: {count}`
19. `[CompilerContextManager] 提取 import 语句...`
20. `[CompilerContextManager] 提取到的导入文件数量: {count}`
21. `[CompilerContextManager] 调用 searchContractsForFunctions...`
22. `[CompilerContextManager] 搜索到的契约数量: {count}`
23. `[CompilerContextManager] 构建基础上下文...`
24. `[CompilerContextManager] 检查审查反馈...`
25. `[CompilerContextManager] 上次审查不通过，加载反馈` (条件性)
26. `[CompilerContextManager] 上下文准备完成`

## 如何使用

### 步骤1：重新加载扩展
1. 按 F5 启动调试模式，或
2. 在扩展开发窗口中按 Ctrl+R 重新加载

### 步骤2：执行测试
1. 打开 test-cases/incrementalTest.ts
2. 选中 calculateTotal 的 @contract 注释
3. 执行 "CDD: 编译注释为代码"
4. 当审查失败时，选择"重新编译"

### 步骤3：查看输出
1. 打开 VSCode 的"输出"面板（View → Output）
2. 选择"扩展主机"或"调试控制台"
3. 查找最后一条 [CompilerContextManager] 日志

### 步骤4：定位问题
根据最后一条日志，判断挂起位置：

| 最后一条日志 | 可能的问题 |
|------------|----------|
| `读取上次编译记录...` | HistoryService.getLastCompilerRecord() 阻塞 |
| `调用 StepDiffDetector.detectDiff...` | StepDiffDetector.detectDiff() 阻塞 |
| `读取上次审查记录...` | HistoryService.getLastReviewerRecord() 阻塞 |
| `调用 extractFunctionCallsFromText...` | WorkLineService.extractFunctionCallsFromText() 阻塞 |
| `调用 searchContractsForFunctions...` | WorkLineService.searchContractsForFunctions() 阻塞 |

## 预期行为

### 第一轮编译（正常）
```
[CDDWorkflow] 第 1 轮编译开始
[CDDWorkflow] 准备编译上下文...
[CompilerContextManager] 开始准备编译上下文
[CompilerContextManager] 解析注释...
[CompilerContextManager] 注释解析成功: calculateTotal
...
[CompilerContextManager] 上下文准备完成
[CDDWorkflow] 编译上下文准备完成，增量模式: false
```

### 第二轮编译（挂起）
```
[CDDWorkflow] 用户选择: 重新编译
[CDDWorkflow] 用户选择继续，准备下一轮编译
[CDDWorkflow] 第 2 轮编译开始
[CDDWorkflow] 删除上次生成的代码...
[CDDWorkflow] 准备编译上下文...
[CompilerContextManager] 开始准备编译上下文
[CompilerContextManager] 解析注释...
[CompilerContextManager] 注释解析成功: calculateTotal
[CompilerContextManager] 读取 COMPILE_SPEC...
[CompilerContextManager] COMPILE_SPEC 读取成功，长度: 123
[CompilerContextManager] 读取上次编译记录...
<--- 可能在这里挂起 --->
```

## 下一步行动

根据定位结果：
1. 如果挂在文件读取 → 检查文件锁或异步操作
2. 如果挂在历史记录读取 → 检查 HistoryService 实现
3. 如果挂在契约搜索 → 检查 WorkLineService 实现
4. 如果挂在步骤差异检测 → 检查 StepDiffDetector 实现

## 相关文件
- [CompilerContextManager.ts](../src/viewmodel/context/CompilerContextManager.ts)
- [CDDWorkflow.ts](../src/viewmodel/workflow/CDDWorkflow.ts)
- [HistoryService.ts](../src/model/services/HistoryService.ts)
- [WorkLineService.ts](../src/model/services/WorkLineService.ts)
- [StepDiffDetector.ts](../src/model/services/StepDiffDetector.ts)
