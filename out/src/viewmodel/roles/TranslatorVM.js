"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslatorVM = void 0;
const BaseRole_1 = require("./BaseRole");
const Errors_1 = require("../../model/entities/Errors");
class TranslatorVM extends BaseRole_1.BaseRole {
    constructor(apiService) {
        super(apiService);
    }
    // @contract: execute(context: TranslateContext) => Promise<RoleResult>
    // @step: [验证输入] 检查代码是否为空
    // @step: [构建 Prompt] 要求 API 逆向生成 @contract、@step、@boundary
    // @step: [调用 API] 通过 apiService.callAPI 生成注释
    // @step: [检查响应] 检查 API 是否返回"代码逻辑混乱"
    // @step: [返回结果] 返回 success: true，artifacts 包含生成的注释文本
    // @boundary: 当代码为空时，返回 success: false 和 ValidationError
    // @boundary: 当 API 返回"代码逻辑混乱"时，返回 success: false 和 LogicUnclearError
    // @boundary: 当 API 调用失败时，返回 success: false 和 APIError
    async execute(context) {
        try {
            if (!context.code || context.code.trim() === '') {
                return {
                    success: false,
                    message: '代码为空，无法转译',
                    artifacts: null
                };
            }
            const request = {
                role: 'translator',
                context: {
                    code: context.code
                },
                prompt: '将以下代码逆向生成 CDD 格式注释（@contract、@step、@boundary）。如果代码逻辑混乱无法理解，请明确说明"代码逻辑混乱"。'
            };
            const response = await this.apiService.callAPI(request, context.apiKey, context.apiBaseUrl, context.modelId);
            if (response.content.includes('代码逻辑混乱')) {
                throw new Errors_1.LogicUnclearError('代码逻辑混乱，无法转译');
            }
            return {
                success: true,
                message: '转译完成，请人工审查后再编译',
                artifacts: response.content
            };
        }
        catch (error) {
            return {
                success: false,
                message: error.message,
                artifacts: error
            };
        }
    }
    // @end
    // @contract: getNextRole() => string | null
    // @step: [返回] 返回 null（转译后需人工审查）
    getNextRole() {
        return null;
    }
}
exports.TranslatorVM = TranslatorVM;
//# sourceMappingURL=TranslatorVM.js.map