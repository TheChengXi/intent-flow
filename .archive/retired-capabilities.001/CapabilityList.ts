/**
 * @intent [已归档] 完整的项目能力清单
 * @entity
 *
 * 归档原因：旧输出格式（分层包装），generate_capability_list 改为扁平输出后不再需要。
 * 归档时间：2026-06-12
 */

import { Capability } from '../../src/data/entities/Capability';

export interface CapabilityLayer {
  name: string;
  capabilities: Capability[];
}

export interface CapabilityList {
  layers: CapabilityLayer[];
  generatedAt: number;
  version: string;
}
