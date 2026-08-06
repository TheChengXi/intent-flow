# PythonResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/PythonResolver.ts`

**intent:** Python 的 import 解析策略。 from ... import ... / import ... 两种形式，. 开头为相对导入。 边界：只解析相对导入（.module），绝对导入视为外部包。
