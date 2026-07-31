/**
 * @intent
 * @intent 注释投射/提取的转义规则唯一实现，供投射侧（ProjectIntentUseCase）与提取侧（IntentExtractor）复用，保证两侧规则对称不漂移。
 * 转义目的：块注释终止序列（星号斜杠）会提前闭合注释导致语法错误，行首 @ 会被提取器误判为标签导致意图文本截断。
 * 
 * 边界：
 * - escapeBlockCommentText：星号斜杠全量替换为星号反斜杠斜杠；行首 @ 替换为反斜杠 @（多行模式）
 * - escapeLineCommentText：仅行首 @ 转义（行注释无终止符风险）
 * - unescapeIntentText：对称还原，字面含转义序列（罕见）被还原为已知行为
 * 
 * 验收条件：
 * - 转义产物不含裸终止序列，再次转义不变化（无二次转义）
 * - 转义后经 unescapeIntentText 还原与原文一致
 */

// ----------------------------------------------------------------
// 转义/还原规则唯一实现
// 对称规则：终止序列（星号斜杠）<-> 星号反斜杠斜杠、行首 @ <-> 反斜杠 @
// 投射侧调 escape*，提取侧调 unescapeIntentText，两侧共用本模块防规则漂移
// ----------------------------------------------------------------

/**
 * @contract
 * 块注释场景转义：终止序列与行首标签前缀。
 * 输入：text - 任意字符串（可为空）
 * 输出：转义后的字符串 —— 所有星号斜杠序列变为星号反斜杠斜杠；每行行首 @ 变为反斜杠 @
 * 错误：无
 * 副作用：无
 * @boundary
 * - 星号斜杠全量替换（不限于行首），替换后产物不含裸终止序列（星号后必为反斜杠）
 * - 行首 @ 仅匹配行首（^@ 多行模式），行中 @ 原样保留
 * - 无二次转义：反斜杠 @ 行首是反斜杠而非 @，不会被 ^@ 再次匹配
 */
export function escapeBlockCommentText(text: string): string {
  // @step 1: 终止序列全量替换为星号反斜杠斜杠（在星号后插入反斜杠，破坏连续序列，反斜杠斜杠非终止符）
  const noTerminator = text.replace(/\*\//g, '*\\/');
  // @step 2: 行首 @ 替换为反斜杠 @（多行模式匹配每行行首；产物行首是反斜杠，不会被再次匹配）
  return noTerminator.replace(/^@/gm, '\\@');
}

/**
 * @contract
 * 行注释场景（//、#）转义：仅行首标签前缀，无终止符风险。
 * 输入：text - 任意字符串（可为空）
 * 输出：转义后的字符串 —— 每行行首 @ 变为反斜杠 @；星号斜杠序列原样保留
 * 错误：无
 * 副作用：无
 * @boundary
 * - 仅 ^@ 多行模式替换，星号斜杠不转义（行注释无终止序列词法风险，与块注释转义范围差异）
 * - 无二次转义：反斜杠 @ 行首是反斜杠，再次转义不变化
 */
export function escapeLineCommentText(text: string): string {
  // @step: 行首 @ 替换为反斜杠 @（多行模式），其余字符原样保留
  return text.replace(/^@/gm, '\\@');
}

/**
 * @contract
 * 提取侧对称还原：将转义序列还原为原始字符。
 * 输入：text - 提取到的可能含转义序列的文本
 * 输出：还原后的字符串 —— 星号反斜杠斜杠变为星号斜杠；反斜杠 @ 变为 @
 * 错误：无
 * 副作用：无
 * @boundary
 * - 两个还原规则字符集不相交（星号反斜杠斜杠 与 反斜杠 @），执行顺序不影响结果
 * - 字面天然含转义序列（罕见）会被还原为原始字符，为需求文档锁定的已知行为
 */
export function unescapeIntentText(text: string): string {
  // @step 1: 星号反斜杠斜杠还原为星号斜杠（与投射侧 escapeBlockCommentText 对称）
  const restoredTerminator = text.replace(/\*\\\//g, '*/');
  // @step 2: 反斜杠 @ 还原为 @（与投射侧 escape* 对称）
  return restoredTerminator.replace(/\\@/g, '@');
}
