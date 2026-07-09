# 后续扩展 — 分层接口设计

## 数据层（Data Layer）

### 实体扩展（Phase 2+）

#### [实体1 扩展字段]
- **新增字段**：`field: type` — 说明
- **新增关系**：

### 仓库接口扩展（Phase 2+）

#### [实体1]Repository 扩展

实现 Phase 1 预留的接口：
- `create(entity): Entity`
- `update(id, partial): Entity`
- `delete(id): void`

#### [新实体]Repository（全新模块）
- **接口定义**：
- **依赖的 Phase 1 模块**：

---

## 应用层（Application Layer）

### 用例扩展（Phase 2+）

#### [新用例1]
- **职责**：
- **前置条件**：（依赖 Phase 1 的哪些已完成接口）
- **依赖的预留接口**：

---

## 适配层（Adapter Layer）

### 适配器扩展（Phase 2+）

#### [新适配器]
- **入口**：
- **调用的用例**：
- **技术选型**：

---

## 数据流变化

### Phase 1 数据流
```
[适配器 Phase 1] → [用例 Phase 1] → [仓库 Phase 1（只读）]
```

### Phase 2+ 新增数据流
```
[新适配器] → [新用例] → [仓库 Phase 1（写入）]
```
