/**
 * @intent
 * VS Code API 单例。
 * acquireVsCodeApi() 在整个 webview 生命周期中只能调一次，后续调用抛异常。
 * 所有模块从此处获取 postMessage 方法。
 */

const api = (window as any).acquireVsCodeApi?.()

export const vscode = api || { postMessage: () => {} }
