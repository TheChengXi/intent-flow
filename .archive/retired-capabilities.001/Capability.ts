/**
 * @intent [已归档] 聚类后的单个业务能力
 * @entity
 *
 * 归档原因：旧输出格式（深度嵌套能力树），generate_capability_list 改为扁平输出后不再需要。
 * 归档时间：2026-06-12
 */

import { Intent } from '../../src/data/entities/Intent';
import { CallDependency } from '../../src/data/entities/CallDependency';

export interface Capability {
  name: string;
  intent: string;
  entryIntent: Intent;
  branchIntents: Intent[];
  callGraph: CallDependency;
  branchCount: number;
  depth: number;
  subdivisions?: Capability[];
  status: 'integrated' | 'isolated' | 'deprecated';
}
