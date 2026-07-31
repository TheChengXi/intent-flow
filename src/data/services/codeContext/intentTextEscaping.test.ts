/**
 * @intent
 * 测试 intentTextEscaping 三条转义规则的单元测试：
 * - 星号斜杠终止序列全量转义与还原闭环
 * - 行首 @ 转义（多行）与还原闭环
 * - 无二次转义（转义产物再次转义不变化）
 * - 行注释与块注释转义范围的差异
 */

import { describe, it, expect } from 'vitest';
import {
  escapeBlockCommentText,
  escapeLineCommentText,
  unescapeIntentText,
} from './intentTextEscaping';

// ----------------------------------------------------------------
// escapeBlockCommentText：块注释场景（/** */）
// 终止序列 */ 全量转义为 *\/；每行行首 @ 转义为 \@
// ----------------------------------------------------------------
describe('escapeBlockCommentText', () => {
  it('全量替换所有终止序列 */ 为 *\\/', () => {
    expect(escapeBlockCommentText('支持 /** */ 注释 */ 结尾')).toBe(
      '支持 /** *\\/ 注释 *\\/ 结尾'
    );
  });

  it('转义产物不含裸终止序列 */', () => {
    const escaped = escapeBlockCommentText('a */ b */ c');
    expect(escaped).not.toContain('*/');
  });

  it('多行文本中每行行首 @ 均转义为 \\@', () => {
    expect(escapeBlockCommentText('第一行\n@param x 参数\n@see foo\n第三行')).toBe(
      '第一行\n\\@param x 参数\n\\@see foo\n第三行'
    );
  });

  it('不转义非行首位置的 @', () => {
    expect(escapeBlockCommentText('行中 @tag 保留')).toBe('行中 @tag 保留');
  });

  it('普通文本（无特殊序列）转义后不变', () => {
    expect(escapeBlockCommentText('普通意图文本，无特殊序列。')).toBe(
      '普通意图文本，无特殊序列。'
    );
  });

  it('空字符串转义后仍为空', () => {
    expect(escapeBlockCommentText('')).toBe('');
  });

  it('无二次转义：转义产物再次转义不变化', () => {
    const once = escapeBlockCommentText('@param x\n支持 */ 注释');
    expect(escapeBlockCommentText(once)).toBe(once);
  });
});

// ----------------------------------------------------------------
// escapeLineCommentText：行注释场景（//、#）
// 仅行首 @ 转义为 \@；无终止符风险，*/ 不转义
// ----------------------------------------------------------------
describe('escapeLineCommentText', () => {
  it('每行行首 @ 均转义为 \\@', () => {
    expect(escapeLineCommentText('第一行\n@param x')).toBe('第一行\n\\@param x');
  });

  it('终止序列 */ 不转义（与块注释的转义范围差异）', () => {
    expect(escapeLineCommentText('支持 */ 注释')).toBe('支持 */ 注释');
  });

  it('普通文本转义后不变', () => {
    expect(escapeLineCommentText('普通意图文本')).toBe('普通意图文本');
  });

  it('无二次转义：转义产物再次转义不变化', () => {
    const once = escapeLineCommentText('@param x\n正文');
    expect(escapeLineCommentText(once)).toBe(once);
  });
});

// ----------------------------------------------------------------
// unescapeIntentText：提取侧对称还原
// *\/ → */、\@ → @，与投射侧转义对称
// ----------------------------------------------------------------
describe('unescapeIntentText', () => {
  it('将 *\\/ 还原为 */', () => {
    expect(unescapeIntentText('支持 *\\/ 注释')).toBe('支持 */ 注释');
  });

  it('将 \\@ 还原为 @', () => {
    expect(unescapeIntentText('\\@param x')).toBe('@param x');
  });

  it('块注释转义后还原与原文一致（闭环）', () => {
    const text = '支持 /** */ 注释\n@param x 参数\n结尾 */ ok';
    expect(unescapeIntentText(escapeBlockCommentText(text))).toBe(text);
  });

  it('行注释转义后还原与原文一致（闭环）', () => {
    const text = '第一行\n@param x 参数';
    expect(unescapeIntentText(escapeLineCommentText(text))).toBe(text);
  });

  it('普通文本还原不变', () => {
    expect(unescapeIntentText('普通文本')).toBe('普通文本');
  });

  it('已知行为：字面含 *\\/ 的文本被还原为 */（罕见，锁定现状）', () => {
    expect(unescapeIntentText('字面 *\\/ 文本')).toBe('字面 */ 文本');
  });
});
