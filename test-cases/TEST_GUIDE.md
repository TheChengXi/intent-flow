# 测试指南

## 测试文件说明

### 1. simple-function.ts
- **场景**：简单函数（无 @step，无 @boundary）
- **目的**：验证新提示词支持只有 @contract 的简单函数
- **预期**：编译器应该生成简单的加法函数

### 2. complex-function.ts
- **场景**：复杂函数（多个 @step 和 @boundary）
- **目的**：验证完整的 CDD 注释编译
- **预期**：编译器应该实现所有步骤和边界处理

### 3. src/view/UserProfile.tsx
- **场景**：前端组件函数
- **目的**：验证前端规范自动选择
- **路径匹配**：`src/view/**` → `COMPILE_SPEC_FRONTEND.md`
- **预期**：使用前端规范（如果存在）

### 4. src/model/UserService.ts
- **场景**：后端服务函数
- **目的**：验证后端规范自动选择
- **路径匹配**：`src/model/**` → `COMPILE_SPEC_BACKEND.md`
- **预期**：使用后端规范（如果存在）

### 5. calculateDiscount.test.ts
- **场景**：测试文件
- **目的**：验证测试规范自动选择
- **路径匹配**：`**/*.test.ts` → `COMPILE_SPEC_TEST.md`
- **预期**：使用测试规范（如果存在）

## 测试步骤

1. **启动 VS Code**
2. **打开测试文件**（选择上述任一文件）
3. **选中 CDD 注释**（从 `// @contract` 到 `// @end`）
4. **按 F5 或运行编译命令**
5. **观察结果**：
   - 检查生成的代码是否符合预期
   - 检查控制台日志，确认使用了正确的规范文件
   - 检查是否有未知依赖警告

## 预期日志输出

```
[CompilerContextManager] 读取 COMPILE_SPEC...
[CompilerContextManager] 检测到前端文件，尝试使用前端规范
[CompilerContextManager] 使用规范: COMPILE_SPEC_FRONTEND.md
```

或者（如果规范不存在）：

```
[CompilerContextManager] 特定规范不存在，使用通用规范: COMPILE_SPEC.md
```

或者（如果没有任何规范）：

```
[CompilerContextManager] 未找到任何编译规范
```

## 验证点

- [ ] 简单函数能正常编译
- [ ] 复杂函数实现了所有 @step 和 @boundary
- [ ] 前端文件使用了前端规范（如果存在）
- [ ] 后端文件使用了后端规范（如果存在）
- [ ] 测试文件使用了测试规范（如果存在）
- [ ] 无规范场景能正常工作
- [ ] 未知依赖会输出警告
- [ ] 重载函数能找到所有版本
