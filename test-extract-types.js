// 测试类型提取函数

const contractLine = "// @contract: renderUserProfile(user: User) => JSX.Element";

// 模拟 extractTypeReferences 逻辑
function extractTypeReferences(contractLine) {
  const types = new Set();

  const builtinTypes = new Set([
    'string', 'number', 'boolean', 'null', 'undefined', 'void', 'any', 'unknown', 'never', 'symbol', 'bigint',
    'Promise', 'Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'Error', 'RegExp',
    'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit', 'Exclude', 'Extract',
    'JSX', 'React', 'ReactNode', 'ReactElement', 'FC', 'Component'
  ]);

  // 提取所有类型引用的正则（匹配 : Type 或 => Type）
  const typeRegex = /:\s*([A-Z][a-zA-Z0-9_<>,\s\[\]|&]*)|=>\s*([A-Z][a-zA-Z0-9_<>,\s\[\]|&]*)/g;

  let match;
  while ((match = typeRegex.exec(contractLine)) !== null) {
    const typeStr = match[1] || match[2];
    if (typeStr) {
      console.log('找到类型字符串:', typeStr);
      // 提取所有类型名
      const typeNames = extractTypeNamesFromTypeString(typeStr.trim());
      console.log('提取的类型名:', typeNames);
      typeNames.forEach(typeName => {
        if (!builtinTypes.has(typeName)) {
          types.add(typeName);
        }
      });
    }
  }

  return Array.from(types);
}

function extractTypeNamesFromTypeString(typeStr) {
  const types = [];
  const cleaned = typeStr.replace(/\s+/g, '');
  const typeNameRegex = /[A-Z][a-zA-Z0-9_]*/g;
  let match;
  while ((match = typeNameRegex.exec(cleaned)) !== null) {
    types.push(match[0]);
  }
  return types;
}

console.log('测试契约行:', contractLine);
const result = extractTypeReferences(contractLine);
console.log('最终提取的类型:', result);
