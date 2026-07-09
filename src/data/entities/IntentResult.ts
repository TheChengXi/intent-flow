// @intent: 意图提取结果实体，表示文件的意图信息

// @entity: IntentResult
// 意图提取结果
export interface IntentResult {
  fileName: string;      // 文件名
  intent: string;        // 意图文本
  found: boolean;        // 是否找到 @intent 注释
}
