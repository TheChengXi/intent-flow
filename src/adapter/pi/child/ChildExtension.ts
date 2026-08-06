/**
 * @intent
 * 子进程专用轻量工具注册（--extension 注入 RPC 子进程，经 IFLOW_CHILD 环境变量分支加载）。
 * 只注册 ask_parent：execute 内调 ctx.ui.input 发 extension_ui_request 并阻塞等待主 agent 回答。
 * 内置每任务提问计数（上限 3，超限报错，防子 agent 提问死循环）；每次新 prompt（message_start）重置。
 * 不注册任何其他工具/命令/TUI 逻辑。
 *
 * 边界：仅子进程模式（IFLOW_CHILD=1）下被 extension.ts 调用；RPC 模式 ctx.ui.input 阻塞等待
 * extension_ui_response，无回答时按协议超时处理；计数为进程内闭包状态，随 message_start 重置。
 *
 * 验收条件：
 * - ask_parent 返回主 agent 回答文本（无回答返回占位提示）
 * - 第 4 次提问（同任务内）直接报错，不进入主 agent 上下文
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

/** 单任务提问上限 */
export const ASK_PARENT_MAX = 3;

/**
 * 注册子进程通信工具。仅由 extension.ts 在 IFLOW_CHILD=1 时调用。
 */
export function registerChildTools(pi: ExtensionAPI): void {
  let askCount = 0;

  // 每次新 prompt（新任务回合）重置计数
  pi.on('message_start', () => {
    askCount = 0;
  });

  pi.registerTool({
    name: 'ask_parent',
    label: 'Ask Parent',
    description: [
      '向主 agent 提问并等待回答。仅在信息缺失、必须澄清才能继续时使用。',
      `单任务最多 ${ASK_PARENT_MAX} 次，超出后必须自行决策。`,
    ].join(' '),
    promptSnippet: 'Ask the parent agent a question and wait for its answer',
    promptGuidelines: [
      'Use ask_parent only when essential information is missing and guessing would be harmful.',
      `Limit: at most ${ASK_PARENT_MAX} questions per task; after that decide on your own.`,
      'Wait for the answer before proceeding; do not guess or assume.',
    ],
    parameters: Type.Object({
      question: Type.String({
        description: '要向主 agent 提问的内容（尽量具体，附上必要上下文）',
      }),
    }),

    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
      if (askCount >= ASK_PARENT_MAX) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `ask_parent 已达单任务上限(${ASK_PARENT_MAX} 次)。请基于已有信息自行决策，不要再提问。`,
            },
          ],
          details: {},
        };
      }

      askCount++;

      // RPC 模式：ctx.ui.input 发 extension_ui_request（method: input，title=提问内容）并阻塞等待
      // extension_ui_response；主进程拦截后由主 agent 经 agent_reply 回答。
      const answer = await ctx.ui.input(params.question);

      return {
        content: [
          {
            type: 'text' as const,
            text: answer ?? '（主 agent 未回答）',
          },
        ],
        details: {},
      };
    },
  });
}
