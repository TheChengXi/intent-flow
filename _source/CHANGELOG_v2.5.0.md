# CDD v2.5.0 更新日志

## 发布日期
2026-05-11

## 主要更新

### Phase 1: 架构重构 - Workflow 调度器模式

#### 1.1 剥离 VM 交接逻辑
- **修改文件**:
  - `src/viewmodel/roles/BaseRole.ts`
  - `src/viewmodel/roles/CompilerVM.ts`
  - `src/viewmodel/roles/ReviewerVM.ts`
  - `src/viewmodel/roles/TranslatorVM.ts`
  - `src/viewmodel/roles/PlannerVM.ts`
  - `src/viewmodel/roles/CodeTranslatorVM.ts`

- **变更内容**:
  - 删除 `getNextRole()` 抽象方法
  - 删除 `RoleResult.nextRole` 字段
  - VM 不再负责决定下一个角色，专注于单一职责

#### 1.2 创建 Workflow 调度器
- **新增文件**:
  - `src/viewmodel/workflow/WorkflowTypes.ts` - 工作流类型定义
  - `src/viewmodel/workflow/CDDWorkflow.ts` - 核心工作流调度器

- **功能特性**:
  - 自动检测工作流类型（compile/review/translate）
  - 编译→审查→重编译循环（最多3次重试）
  - 达到重试上限时触发裁决机制（路径A/路径B）
  - 统一的错误处理和执行路径记录

### Phase 2: Commands 集成 Workflow

#### 2.1 重构命令层
- **修改文件**:
  - `src/viewmodel/commands/CompileCommand.ts`
  - `src/viewmodel/commands/ReviewCommand.ts`

- **变更内容**:
  - 移除直接调用 VM 的逻辑
  - 统一使用 `executeCDDWorkflow()` 进行工作流调度
  - 简化命令层代码，提高可维护性

### Phase 3: 增量编译机制（v2.5.0 核心功能）

#### 3.1 步骤差异检测服务
- **新增文件**: `src/model/services/StepDiffDetector.ts`

- **核心算法**:
  - **哈希计算**: MD5 前8位，基于规范化的 step.description
  - **内容规范化**: trim + 折叠空格 + 标准化标点
  - **位置无关匹配**: 基于内容哈希而非位置索引
  - **阈值判断**: 50% 未变化步骤触发增量模式

- **主要函数**:
  - `detectDiff()` - 检测新旧注释的步骤差异
  - `computeStepHash()` - 计算步骤内容哈希
  - `normalizeStepContent()` - 规范化步骤内容
  - `shouldUseIncrementalMode()` - 判断是否使用增量模式

#### 3.2 历史记录格式升级
- **修改文件**: `src/model/entities/WorkLineHistory.ts`

- **新增字段**:
  - `input.parsedComment?: CDDComment` - 保存解析后的注释结构
  - `input.incrementalContext?: IncrementalContext` - 增量编译上下文

- **IncrementalContext 结构**:
  ```typescript
  {
    isIncremental: boolean;
    stepDiff?: StepDiff;
    previousCode?: string;
  }
  ```

#### 3.3 CompilerVM 增量编译支持
- **修改文件**: `src/viewmodel/roles/CompilerVM.ts`

- **新增功能**:
  - `CompileContext` 新增 `stepDiff`、`isIncremental`、`previousCode` 字段
  - 增量模式下构建特殊提示词，包含：
    - 未变化步骤列表（保持原实现）
    - 新增步骤列表（需要实现）
    - 删除步骤列表（移除相关代码）
    - 上次生成的代码（作为基础）
  - 编译结果消息标注"（增量模式）"

#### 3.4 CompilerContextManager 集成
- **修改文件**: `src/viewmodel/context/CompilerContextManager.ts`

- **prepare() 方法增强**:
  1. 读取上次编译记录（`getLastCompilerRecord`）
  2. 检测步骤差异（`StepDiffDetector.detectDiff`）
  3. 判断是否启用增量模式（`shouldUseIncrementalMode`）
  4. 构建包含增量信息的 `CompileContext`
  5. 审查不通过时禁用增量模式（优先级更高）

- **save() 方法增强**:
  - 保存 `parsedComment` 到历史记录
  - 为下次增量编译提供基础数据

## 技术细节

### 增量编译四种场景

1. **场景1: 新增步骤**
   - 检测: 新注释中存在旧注释中没有的哈希
   - 处理: 在原代码基础上添加新逻辑

2. **场景2: 删除步骤**
   - 检测: 旧注释中存在新注释中没有的哈希
   - 处理: 从原代码中移除相关逻辑

3. **场景3: 修改步骤**
   - 检测: 哈希值改变
   - 处理: 当前版本视为删除+新增

4. **场景4: 调整顺序**
   - 检测: 哈希相同但位置不同
   - 处理: 位置无关匹配，不触发重新编译

### MD5 哈希策略

- **长度**: 前8位（32位完整哈希的前1/4）
- **碰撞概率**: 2^32 ≈ 42亿种可能，对于单个函数的步骤数量（通常<20）足够安全
- **性能**: 计算快速，适合实时检测

### 阈值设计

- **默认阈值**: 50%
- **触发条件**: `unchangedRatio >= 0.5`
- **设计理由**: 
  - 变化过大时（>50%）全量重编译更可靠
  - 变化较小时（≤50%）增量编译更高效

## 未来优化工具（已记录，未实现）

参见 `_source/TOOL_INDEX.md`:
- diffsitter - 语法感知的差异检测
- BLAKE3 - 高性能哈希算法
- infiniloom - 内容寻址存储
- EntireContext - 上下文管理

## 兼容性

- **向后兼容**: 旧的历史记录文件仍可正常读取
- **渐进式启用**: 只有存在历史记录且满足阈值时才启用增量模式
- **降级策略**: 增量编译失败时自动回退到全量编译

## 测试建议

1. **基础功能测试**:
   - 首次编译（无历史记录）
   - 二次编译（有历史记录，未变化）
   - 增量编译（50%以上步骤未变化）

2. **边界条件测试**:
   - 所有步骤都变化（应全量编译）
   - 只有一个步骤变化（应增量编译）
   - 审查不通过后重新编译（应禁用增量模式）

3. **哈希碰撞测试**:
   - 两个不同步骤产生相同哈希（概率极低）

## 性能预期

- **增量编译 Token 节省**: 约 30-50%（取决于未变化步骤占比）
- **编译速度提升**: 约 20-40%（取决于 API 响应时间）
- **历史记录增长**: 每次编译增加约 2-5KB（包含 parsedComment）

## 已知限制

1. 当前版本不支持步骤内容的语义理解，只基于字面文本匹配
2. 步骤顺序调整不会触发重新编译（设计如此）
3. 增量编译依赖 LLM 理解"保持原实现"的指令，可能存在理解偏差

## 下一步计划

- [ ] 实现 ReviewerVM 的部分审查支持
- [ ] 添加增量编译的详细日志记录
- [ ] 优化提示词以提高增量编译准确性
- [ ] 考虑引入 diffsitter 进行语法级差异检测
