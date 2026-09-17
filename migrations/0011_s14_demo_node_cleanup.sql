-- ============================================================
-- S14 演示联邦节点清理
-- 目的：移除占位演示节点（非真实外部节点），恢复 /health 面板
--       状态为 "empty"/"healthy"，消除误报警。
-- 版本：v1.0.0
-- 日期：2026-09-17
-- ============================================================

-- 1. 删除演示节点的索引缓存（先删子表）
DELETE FROM federation_index_cache
WHERE node_id IN (
  'bioinfo-ccp.lab.ac.cn',
  'legal-ai-ccp.example.com'
);

-- 2. 删除演示节点本身
DELETE FROM federation_nodes
WHERE id IN (
  'bioinfo-ccp.lab.ac.cn',
  'legal-ai-ccp.example.com'
);

-- 3. 验证：以下查询应返回 0
-- SELECT COUNT(*) FROM federation_nodes;
-- SELECT COUNT(*) FROM federation_index_cache;