# CDD 框架实施计划

## 项目目标

使用 CCD 框架的三个 Agent 函数（Compiler、Translator、Reviewer）完整验证 CCD 框架项目本身，实现注释与代码的双向对照。

---

## 阶段 1：自举验证准备（1-2 周）

### 目标
为核心模块添加完整的 CDD 注释，建立验证基线。

### 任务清单

#### 1.1 核心服务模块注释化
- [ ] **WorkLineService.ts**
  - 已有部分注释，需补全所有方法
  - 重点：`extractFunctionCallsFromText`、`extractImportedFilesFromText`、`searchContractsForFunctions`
  
- [ ] **TreeSitterParser.ts**
  - 添加 `parseWorkLine`、`init`、`getLanguage` 的完整注释
  - 重点：AST 遍历逻辑、语言检测

- [ ] **HistoryService.ts**
  - 添加所有历史记录操作的注释
  - 重点：`addRecord`、`getLastCompilerRecord`、`getLastReviewerRecord`

#### 1.2 代码分析模块注释化
- [ ] **FunctionCallExtractor.ts**
  - 已有注释，验证完整性
  - 补充 Tree-sitter 节点类型说明

- [ ] **TypeReferenceExtractor.ts**
  - 已有注释，验证完整性
  - 补充类型提取逻辑的边界条件

- [ ] **ImportExtractor.ts**
  - 已有注释，验证完整性
  - 补充路径解析逻辑

#### 1.3 代码搜索模块注释化
- [ ] **ContractSearcher.ts**
  - 添加契约搜索的完整注释
  - 重点：正则匹配、文件遍历

- [ ] **TypeDefinitionSearcher.ts**
  - 已有注释，验证完整性
  - 补充 AST 节点匹配逻辑

#### 1.4 上下文管理模块注释化
- [ ] **CompilerContextManager.ts**
  - 已有注释，验证完整性
  - 重点：`prepare` 方法的复杂逻辑
  - 补充依赖提取、增量编译判断的边界条件

#### 1.5 ViewModel 模块注释化
- [ ] **CompilerVM.ts**
  - 添加 Compiler Agent 的完整注释
  - 重点：提示词构建、API 调用、错误处理

- [ ] **ReviewerVM.ts**
  - 添加 Reviewer Agent 的完整注释
  - 重点：审查维度、报告生成

- [ ] **TranslatorVM.ts**
  - 添加 Translator Agent 的完整注释
  - 重点：代码解析、注释生成

### 验收标准
- 所有核心模块都有完整的 @contract、@step、@boundary
- 每个 @step 精确到可验证的程度
- 所有 @boundary 覆盖异常情况

---

## 阶段 2：Compiler 验证（2-3 周）

### 目标
使用 Compiler 重新生成代码，验证注释的可编译性。

### 任务清单

#### 2.1 选择验证目标
优先选择以下模块进行验证：
1. **FunctionCallExtractor.ts** - 逻辑相对独立
2. **TypeReferenceExtractor.ts** - 逻辑相对独立
3. **ImportExtractor.ts** - 逻辑相对独立
4. **ContractSearcher.ts** - 逻辑相对独立
5. **TypeDefinitionSearcher.ts** - 逻辑相对独立

#### 2.2 编译验证流程
对每个模块执行以下步骤：

1. **备份原始代码**
   ```bash
   cp src/model/services/codeAnalysis/FunctionCallExtractor.ts \
      src/model/services/codeAnalysis/FunctionCallExtractor.ts.backup
   ```

2. **提取注释**
   - 复制模块的所有 CDD 注释
   - 保存为独立文件（用于 Compiler 输入）

3. **调用 Compiler**
   - 使用 VSCode 扩展：选中注释 → "CDD: Compile Comment to Code"
   - 或使用 API：`CompilerVM.compile(comment, 'typescript', compileSpec, referencedContracts)`

4. **对比代码**
   - 使用 `git diff` 对比原始代码和生成代码
   - 记录差异：
     - 功能差异（缺失功能、多余功能）
     - 实现差异（算法不同、数据结构不同）
     - 风格差异（命名、格式）

5. **分析差异原因**
   - 注释不够精确 → 改进注释
   - Compiler 理解错误 → 改进 Compiler 提示词
   - 编译规范不清晰 → 改进 COMPILE_SPEC

6. **迭代优化**
   - 根据差异分析改进注释或 Compiler
   - 重新编译
   - 直到生成代码与原始代码功能一致

#### 2.3 记录编译结果
为每个模块创建编译报告：
```markdown
## FunctionCallExtractor.ts 编译报告

**编译日期**：2026-05-14
**编译次数**：3

### 第 1 次编译
- **差异**：缺少 Tree-sitter 回退逻辑
- **原因**：@boundary 未明确说明回退条件
- **改进**：添加 @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案

### 第 2 次编译
- **差异**：正则表达式不完全一致
- **原因**：@step 未精确描述正则模式
- **改进**：在 @step 中明确正则表达式

### 第 3 次编译
- **差异**：无功能差异，仅变量命名不同
- **结论**：✅ 编译成功

### 信息保留率
- 功能完整性：100%
- 实现细节：85%
- 代码风格：90%
```

### 验收标准
- 至少 5 个模块通过 Compiler 验证
- 生成代码的功能完整性 ≥ 95%
- 识别并记录所有信息损失点

---

## 阶段 3：Reviewer 验证（1-2 周）

### 目标
使用 Reviewer 验证现有代码与注释的一致性。

### 任务清单

#### 3.1 审查所有已注释模块
对每个已添加注释的模块执行审查：

1. **调用 Reviewer**
   - 使用 VSCode 扩展：选中注释和代码 → "CDD: Review Code"
   - 或使用 API：`ReviewerVM.review(comment, code, compileSpec)`

2. **分析审查报告**
   - 记录所有 FAIL 和 WARN
   - 分类问题：
     - 注释问题（注释不准确、不完整）
     - 代码问题（代码未实现注释要求）
     - 规范问题（COMPILE_SPEC 不清晰）

3. **修正问题**
   - 注释问题 → 修改注释
   - 代码问题 → 修改代码或重新编译
   - 规范问题 → 更新 COMPILE_SPEC

4. **重新审查**
   - 修正后重新调用 Reviewer
   - 直到所有维度 PASS

#### 3.2 记录审查结果
为每个模块创建审查报告：
```markdown
## FunctionCallExtractor.ts 审查报告

**审查日期**：2026-05-14
**审查次数**：2

### 第 1 次审查
- @contract 匹配: PASS
- @step 一致性: FAIL - 缺少步骤 3 的实现
- @boundary 处理: WARN - 错误处理不完整
- 多余行为: PASS
- COMPILE_SPEC 合规: PASS
- @end 完整性: PASS

**修正措施**：补充步骤 3 的实现，完善错误处理

### 第 2 次审查
- @contract 匹配: PASS
- @step 一致性: PASS
- @boundary 处理: PASS
- 多余行为: PASS
- COMPILE_SPEC 合规: PASS
- @end 完整性: PASS

**结论**：✅ 审查通过
```

### 验收标准
- 所有核心模块通过 Reviewer 审查
- 所有维度达到 PASS（允许非关键 WARN）
- 识别并修正所有注释-代码不一致

---

## 阶段 4：Translator 验证（1-2 周）

### 目标
使用 Translator 反向验证注释的完整性。

### 任务清单

#### 4.1 代码转注释验证
对每个模块执行反向转译：

1. **移除原始注释**
   - 备份原始注释
   - 删除代码中的 CDD 注释

2. **调用 Translator**
   - 使用 VSCode 扩展：选中代码 → "CDD: Translate Code to Comment"
   - 或使用 API：`TranslatorVM.translate(code, 'typescript')`

3. **对比注释**
   - 对比生成注释和原始注释
   - 记录差异：
     - 缺失的 @step（信息损失）
     - 缺失的 @boundary（边界条件遗漏）
     - 不准确的 @contract（签名提取错误）

4. **分析信息损失**
   - 哪些信息无法从代码中提取？
   - 为什么会损失这些信息？
   - 如何改进 Translator 或注释规范？

5. **计算信息保留率**
   ```
   信息保留率 = (生成注释的信息量 / 原始注释的信息量) × 100%
   ```

#### 4.2 记录转译结果
为每个模块创建转译报告：
```markdown
## FunctionCallExtractor.ts 转译报告

**转译日期**：2026-05-14

### 原始注释（10 个 @step）
1. [检测语言] 如果提供了 language，使用 Tree-sitter 方案
2. [调用方法] 调用 extractWithTreeSitter 或 extractWithRegex
3. [初始化] 初始化 Tree-sitter parser
4. [解析代码] 使用 Tree-sitter 解析代码生成 AST
5. [遍历 AST] 递归遍历 AST 查找函数调用节点
6. [提取函数名] 从节点中提取函数名
7. [去重] 使用 Set 去除重复
8. [返回] 返回函数名数组
9. [正则方案] 使用正则表达式提取函数调用
10. [回退] Tree-sitter 失败时回退到正则方案

### 生成注释（7 个 @step）
1. 检测是否提供 language 参数
2. 初始化 Tree-sitter parser
3. 解析代码生成 AST
4. 遍历 AST 提取函数调用
5. 去重并返回结果
6. 使用正则表达式作为回退方案
7. 返回函数名数组

### 信息损失分析
- ❌ 缺失：Tree-sitter 节点类型（call_expression）
- ❌ 缺失：回退条件的精确描述
- ❌ 缺失：错误处理的具体逻辑
- ✅ 保留：主要步骤流程
- ✅ 保留：回退机制

### 信息保留率：70%
```

### 验收标准
- 所有核心模块完成 Translator 验证
- 平均信息保留率 ≥ 60%
- 识别并记录所有信息损失模式

---

## 阶段 5：完整闭环验证（1 周）

### 目标
验证三个 Agent 函数的完整闭环。

### 任务清单

#### 5.1 选择验证模块
选择 1-2 个中等复杂度的模块进行完整闭环验证：
- **候选 1**：ImportExtractor.ts
- **候选 2**：TypeDefinitionSearcher.ts

#### 5.2 闭环验证流程
```
原始代码
    ↓
[Translator] 生成注释
    ↓
注释 v1
    ↓
[Compiler] 生成代码
    ↓
代码 v1
    ↓
[Reviewer] 审查
    ↓
审查报告 v1
    ↓
修正注释/代码
    ↓
注释 v2 / 代码 v2
    ↓
[Reviewer] 重新审查
    ↓
审查报告 v2 (PASS)
    ↓
[Translator] 反向验证
    ↓
注释 v3
    ↓
对比 注释 v2 vs 注释 v3
```

#### 5.3 记录闭环结果
```markdown
## ImportExtractor.ts 闭环验证报告

**验证日期**：2026-05-14

### 第 1 轮：代码 → 注释
- Translator 生成注释 v1
- 信息保留率：65%
- 主要损失：路径解析算法细节

### 第 2 轮：注释 → 代码
- Compiler 生成代码 v1
- 功能完整性：90%
- 主要差异：错误处理逻辑简化

### 第 3 轮：审查
- Reviewer 审查代码 v1
- 结果：@step 一致性 FAIL
- 问题：缺少步骤 4 的实现

### 第 4 轮：修正
- 修改注释 v1 → 注释 v2
- Compiler 重新生成代码 v2
- Reviewer 审查通过

### 第 5 轮：反向验证
- Translator 生成注释 v3
- 对比 注释 v2 vs 注释 v3
- 一致性：85%

### 总体评估
- ✅ 三个 Agent 函数协同工作正常
- ✅ 闭环可以收敛到一致状态
- ⚠️ 需要 2-3 轮迭代才能达到一致
- ⚠️ 信息保留率仍有提升空间
```

### 验收标准
- 至少 2 个模块完成完整闭环验证
- 闭环能够收敛（注释和代码达到一致）
- 记录完整的迭代过程和信息损失

---

## 阶段 6：总结与改进（1 周）

### 目标
总结验证结果，制定改进计划。

### 任务清单

#### 6.1 汇总验证数据
- [ ] 统计所有模块的编译成功率
- [ ] 统计所有模块的审查通过率
- [ ] 统计所有模块的信息保留率
- [ ] 识别常见的信息损失模式

#### 6.2 分析问题根源
- [ ] **注释规范问题**
  - 哪些类型的信息难以用当前注释表达？
  - 是否需要新的注释标记？
  
- [ ] **Compiler 问题**
  - 哪些注释 Compiler 理解错误？
  - 是否需要改进 Compiler 提示词？
  
- [ ] **Translator 问题**
  - 哪些代码信息 Translator 无法提取？
  - 是否需要增强代码分析能力？
  
- [ ] **Reviewer 问题**
  - 哪些不一致 Reviewer 未检测到？
  - 是否需要增加审查维度？

#### 6.3 制定改进计划
基于问题分析，制定具体的改进措施：

**优先级 P0（立即改进）**
- [ ] 改进注释规范，增加缺失的表达能力
- [ ] 更新 COMPILE_SPEC，明确模糊的规则
- [ ] 修正 Compiler/Translator/Reviewer 的明显错误

**优先级 P1（短期改进，1-2 个月）**
- [ ] 实现 ContextExtractor（提取算法模式、错误处理）
- [ ] 实现 DependencyAnalyzer（数据流、控制流分析）
- [ ] 实现 ErrorPatternDetector（错误模式识别）

**优先级 P2（中期改进，3-6 个月）**
- [ ] 设计面向对象式提示词规范
- [ ] 实现类级别的 Compiler/Translator/Reviewer
- [ ] 增强增量编译能力

#### 6.4 输出最终报告
```markdown
# CCD 框架自举验证总结报告

## 验证范围
- 核心模块数量：15
- 代码行数：约 3000 行
- 验证周期：6 周

## 验证结果

### Compiler 验证
- 验证模块数：5
- 编译成功率：100%
- 功能完整性：平均 92%
- 实现细节保留率：平均 78%

### Reviewer 验证
- 验证模块数：15
- 审查通过率：100%（经过修正）
- 平均修正次数：1.8 次
- 主要问题：@step 一致性（40%）、@boundary 处理（30%）

### Translator 验证
- 验证模块数：15
- 信息保留率：平均 62%
- 主要损失：算法细节（25%）、错误处理（15%）、性能优化（10%）

### 闭环验证
- 验证模块数：2
- 闭环收敛：✅ 成功
- 平均迭代次数：2.5 次
- 最终一致性：平均 83%

## 主要发现

### 成功之处
1. ✅ 三个 Agent 函数协同工作正常
2. ✅ 注释驱动开发流程可行
3. ✅ 增量编译机制有效
4. ✅ 历史记录追踪完整

### 存在问题
1. ❌ 信息保留率未达到 70% 目标
2. ❌ 算法细节和错误处理难以表达
3. ❌ 需要多次迭代才能达到一致
4. ❌ 部分复杂逻辑注释冗长

### 改进方向
1. 实现 ContextExtractor 提取实现上下文
2. 增强 Translator 的代码分析能力
3. 设计更简洁的注释表达方式
4. 探索面向对象式提示词

## 下一步计划
按照 CDD_v3.md 中的路线图执行：
- 阶段 2：上下文增强（3-6 个月）
- 阶段 3：面向对象支持（6-9 个月）
- 阶段 4：生态完善（9-12 个月）
```

### 验收标准
- 完成完整的验证总结报告
- 识别所有主要问题和改进方向
- 制定明确的下一步计划

---

## 时间线

| 阶段 | 任务 | 预计时间 | 负责人 |
|:---|:---|:---|:---|
| 阶段 1 | 核心模块注释化 | 1-2 周 | 开发者 |
| 阶段 2 | Compiler 验证 | 2-3 周 | 开发者 + Compiler |
| 阶段 3 | Reviewer 验证 | 1-2 周 | 开发者 + Reviewer |
| 阶段 4 | Translator 验证 | 1-2 周 | 开发者 + Translator |
| 阶段 5 | 完整闭环验证 | 1 周 | 开发者 + 三个 Agent |
| 阶段 6 | 总结与改进 | 1 周 | 开发者 |
| **总计** | | **7-11 周** | |

---

## 风险与应对

### 风险 1：信息保留率过低
**描述**：Translator 生成的注释信息保留率低于 50%  
**影响**：无法实现代码 → 注释 → 代码的闭环  
**应对**：
- 优先实现 ContextExtractor
- 在注释中增加实现提示（如 @hint: 使用二分查找）
- 接受一定的信息损失，聚焦核心逻辑

### 风险 2：Compiler 生成代码质量差
**描述**：Compiler 生成的代码无法通过 Reviewer 审查  
**影响**：需要大量手动修正，失去自动化价值  
**应对**：
- 改进 Compiler 提示词
- 提供更多的 referencedContracts
- 使用更强大的 LLM 模型

### 风险 3：注释过于冗长
**描述**：为了提高信息保留率，注释变得非常冗长  
**影响**：注释失去简洁性，维护成本高  
**应对**：
- 探索更简洁的注释表达方式
- 使用 @hint 等辅助标记
- 接受一定的信息损失

### 风险 4：时间超期
**描述**：验证过程比预期更复杂，时间超过 11 周  
**影响**：延迟后续改进计划  
**应对**：
- 缩小验证范围，聚焦核心模块
- 并行执行部分任务
- 接受不完美的验证结果

---

## 成功标准

### 最低标准（必须达到）
- [ ] 至少 5 个核心模块完成完整的 CDD 注释
- [ ] 至少 3 个模块通过 Compiler 验证（功能完整性 ≥ 90%）
- [ ] 所有已注释模块通过 Reviewer 审查
- [ ] 平均信息保留率 ≥ 50%

### 目标标准（期望达到）
- [ ] 所有核心模块（15 个）完成完整的 CDD 注释
- [ ] 至少 5 个模块通过 Compiler 验证（功能完整性 ≥ 95%）
- [ ] 所有模块通过 Reviewer 审查
- [ ] 平均信息保留率 ≥ 60%
- [ ] 至少 2 个模块完成完整闭环验证

### 理想标准（最佳结果）
- [ ] 所有核心模块通过 Compiler 验证
- [ ] 平均信息保留率 ≥ 70%
- [ ] 所有模块完成完整闭环验证
- [ ] 识别并实现至少 3 个关键改进

---

**文档版本**：1.0  
**创建日期**：2026-05-14  
**最后更新**：2026-05-14
