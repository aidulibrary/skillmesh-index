/**
 * S18 能力采集引擎 — 采集端点（主控制器）
 * ========================================
 *
 * POST /api/ccp/v1/admin/collect
 *
 * 触发一次全量能力采集，整合三个数据源：
 *   1. DeepSeek 官方 API 能力
 *   2. GitHub MCP 开源生态（topic:mcp-server）
 *   3. awesome-mcp-servers 社区列表
 *
 * 认证：X-Admin-Key 请求头（共享密钥）
 * 响应：采集摘要报告 { sources, total, new, updated, skipped, errors }
 *
 * 安全机制：
 *   - 去重：id 主键冲突 → UPDATE（保留已有信任数据）
 *   - 批量：每 100 条提交一次 D1 batch
 *   - 熔断：任一源连续失败 5 次停止采集中断
 *   - 上限：总采集上限 500 条/次，防止异常膨胀
 *
 * 版本：v1.0
 */

import { getDeepSeekCapabilities } from "./sources/deepseek.js";
import { fetchGitHubMCPServers } from "./sources/github-mcp.js";
import { fetchAwesomeMCPServers } from "./sources/awesome-mcp.js";

const MAX_TOTAL = 500;
const BATCH_SIZE = 100;
const MAX_CONSECUTIVE_ERRORS = 5;

function normalizeCapability(cap) {
  const now = new Date().toISOString();
  return {
    id: cap.id,
    name: cap.name || "",
    name_en: cap.name_en || "",
    desc: cap.desc || "",
    desc_en: cap.desc_en || "",
    input: cap.input || "",
    input_en: cap.input_en || "",
    output: cap.output || "",
    output_en: cap.output_en || "",
    endpoint: cap.endpoint || "",
    endpoint_type: cap.endpoint_type || "mcp",
    category: cap.category || "data",
    provenance: cap.provenance || "",
    trust_source: typeof cap.trust_source === "number" ? cap.trust_source : 0.5,
    features: JSON.stringify(cap.features || []),
    features_en: JSON.stringify(cap.features_en || []),
    usage_guide: cap.usage_guide || "",
    usage_guide_en: cap.usage_guide_en || "",
    code_example: cap.code_example || "",
    last_updated: now,
    version: 1,
    updated_at: now,
    source: cap.source || "unknown",
  };
}

async function queryExistingIds(db, ids) {
  if (!db || ids.length === 0) return new Set();
  try {
    const placeholders = ids.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT id FROM capabilities WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all();
    return new Set((results || []).map((r) => r.id));
  } catch (e) {
    console.error("[collector] queryExistingIds error:", e.message);
    return new Set();
  }
}

async function batchUpsert(db, capabilities, existingIds) {
  if (!db) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < capabilities.length; i += BATCH_SIZE) {
    const batch = capabilities.slice(i, i + BATCH_SIZE);
    const stmts = [];

    for (const cap of batch) {
      const normalized = normalizeCapability(cap);
      const exists = existingIds.has(normalized.id);

      if (exists) {
        stmts.push(
          db
            .prepare(
              `UPDATE capabilities SET
               name = ?, name_en = ?, "desc" = ?, desc_en = ?,
               endpoint = ?, endpoint_type = ?, category = ?, provenance = ?,
               features = ?, features_en = ?, last_updated = ?, updated_at = ?,
               version = capabilities.version + 1
             WHERE id = ?`,
            )
            .bind(
              normalized.name,
              normalized.name_en,
              normalized.desc,
              normalized.desc_en,
              normalized.endpoint,
              normalized.endpoint_type,
              normalized.category,
              normalized.provenance,
              normalized.features,
              normalized.features_en,
              normalized.last_updated,
              normalized.updated_at,
              normalized.id,
            ),
        );
        updated++;
      } else {
        stmts.push(
          db
            .prepare(
              `INSERT INTO capabilities (
               id, name, name_en, "desc", desc_en, input, input_en, output, output_en,
               endpoint, endpoint_type, category, provenance, trust_source,
               features, features_en, last_updated, version, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              normalized.id,
              normalized.name,
              normalized.name_en,
              normalized.desc,
              normalized.desc_en,
              normalized.input,
              normalized.input_en,
              normalized.output,
              normalized.output_en,
              normalized.endpoint,
              normalized.endpoint_type,
              normalized.category,
              normalized.provenance,
              normalized.trust_source,
              normalized.features,
              normalized.features_en,
              normalized.last_updated,
              1,
              normalized.updated_at,
              normalized.updated_at,
            ),
        );
        inserted++;
      }
    }

    if (stmts.length > 0) {
      try {
        await db.batch(stmts);
      } catch (e) {
        console.error(
          `[collector] batch upsert error (offset=${i}):`,
          e.message,
        );
        throw e;
      }
    }
  }

  return { inserted, updated };
}

async function collectSource(name, fetchFn, db, existingAll) {
  const result = { name, total: 0, new: 0, updated: 0, skipped: 0, errors: [] };
  let consecutiveErrors = 0;

  try {
    const caps = await fetchFn();
    if (!Array.isArray(caps)) {
      result.errors.push("fetchFn did not return array");
      return result;
    }

    result.total = caps.length;

    if (caps.length === 0) {
      return result;
    }

    const ids = caps.map((c) => c.id).filter(Boolean);
    const localExisting = await queryExistingIds(db, ids);

    const toProcess = [];
    for (const cap of caps) {
      if (!cap.id) {
        result.skipped++;
        continue;
      }
      if (existingAll.has(cap.id)) {
        result.skipped++;
        continue;
      }
      if (localExisting.has(cap.id)) {
        result.updated++;
      } else {
        result.new++;
      }
      toProcess.push(cap);
      existingAll.add(cap.id);
    }

    if (toProcess.length > 0 && db) {
      const upsertResult = await batchUpsert(db, toProcess, localExisting);
      result.inserted = upsertResult.inserted;
      result.updated = upsertResult.updated;
    }

    consecutiveErrors = 0;
  } catch (e) {
    consecutiveErrors++;
    result.errors.push(e.message);
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      result.errors.push(`BREAK: ${MAX_CONSECUTIVE_ERRORS} consecutive errors`);
    }
  }

  return result;
}

export async function handleCollect(request, db, env) {
  if (!db) {
    return new Response(
      JSON.stringify({ error: "D1 database not available", collected: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const adminKey = env?.ADMIN_KEY || env?.COLLECT_ADMIN_KEY;
  if (adminKey) {
    const provided = request.headers.get("X-Admin-Key") || "";
    if (provided !== adminKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", collected: false }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const startTime = Date.now();
  const existingAll = new Set();
  const sources = [];

  // 源 1：DeepSeek 官方 API
  sources.push(
    await collectSource(
      "deepseek-api-official",
      async () => {
        const caps = getDeepSeekCapabilities();
        console.log(
          `[collector] deepseek-api: got ${caps.length} capabilities`,
        );
        return caps.slice(0, MAX_TOTAL);
      },
      db,
      existingAll,
    ),
  );

  // 源 2：GitHub MCP 生态
  const githubToken = env?.GITHUB_TOKEN || env?.GH_TOKEN;
  if (githubToken) {
    sources.push(
      await collectSource(
        "github-mcp-ecosystem",
        async () => {
          console.log("[collector] github-mcp: starting fetch...");
          const caps = await fetchGitHubMCPServers(githubToken);
          console.log(
            `[collector] github-mcp: got ${caps.length} repositories`,
          );
          return caps.slice(0, MAX_TOTAL);
        },
        db,
        existingAll,
      ),
    );
  } else {
    sources.push({
      name: "github-mcp-ecosystem",
      total: 0,
      new: 0,
      updated: 0,
      skipped: 0,
      errors: ["GITHUB_TOKEN not configured — skipped"],
    });
  }

  // 源 3：awesome-mcp-servers（仅在总数未超限时运行）
  if (existingAll.size < MAX_TOTAL) {
    sources.push(
      await collectSource(
        "awesome-mcp-servers",
        async () => {
          console.log("[collector] awesome-mcp: fetching README...");
          const caps = await fetchAwesomeMCPServers();
          console.log(`[collector] awesome-mcp: parsed ${caps.length} entries`);
          return caps.slice(0, MAX_TOTAL - existingAll.size);
        },
        db,
        existingAll,
      ),
    );
  } else {
    sources.push({
      name: "awesome-mcp-servers",
      total: 0,
      new: 0,
      updated: 0,
      skipped: 0,
      errors: [`Total cap limit (${MAX_TOTAL}) reached — skipped`],
    });
  }

  const elapsed = Date.now() - startTime;
  const totalNew = sources.reduce((s, src) => s + (src.new || 0), 0);
  const totalUpdated = sources.reduce((s, src) => s + (src.updated || 0), 0);
  const totalSkipped = sources.reduce((s, src) => s + (src.skipped || 0), 0);
  const totalErrors = sources.reduce(
    (s, src) => s + (src.errors || []).length,
    0,
  );

  const report = {
    collected: true,
    elapsed_ms: elapsed,
    total_caps_in_db: existingAll.size,
    summary: {
      new: totalNew,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: totalErrors,
    },
    sources: sources.map((s) => ({
      name: s.name,
      total: s.total,
      new: s.new || 0,
      updated: s.updated || 0,
      skipped: s.skipped || 0,
      errors: s.errors || [],
    })),
  };

  console.log(
    `[collector] Done in ${elapsed}ms — new=${totalNew} updated=${totalUpdated} skipped=${totalSkipped} errors=${totalErrors}`,
  );

  return new Response(JSON.stringify(report, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
