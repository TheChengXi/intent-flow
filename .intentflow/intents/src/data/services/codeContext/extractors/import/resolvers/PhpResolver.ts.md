# PhpResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/PhpResolver.ts`

**intent:** PHP 的 import 解析策略。 use App\Models\User; → App/Models/User.php 的 PSR-4 命名空间到路径映射。 边界：只处理 use 语句（不含 use function / use const），过滤第三方库路径。
