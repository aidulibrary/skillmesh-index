-- ============================================================
-- CCP 联邦种子节点数据
-- 2 个预设联邦节点：学术节点 + 行业节点
-- 版本：v1.0.0
-- ============================================================

-- 学术节点：生物信息学 CCP 节点
INSERT OR IGNORE INTO federation_nodes (id, name, endpoint, description, trust_weight, status, capabilities_count, last_seen)
VALUES (
  'bioinfo-ccp.lab.ac.cn',
  '生物信息学 CCP 节点',
  'https://bioinfo-ccp.lab.ac.cn/api/ccp/v1',
  '高校生物信息学实验室维护的 CCP 联邦节点，聚焦生物信息学工具、序列分析、蛋白质结构预测等学术能力锚点。',
  0.85,
  'active',
  8,
  datetime('now')
);

-- 行业节点：法律 AI 能力节点
INSERT OR IGNORE INTO federation_nodes (id, name, endpoint, description, trust_weight, status, capabilities_count, last_seen)
VALUES (
  'legal-ai-ccp.example.com',
  '法律 AI 能力节点',
  'https://legal-ai-ccp.example.com/api/ccp/v1',
  '法律科技社区维护的 CCP 联邦节点，聚焦合同审查、案例检索、法规解析、文书生成等法律 AI 能力锚点。',
  0.80,
  'active',
  8,
  datetime('now')
);

-- ============================================================
-- 学术节点索引缓存（8 条能力锚点摘要）
-- ============================================================

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('bioinfo-ccp.lab.ac.cn', 'seq-align-blast-101', '序列比对 (BLAST)', 'Sequence Alignment (BLAST)', 'ai', 0.72, 0.96, 0.18);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('bioinfo-ccp.lab.ac.cn', 'protein-structure-predict-102', '蛋白质结构预测', 'Protein Structure Prediction', 'ai', 0.65, 0.91, 0.20);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('bioinfo-ccp.lab.ac.cn', 'genome-annotate-103', '基因组注释', 'Genome Annotation', 'ai', 0.58, 0.94, 0.22);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('bioinfo-ccp.lab.ac.cn', 'literature-mine-104', '文献挖掘', 'Literature Mining', 'language', 0.70, 0.89, 0.19);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('bioinfo-ccp.lab.ac.cn', 'pathway-analyze-105', '通路分析', 'Pathway Analysis', 'ai', 0.55, 0.92, 0.23);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('bioinfo-ccp.lab.ac.cn', 'phylo-tree-106', '系统发育树构建', 'Phylogenetic Tree Construction', 'ai', 0.48, 0.90, 0.25);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('bioinfo-ccp.lab.ac.cn', 'gene-expr-analyze-107', '基因表达分析', 'Gene Expression Analysis', 'data', 0.62, 0.93, 0.21);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('bioinfo-ccp.lab.ac.cn', 'mol-docking-108', '分子对接', 'Molecular Docking', 'ai', 0.52, 0.88, 0.24);

-- ============================================================
-- 行业节点索引缓存（8 条能力锚点摘要）
-- ============================================================

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('legal-ai-ccp.example.com', 'contract-review-201', '合同审查', 'Contract Review', 'language', 0.78, 0.94, 0.17);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('legal-ai-ccp.example.com', 'case-search-202', '案例检索', 'Case Law Search', 'data', 0.82, 0.96, 0.16);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('legal-ai-ccp.example.com', 'statute-parse-203', '法规解析', 'Statute Parsing', 'language', 0.68, 0.91, 0.19);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('legal-ai-ccp.example.com', 'doc-gen-204', '法律文书生成', 'Legal Document Generation', 'language', 0.74, 0.89, 0.18);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('legal-ai-ccp.example.com', 'ip-check-205', '知识产权检索', 'IP Rights Search', 'data', 0.60, 0.93, 0.21);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('legal-ai-ccp.example.com', 'risk-assess-206', '合规风险评估', 'Compliance Risk Assessment', 'ai', 0.66, 0.90, 0.20);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('legal-ai-ccp.example.com', 'entity-extract-207', '法律实体抽取', 'Legal Entity Extraction', 'language', 0.72, 0.92, 0.18);

INSERT OR IGNORE INTO federation_index_cache (node_id, capability_id, name, name_en, category, trust_usage_rate, trust_success, trust_uncertainty)
VALUES ('legal-ai-ccp.example.com', 'clause-compare-208', '条款对比', 'Clause Comparison', 'language', 0.56, 0.95, 0.22);