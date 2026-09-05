/**
 * 能力锚点批量导入脚本
 * =====================
 * 从 JSON 文件批量导入能力锚点到 D1 数据库。
 *
 * 使用方式：
 *   npx wrangler d1 execute skillmesh-db --file=scripts/import-capabilities.sql
 *   或
 *   node scripts/import-capabilities.js scripts/seed-capabilities.json
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CCP_VERSION = "v1.0.0";

/**
 * 验证单个能力锚点
 */
function validateCapability(cap) {
  const errors = [];

  const required = [
    "id",
    "name",
    "name_en",
    "desc",
    "desc_en",
    "input",
    "output",
    "endpoint",
    "endpointType",
    "category",
  ];

  for (const field of required) {
    if (!cap[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (cap.id && !/^[a-z0-9]+(-[a-z0-9]+)*-[0-9]{3}$/.test(cap.id)) {
    errors.push(`Invalid id format: ${cap.id} (expected: name-variant-001)`);
  }

  const validTypes = ["mcp", "http", "command", "prompt", "workflow"];
  if (cap.endpointType && !validTypes.includes(cap.endpointType)) {
    errors.push(`Invalid endpointType: ${cap.endpointType}`);
  }

  return errors;
}

/**
 * 生成 SQL INSERT 语句
 */
function generateSQL(capabilities) {
  const statements = [];

  for (const cap of capabilities) {
    const now = new Date().toISOString().split("T")[0];
    const features = JSON.stringify(cap.features || []);
    const featuresEn = JSON.stringify(cap.features_en || []);
    const evidence = JSON.stringify(
      cap.evidence || { count: 0, uncertainty: 0.5 },
    );

    const sql = `
INSERT OR IGNORE INTO capabilities (
  id, name, name_en, "desc", desc_en, input, input_en, output, output_en,
  endpoint, endpoint_type, category, provenance,
  trust_source, trust_usage, trust_usage_rate, trust_success, trust_risk, trust_time,
  evidence_count, evidence_uncertainty,
  features, features_en, usage_guide, usage_guide_en, code_example,
  contributor_login, contributor_id,
  last_updated, version
) VALUES (
  '${cap.id}',
  '${(cap.name || "").replace(/'/g, "''")}',
  '${(cap.name_en || "").replace(/'/g, "''")}',
  '${(cap.desc || "").replace(/'/g, "''")}',
  '${(cap.desc_en || "").replace(/'/g, "''")}',
  '${(cap.input || "").replace(/'/g, "''")}',
  '${(cap.input_en || "").replace(/'/g, "''")}',
  '${(cap.output || "").replace(/'/g, "''")}',
  '${(cap.output_en || "").replace(/'/g, "''")}',
  '${(cap.endpoint || "").replace(/'/g, "''")}',
  '${cap.endpointType || "http"}',
  '${(cap.category || "utility").replace(/'/g, "''")}',
  '${(cap.provenance || "seed-import").replace(/'/g, "''")}',
  ${typeof cap.trustSource === "number" ? cap.trustSource : 0.5},
  ${cap.trustUsage || 0},
  ${cap.trustUsageRate || 0},
  ${typeof cap.trustSuccess === "number" ? cap.trustSuccess : 0.5},
  ${typeof cap.trustRisk === "number" ? cap.trustRisk : 0.5},
  ${typeof cap.trustTime === "number" ? cap.trustTime : 0.8},
  ${evidence.count || 0},
  ${evidence.uncertainty || 0.5},
  '${features.replace(/'/g, "''")}',
  '${featuresEn.replace(/'/g, "''")}',
  '${(cap.usageGuide || "").replace(/'/g, "''")}',
  '${(cap.usageGuide_en || "").replace(/'/g, "''")}',
  '${(cap.codeExample || "").replace(/'/g, "''")}',
  '${(cap.contributor_login || "seed-importer").replace(/'/g, "''")}',
  ${cap.contributor_id || 0},
  '${now}',
  1
);`.trim();

    statements.push(sql);
  }

  return statements.join("\n\n");
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const filePath = args[0] || "scripts/seed-capabilities.json";

  console.log(`CCP 能力锚点批量导入工具 v${CCP_VERSION}`);
  console.log(`读取文件: ${filePath}\n`);

  let data;
  try {
    const raw = readFileSync(resolve(filePath), "utf-8");
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`错误: 无法读取文件 ${filePath}`);
    console.error(err.message);
    process.exit(1);
  }

  const capabilities = Array.isArray(data) ? data : data.capabilities || [];

  if (capabilities.length === 0) {
    console.log("无能力锚点可导入。");
    process.exit(0);
  }

  console.log(`共 ${capabilities.length} 个能力锚点\n`);

  // 验证
  let validCount = 0;
  let invalidCount = 0;

  for (const cap of capabilities) {
    const errors = validateCapability(cap);
    if (errors.length > 0) {
      console.log(`  ❌ ${cap.id || "unknown"}: ${errors.join(", ")}`);
      invalidCount++;
    } else {
      console.log(`  ✅ ${cap.id}: ${cap.name}`);
      validCount++;
    }
  }

  console.log(`\n验证结果: ${validCount} 通过, ${invalidCount} 失败\n`);

  if (invalidCount > 0) {
    console.log("请修复上述错误后重试。");
    process.exit(1);
  }

  // 生成 SQL
  const validCaps = capabilities.filter(
    (c) => validateCapability(c).length === 0,
  );
  const sql = generateSQL(validCaps);

  const outputPath = resolve("scripts/import-capabilities.sql");
  writeFileSync(outputPath, sql, "utf-8");

  console.log(`SQL 已生成: ${outputPath}`);
  console.log(`共 ${validCaps.length} 条 INSERT 语句`);
  console.log(`\n执行导入:`);
  console.log(
    `  npx wrangler d1 execute skillmesh-db --file=scripts/import-capabilities.sql`,
  );
}

main();
