# IFileRepository.ts

`src/data/repositories/IFileRepository.ts`

**intent:** 文件系统操作的抽象边界，让核心层与 Node.js fs 解耦。 屏蔽：测试时可用 Mock 替代真实文件系统；scanDirectory 自动过滤 .git/node_modules
