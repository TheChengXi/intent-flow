# CDD Framework 向 Agent 输出信息流程图

## 当前实现的 3 个 Agent

### 1. CompilerVM（编译器）
### 2. ReviewerVM（审查员）
### 3. ArchitectVM（架构师，未完全实现）

---

## CompilerVM 输出信息流程

### 输入来源
```
用户编写的注释
    ↓
CDDComment {
  contract: { functionName, parameters, returnType, throwsTypes, version }
  steps: [{ description, isSimple }]
  boundaries: [{ description }]
}
    ↓
CompilerVM.execute(context)
```

### 构建提示词的顺序（当前实现）

```typescript
// 第 1 部分：系统提示（绝对稳定）
`你是 ${language} 编译器。根据 @contract 中的类型签名生成严格类型化的代码。

重要规则：
1. 函数参数必须包含完整的类型标注
2. 返回值必须包含类型标注
3. 当调用其他函数时，参考"引用的函数契约"部分  // 如果有引用契约
4. 上次审查发现问题，请根据"上次审查反馈"修正代码  // 如果有审查反馈
5. 严格遵循 COMPILE_SPEC 中的编码规范  // 如果有编译规范
...`

// 第 2 部分：函数契约（绝对稳定）
`## 函数契约
// @contract: add(a: number, b: number) => number
// @step: [计算] 计算 a + b
// @step: [返回] 返回结果
// @boundary: 当参数为 NaN 时，返回 NaN`

// 第 3 部分：引用的函数契约（较为稳定，❌ 当前未排序）
`## 引用的函数契约
// @contract: functionB() => void
// @contract: functionC() => void`

// 第 4 部分：审查反馈（最不稳定）
`## 上次审查反馈
类型标注不完整

## 上次生成的代码
\`\`\`
function add(a, b) { return a + b; }
\`\`\``

// 第 5 部分：增量编译信息（最不稳定）
`## 增量编译模式
未变化步骤占比: 50.0%

### 未变化的步骤（保持原实现）:
- 计算 a + b

### 新增的步骤（需要实现）:
- 添加输入验证

### 上次生成的代码（作为基础）:
\`\`\`
function add(a, b) { return a + b; }
\`\`\``

// 第 6 部分：编码规范（❌ 当前位置不对，应该在前面）
`## 编码规范
使用 const 声明常量，使用 let 声明变量`
```

### 当前顺序问题

❌ **问题 1**: 引用契约未排序
```typescript
// 如果传入顺序是 [functionC, functionB]
// 下次传入顺序是 [functionB, functionC]
// → 提示词不同 → 缓存失效
```

❌ **问题 2**: 编码规范位置不对
```typescript
// 当前：契约 → 引用契约 → 审查反馈 → 编码规范
// 应该：编码规范 → 契约 → 引用契约 → 审查反馈
```

---

## ReviewerVM 输出信息流程

### 输入来源
```
CompilerVM 生成的代码
    ↓
ReviewerVM.execute(context)
```

### 构建提示词的顺序（当前实现）

```typescript
// 第 1 部分：系统提示（绝对稳定）
`你是代码审查员。审查生成的代码是否符合契约要求。

审查要点：
1. 类型标注是否完整
2. 是否实现了所有 @step
3. 是否处理了所有 @boundary
4. 是否符合编码规范`

// 第 2 部分：函数契约（绝对稳定）
`## 函数契约
// @contract: add(a: number, b: number) => number
// @step: [计算] 计算 a + b
// @step: [返回] 返回结果
// @boundary: 当参数为 NaN 时，返回 NaN`

// 第 3 部分：生成的代码（每次不同）
`## 生成的代码
\`\`\`typescript
function add(a: number, b: number): number {
  return a + b;
}
\`\`\``

// 第 4 部分：编码规范（绝对稳定）
`## 编码规范
使用 const 声明常量，使用 let 声明变量`
```

### ReviewerVM 顺序分析

✅ **当前顺序合理**:
1. 系统提示（稳定）
2. 契约（稳定）
3. 生成的代码（不稳定，但必须在这里）
4. 编码规范（稳定）

---

## 三个 Agent 的信息流对比

| Agent | 输入 | 输出 | 稳定性关键 |
|-------|------|------|-----------|
| **CompilerVM** | 契约注释 | 代码 | 引用契约顺序、编码规范位置 |
| **ReviewerVM** | 契约 + 代码 | 审查意见 | 顺序已合理 |
| **ArchitectVM** | 需求描述 | 设计方案 | 未实现 |

---

## 修复后的 CompilerVM 顺序

```typescript
// ✅ 修复后的顺序
1. 系统提示（绝对稳定）
2. 编码规范（绝对稳定）← 移到前面
3. 函数契约（绝对稳定）
4. 引用的函数契约（较为稳定，排序后）← 添加排序
5. 审查反馈（最不稳定）
6. 增量编译信息（最不稳定）
```

---

## 总结

### 当前问题
1. ❌ CompilerVM 引用契约未排序
2. ❌ CompilerVM 编码规范位置不对
3. ❌ CallGraphService 依赖列表未排序（虽然稳定，但不利于未来）

### 修复优先级
1. **P0**: 引用契约排序（影响缓存命中率）
2. **P0**: 编码规范位置调整（影响缓存命中率）
3. **P1**: 依赖列表排序（预防未来问题）

### 三个 Agent 的信息流
- **CompilerVM**: 契约 → 代码（需要修复顺序）
- **ReviewerVM**: 契约 + 代码 → 审查意见（顺序已合理）
- **ArchitectVM**: 需求 → 设计（未实现）
