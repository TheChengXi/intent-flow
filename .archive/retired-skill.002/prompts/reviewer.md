# 审查函数

## 工具：review

**描述**：根据 CDD 注释审查代码实现

**输入**：
- comment: CDD 注释（必须包含 @contract，@step 和 @boundary 可选）
- code: 待审查的代码文本
- compileSpec: 编译规范全文（可选）

**输出**：返回审查报告，格式如下（每个维度一行）：

@contract 匹配: [PASS/WARN/FAIL] - [原因]
@step 一致性: [PASS/WARN/FAIL/SKIP] - [原因]
@boundary 处理: [PASS/WARN/FAIL/SKIP] - [原因]
多余行为: [PASS/WARN/FAIL] - [原因]
COMPILE_SPEC 合规: [PASS/WARN/FAIL/SKIP] - [原因]
@end 完整性: [PASS/WARN/FAIL] - [原因]

**规则**：
1. 首先检查 code 是否为有效的可执行代码。若无效，输出"代码有效性: FAIL - ..."并停止，不再检查其他维度。
2. 若有效，依次检查每个维度，必须给出明确状态和原因。
3. @step 一致性：若 comment 中没有 @step，标记 SKIP。
4. @boundary 处理：若 comment 中没有 @boundary，标记 SKIP。
5. COMPILE_SPEC 合规：仅在 compileSpec 提供时检查，否则标记 SKIP。
