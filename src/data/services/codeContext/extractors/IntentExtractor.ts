/**
 * @intent
 * @intent 注解文本提取的唯一实现：从代码行数组解析 @intent 块，供 ProjectIntentsToFilesUseCase 等用例复用，避免各用例各自实现正则。
 * 提取后对称还原转义序列（星号反斜杠斜杠、反斜杠 @），与投射侧 intentTextEscaping 形成闭环，保证意图文本与投射原文一致。
 * 
 * 边界：支持星号块注释、//、# 三种注释格式；遇空行或下一个 @tag 停止解析；无 @intent 返回 null；块内多行拼接为单行文本。
 * 
 * 验收条件：
 * - extractIntentFromLines 对含多行 @intent 块的输入返回拼接后的意图文本
 * - 输入无 @intent 时返回 null，不抛异常
 * - 含转义序列的文本提取后还原为投射原文
 */

import { unescapeIntentText } from '../intentTextEscaping';

export function extractIntentFromLines(lines: string[]): string | null {
  let inIntent = false;
  let parts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inIntent) {
      // 检测 @intent 标签行
      const tagMatch = trimmed.match(/^(\*|\/\/|#|\/\*)?\s*@intent\b/);
      if (tagMatch) {
        inIntent = true;
        const inline = trimmed.replace(/^(\*|\/\/|#|\/\*)?\s*@intent[:\s]*/, '').trim();
        if (inline) parts.push(inline);
        continue;
      }
      continue;
    }

    // ---- 在 @intent 块中 ----

    // 结束条件
    if (trimmed === '*/' || trimmed === '') break;
    if (/^\*?\s*@\w/.test(trimmed) && !/^\*?\s*@intent\b/.test(trimmed)) break;
    if (/^\/\/\s*@\w/.test(trimmed)) break;
    if (/^#\s*@\w/.test(trimmed)) break;

    // 提取文本，去除注释标记
    const text = trimmed
      .replace(/^\*\s?/, '')
      .replace(/^\/\/\s?/, '')
      .replace(/^#\s?/, '')
      .trim();

    if (text) parts.push(text);
  }

  // @step: 拼接为单行后统一还原转义序列（星号反斜杠斜杠 -> 星号斜杠、反斜杠 @ -> @），与投射侧对称
  return parts.length > 0 ? unescapeIntentText(parts.join(' ')) : null;
}
