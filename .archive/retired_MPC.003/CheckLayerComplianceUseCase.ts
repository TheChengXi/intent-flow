import { IUseCase } from './IUseCase';
import { LayerComplianceResult, LayerComplianceCheckInput } from '../../data/entities/LayerComplianceResult';
import { IFileRepository } from '../../data/repositories/IFileRepository';

// @intent: 检查分层规范用例，检查文件是否符合分层架构规范

export class CheckLayerComplianceUseCase implements IUseCase<LayerComplianceCheckInput, LayerComplianceResult> {
  constructor(private fileRepo: IFileRepository) {}

  async execute(input: LayerComplianceCheckInput): Promise<LayerComplianceResult> {
    const { filePath, workspaceRoot, layer } = input;

    if (!filePath) {
      throw new Error('filePath is required');
    }

    const exists = await this.fileRepo.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    const detectedLayer = layer || this.detectLayer(filePath);
    const currentLines = await this.fileRepo.getLineCount(filePath);
    const { maxLines, suggestions, requiresUserConfirmation } = this.getLayerRules(detectedLayer);

    const isCompliant = currentLines <= maxLines;
    const exceedLines = isCompliant ? 0 : currentLines - maxLines;

    let warningMessage: string | undefined;
    if (!isCompliant) {
      if (detectedLayer === 'adapter' && requiresUserConfirmation) {
        warningMessage = `适配层文件超过 ${currentLines} 行（限制 ${maxLines} 行），是否需要封装为新组件？`;
      } else {
        warningMessage = `${this.getLayerName(detectedLayer)}文件超过 ${currentLines} 行（限制 ${maxLines} 行），建议重构`;
      }
    }

    return {
      filePath,
      layer: detectedLayer,
      currentLines,
      maxLines,
      isCompliant,
      exceedLines,
      warningMessage,
      suggestions,
      requiresUserConfirmation
    };
  }

  private detectLayer(filePath: string): 'data' | 'application' | 'adapter' | 'unknown' {
    const normalizedPath = filePath.replace(/\\/g, '/');

    if (normalizedPath.includes('/data/')) {
      return 'data';
    } else if (normalizedPath.includes('/application/')) {
      return 'application';
    } else if (normalizedPath.includes('/adapter/')) {
      return 'adapter';
    }

    return 'unknown';
  }

  private getLayerRules(layer: string): {
    maxLines: number;
    suggestions: string[];
    requiresUserConfirmation: boolean;
  } {
    switch (layer) {
      case 'data':
        return {
          maxLines: 100,
          suggestions: [
            '将大型服务拆分为多个小服务',
            '提取通用逻辑到独立的工具类',
            '考虑使用组合模式替代继承'
          ],
          requiresUserConfirmation: false
        };
      case 'application':
        return {
          maxLines: 300,
          suggestions: [
            '将复杂的用例拆分为多个小用例',
            '提取通用的业务逻辑到独立的服务',
            '考虑使用策略模式简化条件逻辑'
          ],
          requiresUserConfirmation: false
        };
      case 'adapter':
        return {
          maxLines: 200,
          suggestions: [
            '将复杂的适配器拆分为多个小适配器',
            '提取通用的适配逻辑到基类',
            '考虑使用装饰器模式扩展功能'
          ],
          requiresUserConfirmation: true
        };
      default:
        return {
          maxLines: Infinity,
          suggestions: [],
          requiresUserConfirmation: false
        };
    }
  }

  private getLayerName(layer: string): string {
    switch (layer) {
      case 'data':
        return '数据层';
      case 'application':
        return '应用层';
      case 'adapter':
        return '适配层';
      default:
        return '未知层';
    }
  }
}
