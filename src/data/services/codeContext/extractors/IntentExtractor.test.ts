/**
 * @intent
 * 测试 extractIntentFromLines 提取与转义还原闭环：
 * - 块注释、行注释、井号注释三种格式的提取
 * - 含转义序列（星号反斜杠斜杠、反斜杠 @）文本提取后还原为投射原文
 * - 行首 @ 文本不截断（完整提取）
 * - 无 @intent 时返回 null
 */

import { describe, it, expect } from 'vitest';
import { extractIntentFromLines } from './IntentExtractor';

// ----------------------------------------------------------------
// 三种注释格式提取（输入模拟 generateIntentBlock 投射后的行形态）
// ----------------------------------------------------------------
describe('comment formats', () => {
  it('extracts multi-line intent from star block comment (/** */)', () => {
    const lines = [
      '/**',
      ' * @intent',
      ' * 第一行',
      ' * 第二行',
      ' */',
    ];
    expect(extractIntentFromLines(lines)).toBe('第一行 第二行');
  });

  it('extracts intent from // line comments', () => {
    const lines = ['// @intent', '// 模块描述', '// 第二行描述'];
    expect(extractIntentFromLines(lines)).toBe('模块描述 第二行描述');
  });

  it('extracts intent from # hash comments', () => {
    const lines = ['# @intent', '# Python 模块', '# 第二行'];
    expect(extractIntentFromLines(lines)).toBe('Python 模块 第二行');
  });

  it('extracts inline text on the @intent tag line', () => {
    const lines = ['/**', ' * @intent 单行描述', ' */'];
    expect(extractIntentFromLines(lines)).toBe('单行描述');
  });

  it('joins multi-line block into single-line text separated by spaces', () => {
    const lines = ['/**', ' * @intent', ' * 第一行', ' * 第二行', ' * 第三行', ' */'];
    expect(extractIntentFromLines(lines)).toBe('第一行 第二行 第三行');
  });
});

// ----------------------------------------------------------------
// 无 @intent → null（不抛异常）
// ----------------------------------------------------------------
describe('no @intent tag', () => {
  it('returns null when input contains no @intent tag', () => {
    const lines = ['/**', ' * 普通注释', ' */'];
    expect(extractIntentFromLines(lines)).toBeNull();
  });

  it('returns null without throwing on empty input', () => {
    expect(() => extractIntentFromLines([])).not.toThrow();
    expect(extractIntentFromLines([])).toBeNull();
  });

  it('returns null when @intent tag has no content', () => {
    expect(extractIntentFromLines(['// @intent'])).toBeNull();
  });
});

// ----------------------------------------------------------------
// 停止条件：空行、下一个 @tag、块注释闭合
// ----------------------------------------------------------------
describe('stop conditions', () => {
  it('stops parsing at empty line', () => {
    const lines = ['/**', ' * @intent', ' * 第一行', '', ' * 第二行', ' */'];
    expect(extractIntentFromLines(lines)).toBe('第一行');
  });

  it('stops parsing at the next @tag line (block comment)', () => {
    const lines = ['/**', ' * @intent', ' * 第一行', ' * @param x 参数', ' * 第三行', ' */'];
    expect(extractIntentFromLines(lines)).toBe('第一行');
  });

  it('stops parsing at block comment close */', () => {
    const lines = ['/**', ' * @intent', ' * 第一行', ' */', ' * 闭合后内容'];
    expect(extractIntentFromLines(lines)).toBe('第一行');
  });

  it('skips empty star line inside block without stopping', () => {
    const lines = ['/**', ' * @intent', ' * 第一行', ' * ', ' * 第二行', ' */'];
    expect(extractIntentFromLines(lines)).toBe('第一行 第二行');
  });
});

// ----------------------------------------------------------------
// 转义序列还原（与投射侧 intentTextEscaping 对称，闭环）
// ----------------------------------------------------------------
describe('escape restoration', () => {
  it('restores escaped termination sequence *\\/ to */', () => {
    const lines = ['/**', ' * @intent', ' * 支持 /** *\\/ 注释', ' */'];
    expect(extractIntentFromLines(lines)).toBe('支持 /** */ 注释');
  });

  it('restores escaped @ (\\@) to @', () => {
    const lines = ['/**', ' * @intent', ' * 第一行', ' * \\@see foo', ' */'];
    expect(extractIntentFromLines(lines)).toBe('第一行 @see foo');
  });

  it('escaped line-leading @param is fully extracted without truncation', () => {
    const lines = ['/**', ' * @intent', ' * 第一行', ' * \\@param x 参数', ' * 第三行', ' */'];
    expect(extractIntentFromLines(lines)).toBe('第一行 @param x 参数 第三行');
  });

  it('// format: escaped @ line is fully extracted', () => {
    const lines = ['// @intent', '// 第一行', '// \\@param x 参数', '// 第三行'];
    expect(extractIntentFromLines(lines)).toBe('第一行 @param x 参数 第三行');
  });

  it('# format: escaped @ line is fully extracted', () => {
    const lines = ['# @intent', '# 第一行', '# \\@param x 参数', '# 第三行'];
    expect(extractIntentFromLines(lines)).toBe('第一行 @param x 参数 第三行');
  });

  it('round-trip closure: projected block extracts back to original intent', () => {
    // 原文：含终止序列与行首 @ 的多行意图（模拟投射前输入）
    // 投射形态：块注释 + escapeBlockCommentText 后的行（手动构造，模拟 generateIntentBlock 输出）
    const lines = [
      '/**',
      ' * @intent',
      ' * 支持 /** *\\/ 注释',
      ' * \\@param x 参数',
      ' * 第三行 */ ok',
      ' */',
    ];
    const result = extractIntentFromLines(lines);
    expect(result).toBe('支持 /** */ 注释 @param x 参数 第三行 */ ok');
    // 拼接后统一还原：产物不含残留转义序列
    expect(result).not.toContain('*\\/');
    expect(result).not.toContain('\\@');
  });
});
