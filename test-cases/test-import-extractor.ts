// 测试 ImportExtractor 的 Tree-sitter 实现

import { ImportExtractor } from '../src/model/services/codeAnalysis/ImportExtractor';

async function testTypeScriptImports() {
  console.log('\n=== 测试 TypeScript Import 提取 ===');

  const code = `
import { User } from './models/User';
import * as utils from '../utils/helper';
import type { Config } from './config';
const fs = require('fs');
const path = require('path');

export class UserService {
  // ...
}
`;

  const workspaceRoot = 'd:\\w_dev\\CCD-framework';
  const files = await ImportExtractor.extractImportedFiles(code, workspaceRoot, 'typescript');

  console.log('提取到的文件数量:', files.length);
  console.log('文件列表:');
  files.forEach(f => console.log('  -', f));
}

async function testPythonImports() {
  console.log('\n=== 测试 Python Import 提取 ===');

  const code = `
from .models import User
from ..utils import helper
import os
import sys

class UserService:
    pass
`;

  const workspaceRoot = 'd:\\w_dev\\CCD-framework';
  const files = await ImportExtractor.extractImportedFiles(code, workspaceRoot, 'python');

  console.log('提取到的文件数量:', files.length);
  console.log('文件列表:');
  files.forEach(f => console.log('  -', f));
}

async function testGoImports() {
  console.log('\n=== 测试 Go Import 提取 ===');

  const code = `
package main

import (
    "fmt"
    "./models"
    "../utils"
)

func main() {
    fmt.Println("Hello")
}
`;

  const workspaceRoot = 'd:\\w_dev\\CCD-framework';
  const files = await ImportExtractor.extractImportedFiles(code, workspaceRoot, 'go');

  console.log('提取到的文件数量:', files.length);
  console.log('文件列表:');
  files.forEach(f => console.log('  -', f));
}

async function testCppIncludes() {
  console.log('\n=== 测试 C++ Include 提取 ===');

  const code = `
#include <iostream>
#include "models/User.h"
#include "../utils/helper.h"

int main() {
    return 0;
}
`;

  const workspaceRoot = 'd:\\w_dev\\CCD-framework';
  const files = await ImportExtractor.extractImportedFiles(code, workspaceRoot, 'cpp');

  console.log('提取到的文件数量:', files.length);
  console.log('文件列表:');
  files.forEach(f => console.log('  -', f));
}

async function runTests() {
  try {
    await testTypeScriptImports();
    await testPythonImports();
    await testGoImports();
    await testCppIncludes();
    console.log('\n✅ 所有测试完成');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

runTests();
