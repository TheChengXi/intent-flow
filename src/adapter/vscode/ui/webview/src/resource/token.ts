/**
 * @intent
 * 从 VS Code 主题变量读取 token 值。
 * 纯函数，不依赖运行时状态。
 */

export function readToken(): Record<string, string> {
  const g = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  return {
    bg: g('--vscode-editor-background', '#1e1e1e'),
    text: g('--vscode-editor-foreground', '#d4d4d4'),
    textMuted: g('--vscode-descriptionForeground', '#858585'),
    border: g('--vscode-panel-border', '#3c3c3c'),
    sideBg: g('--vscode-sideBar-background', '#252526'),
    primary: g('--vscode-button-background', '#0e639c'),
    primaryHover: g('--vscode-button-hoverBackground', '#1177bb'),
    primaryText: g('--vscode-button-foreground', '#ffffff'),
    link: g('--vscode-textLink-foreground', '#3794ff'),
    infoBg: g('--vscode-inputValidation-infoBackground', '#063b49'),
    panelBorder: g('--vscode-panel-border', '#3c3c3c'),
  }
}
