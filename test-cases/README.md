# CDD Framework 跨文件引用测试用例

本目录包含用于测试 CDD Framework 跨文件引用功能的测试用例。

## 文件结构

```
test-cases/
├── README.md                    # 本文件
├── TEST_GUIDE.md               # 详细测试指南
├── userService.ts              # TypeScript 服务文件（包含契约）
├── testCase1_withImport.ts     # 测试用例 1：有 import 语句
├── testCase2_withoutImport.ts  # 测试用例 2：无 import 语句
├── user_service.py             # Python 服务文件（包含契约）
└── testCase3_python.py         # 测试用例 3：Python 语言
```

## 快速开始

1. 确保已配置 CDD 扩展的 API Key
2. 打开 VSCode 并加载此工作区
3. 按 F5 启动扩展开发主机
4. 在新窗口中打开 `test-cases` 目录
5. 按照 `TEST_GUIDE.md` 中的步骤进行测试

## 测试场景

### 场景 1：有 import 语句（testCase1_withImport.ts）
- **目的**：验证编译器能自动从 import 语句中找到引用的契约
- **预期**：无需用户干预，自动找到并使用契约

### 场景 2：无 import 语句（testCase2_withoutImport.ts）
- **目的**：验证全局搜索和导入建议功能
- **预期**：提示用户是否搜索，找到后建议添加 import

### 场景 3：Python 语言（testCase3_python.py）
- **目的**：验证多语言支持
- **预期**：正确处理 Python 的 import 语法和 # 注释

## 验证要点

- ✅ 契约自动提取
- ✅ 生成的代码正确调用引用的函数
- ✅ 用户提示框按预期弹出
- ✅ 导入建议路径正确
- ✅ 多语言注释符号正确

## 注意事项

- 测试前确保 `userService.ts` 和 `user_service.py` 中的契约格式正确
- 使用 DeepSeek API 以获得更稳定的测试体验
- 查看开发者工具控制台以获取详细日志

详细测试步骤请参考 [TEST_GUIDE.md](./TEST_GUIDE.md)
