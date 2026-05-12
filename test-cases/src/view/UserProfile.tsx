// 测试场景 3：前端组件函数
// 目的：验证前端规范自动选择（COMPILE_SPEC_FRONTEND.md）
// 路径匹配：src/view/** 应该使用前端规范
import React from 'react'


interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// @contract: renderUserProfile(user: User) => JSX.Element
// @step: [验证用户] 检查 user 对象是否有效
// @step: [渲染头像] 渲染用户头像组件
// @step: [渲染信息] 渲染用户名、邮箱等信息
// @step: [返回] 返回完整的 JSX 元素
// @boundary: 当 user 为 null 时，返回空状态组件

