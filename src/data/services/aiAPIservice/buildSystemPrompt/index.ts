/**
 * @intent
 * 系统提示词注册表。支持按名称注册/构建系统提示词。
 * 新增角色时只需 register()，无需修改核心 API 服务。
 */

import {
  COMPILER_PROMPT,
  REVIEWER_PROMPT,
  TRANSLATOR_PROMPT,
  REQUIREMENT_TRANSLATOR_PROMPT,
} from '../../../../generated/prompts';

/** 提示词构建函数类型：接收可选的 compileSpec，返回系统提示词字符串 */
export type PromptBuilder = (compileSpec?: string) => string;

const registry = new Map<string, PromptBuilder>();

/**
 * @contract
 * 注册一个系统提示词构建函数。
 * 输入：name - 角色名（如 'compiler'）；builder - 构建函数
 * 副作用：向全局注册表写入
 * @boundary 同名重复注册会覆盖旧值
 */
export function register(name: string, builder: PromptBuilder): void {
  registry.set(name, builder);
}

/**
 * @contract
 * 根据角色名构建系统提示词。
 * 输入：name - 角色名；compileSpec - 可选的编译规范
 * 输出：系统提示词字符串
 * @boundary 角色未注册时返回通用默认提示词
 */
export function build(name: string, compileSpec?: string): string {
  const builder = registry.get(name);
  if (!builder) {
    return '你是 CDD 助手。协助用户完成 Comment-Driven Development 相关任务。';
  }
  return builder(compileSpec);
}

/**
 * @contract
 * 获取所有已注册的角色名列表。
 * 输出：角色名数组
 */
export function listRoles(): string[] {
  return Array.from(registry.keys());
}

// ==================== 内置提示词注册 ====================

register('compiler', (compileSpec?: string) => {
  let prompt = COMPILER_PROMPT + '\n\n重要：只输出纯代码，不要包含任何注释（包括原始的 @contract、@step、@boundary 注释），不要添加代码块标记（```），不要解释。直接输出可执行的代码。';
  if (compileSpec && compileSpec.trim() !== '') {
    prompt += '\n\n## 项目编译规范\n' + compileSpec;
  }
  return prompt;
});

register('reviewer', () => REVIEWER_PROMPT);

register('translator', () =>
  TRANSLATOR_PROMPT + '\n\n重要格式规范：\n1. 必须严格按照 CDD v2.4.1 格式输出\n2. @contract 格式：functionName(param1: Type1, param2: Type2) => ReturnType\n3. @step 格式：[意图] 描述\n4. @boundary 格式：当<条件>时，应<动作>\n5. 每个注释独占一行，以 // 或 # 开头\n6. 不要输出文档注释格式（/** */）\n7. 不要解释代码，只提取意图\n\n示例输出：\n// @contract: add(a: number, b: number) => number\n// @step: [验证] 检查参数类型\n// @step: [计算] 返回 a + b\n// @boundary: 当参数不是数字时，抛出 TypeError'
);

register('code-translator', () =>
  '你是代码转译员。将代码的变更同步为注释更新，检测契约冲突。'
);

register('development-assistant', () =>
  '你是开发助手。通过多轮对话将用户的模糊需求转化为清晰、无歧义的需求文档。'
);

register('requirement-translator', () => REQUIREMENT_TRANSLATOR_PROMPT);

register('intent-clusterer', () =>
  `role: 代码架构分析师
task: 对文件 @intent 进行语义聚类分析
rules:
  - 只输出 YAML，不要任何额外文字
  - 语义相近的 intent 合并为一组
  - 每组包含高层 intent 描述
  - 完整覆盖所有输入文件
  - 允许单文件独立成组
  - 不要使用 markdown 代码块包裹输出
output_schema:
  packageName: string
  summary: string
  groups:
    - name: string
      intent: string
      files:
        - path: string
          intent: string
  crossRefs:
    - target: string
      reason: string`
);
