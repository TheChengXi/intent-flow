// 测试类型搜索正则

const content = `// 测试场景 3：前端组件函数
// 目的：验证前端规范自动选择（COMPILE_SPEC_FRONTEND.md）
// 路径匹配：src/view/** 应该使用前端规范
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}
// @contract: renderUserProfile(user: User) => JSX.Element`;

const typeName = 'User';
const typeDefRegex = new RegExp(`^\\s*(export\\s+)?(interface|type|class|enum)\\s+${typeName}\\b`, 'm');

console.log('正则表达式:', typeDefRegex);
console.log('测试内容:\n', content);
console.log('\n匹配结果:', typeDefRegex.test(content));

const match = typeDefRegex.exec(content);
console.log('匹配详情:', match);
