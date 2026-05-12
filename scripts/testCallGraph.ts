import { CallGraphService } from '../src/model/services/CallGraphService';
import * as path from 'path';

async function test() {
  const testFile = path.join(__dirname, '../test-cases/callgraph-test.ts');

  console.log('=== 测试 CallGraphService ===\n');

  // 1. 构建调用图
  console.log('1. 构建调用图...');
  const graph = await CallGraphService.buildFileCallGraph(testFile, 'typescript');
  console.log(`   找到 ${graph.nodes.size} 个函数\n`);

  // 2. 查看所有函数
  console.log('2. 所有函数：');
  for (const [name, node] of graph.nodes) {
    console.log(`   - ${name}`);
  }
  console.log('');

  // 3. 测试 getCallees
  console.log('3. processUser 调用了谁？');
  const callees = CallGraphService.getCallees('processUser', graph);
  console.log(`   ${callees.join(', ')}\n`);

  // 4. 测试 getCallers
  console.log('4. 谁调用了 validateUser？');
  const callers = CallGraphService.getCallers('validateUser', graph);
  console.log(`   ${callers.join(', ')}\n`);

  // 5. 测试 collectDependencies
  console.log('5. processUser 的所有依赖（深度3）：');
  const deps = CallGraphService.collectDependencies('processUser', graph, 3);
  console.log(`   ${deps.join(', ')}\n`);

  // 6. 测试缓存
  console.log('6. 测试缓存（第二次构建应该很快）...');
  const start = Date.now();
  const graph2 = await CallGraphService.buildFileCallGraph(testFile, 'typescript');
  const time = Date.now() - start;
  console.log(`   耗时: ${time}ms (应该 < 5ms)\n`);

  // 7. 详细查看 processUser 节点
  console.log('7. processUser 节点详情：');
  const processUserNode = graph.nodes.get('processUser');
  if (processUserNode) {
    console.log(`   函数名: ${processUserNode.functionName}`);
    console.log(`   调用了: ${processUserNode.callees.join(', ')}`);
    console.log(`   被调用: ${processUserNode.callers.join(', ') || '(无)'}\n`);
  }

  console.log('=== 测试完成 ===');
}

test().catch(console.error);
