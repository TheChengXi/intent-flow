# 现在必须完成 — 分层接口设计

## 数据层（Data Layer）

### 实体（Phase 1）

#### [实体1]
- **字段**：`field: type` — 说明（Phase 1）
- **关系**：与 [实体2]
- **验证规则**：

> 实体字段标注清晰，哪些是 Phase 1 就用到的，哪些是留给后续的

### 仓库接口（Phase 1）

#### [实体1]Repository

```
✅ Phase 1 实现：
  - findById(id): Entity | null
  - findAll(): Entity[]

🔲 预留（Phase 2+ 实现）：
  - create(entity): Entity
  - update(id, partial): Entity
  - delete(id): void
```

> 预留的方法从第一天就有接口签名，后续只加实现不改接口

---

## 应用层（Application Layer）

### 用例（Phase 1）

#### [用例1]
- **职责**：
- **前置条件**：
- **后置条件**：
- **依赖仓库**：
- **依赖哪些预留接口**：（如 findById → Phase 1，create → 预留）

---

## 适配层（Adapter Layer）

### 输入适配器（Phase 1）

#### [适配器1]
- **入口**：
- **调用的用例**：
- **输入/输出格式**：

### 输出适配器（Phase 1）

#### [适配器1]
- **实现的接口**：
- **技术选型**：
- **预留的扩展配置**：（如数据库连接池参数、缓存开关等）
