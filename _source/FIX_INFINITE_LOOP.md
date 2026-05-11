# 修复无限循环编译问题

## 问题描述

在 v2.5.0 的 Workflow 调度器中发现严重的 Token 消耗问题：

### 问题场景
1. 用户执行编译命令
2. 编译器返回错误消息（而不是代码）
3. 错误消息被插入到编辑器
4. 自动触发审查，审查这段错误消息
5. 审查失败，触发重新编译
6. 重新编译又返回错误消息
7. **无限循环** → 不停烧 Token！

### 根本原因
- 编译失败时，`compileResult.success = true` 但 `artifacts` 包含错误消息文本
- Workflow 没有验证生成的代码是否有效
- 没有检测到重复失败的情况

## 修复方案

### 1. 添加代码有效性验证
```typescript
// 验证生成的代码不是错误消息
if (lastCode.includes('I cannot proceed') ||
    lastCode.includes('Missing Prerequisites') ||
    lastCode.includes('CRITICAL:') ||
    lastCode.length < 50) {
  return {
    success: false,
    message: '编译器返回了无效的代码，请检查输入或配置',
    executionPath
  };
}
```

### 2. 跟踪编译状态
```typescript
let previousCompileSuccess = true; // 跟踪上次编译是否成功

// 如果这是重试且上次编译失败，跳过自动审查
if (retryCount > 0 && !previousCompileSuccess) {
  return {
    success: true,
    message: '编译完成（跳过自动审查，避免循环）',
    finalCode: lastCode,
    executionPath
  };
}
```

### 3. 保持原有的最大重试限制
- 最多重试 3 次
- 达到上限后触发裁决机制（路径A/路径B）

## 修复效果

### 修复前
```
编译 → 返回错误消息 → 插入错误消息 → 审查失败 → 重新编译 → 返回错误消息 → ...
（无限循环，每次消耗 Token）
```

### 修复后
```
编译 → 返回错误消息 → 检测到无效代码 → 立即停止 → 提示用户
（单次失败，不进入循环）
```

## 安全措施总结

1. **代码有效性检查** - 检测错误消息关键词
2. **最小长度验证** - 代码少于 50 字符视为无效
3. **重试状态跟踪** - 避免重复失败进入循环
4. **最大重试限制** - 3 次后强制停止
5. **用户裁决机制** - 达到上限后让用户选择路径

## 测试建议

### 场景1：正常编译
- 输入：有效的 @contract 注释
- 预期：正常编译 → 审查 → 通过

### 场景2：编译失败
- 输入：格式错误的注释
- 预期：编译失败 → 立即停止 → 不进入循环

### 场景3：审查不通过
- 输入：有效注释，但生成的代码有问题
- 预期：编译 → 审查失败 → 重新编译（最多3次）→ 触发裁决

### 场景4：编译器返回错误消息
- 输入：缺少必要配置（如 COMPILE_SPEC）
- 预期：检测到无效代码 → 立即停止 → 提示用户

## 相关文件

- `src/viewmodel/workflow/CDDWorkflow.ts` - 主要修复文件
- `test-cases/.cdd/history/incrementalTest/calculateTotal.json` - 发现问题的历史记录

## 版本信息

- 修复版本：v2.5.1（待发布）
- 修复日期：2026-05-11
- 影响范围：所有使用 Workflow 调度器的编译流程
