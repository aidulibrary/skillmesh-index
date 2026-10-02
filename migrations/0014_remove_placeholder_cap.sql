-- ============================================================
-- SkillMesh D1 迁移 0014
-- 移除遗留的测试占位能力（"????"条目）
--
-- 该条目为早期开发阶段手动插入的测试数据：
--   端点: mcp://math-server/calc
--   名称/描述/输入/输出均为 "????"
--   无源码引用，非种子数据，0 次调用
-- ============================================================

-- 先清除子表外键依赖（capability_versions 中 1 条关联记录）
-- 再删除主表数据（已在远程 D1 执行验证，此处仅做迁移归档）
DELETE FROM capability_versions WHERE cap_id = 'test-math-calc-021';
DELETE FROM capabilities WHERE id = 'test-math-calc-021';