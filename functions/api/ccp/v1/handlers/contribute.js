/**
 * 社区贡献端点处理器
 * ===================
 * CCP 协议社区贡献端点。
 *
 * POST /api/ccp/v1/contribute
 *
 * 接收社区贡献的能力锚点，经 JSON Schema 校验后写入 D1。
 *
 * 响应码：
 * - 201：接受
 * - 409：重复 ID
 * - 422：Schema 校验失败
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { queryOne } from "../lib/db.js";
import { validateCapability } from "../lib/schema.js";
import { jsonResponse } from "../lib/response.js";
import { structuredError } from "../lib/errors.js";
import { parseSessionCookie, getSessionUser } from "../lib/session.js";
import { cacheKey } from "../lib/cache.js";

const CCP_VERSION = "v1.0.0";

export async function handleContribute(request, db, env) {
  if (!db) {
    return structuredError("DB_ERROR", {
      detail: { reason: "D1 database not available" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return structuredError("INVALID_JSON");
  }

  const validation = validateCapability(body);
  if (!validation.valid) {
    return structuredError("INVALID_SCHEMA", {
      detail: { errors: validation.errors },
    });
  }

  const existing = await queryOne(db, body.id);
  if (existing) {
    return jsonResponse(
      {
        protocol: "CCP",
        version: CCP_VERSION,
        accepted: false,
        errors: [`Capability ${body.id} already exists`],
      },
      409,
    );
  }

  let contributor = null;
  const sessionToken = parseSessionCookie(request);
  if (sessionToken) {
    contributor = await getSessionUser(env, sessionToken);
  }

  try {
    const now = new Date().toISOString().split("T")[0];
    const features = JSON.stringify(body.features || []);
    const featuresEn = JSON.stringify(body.features_en || []);
    const evidence = body.evidence || { count: 0, uncertainty: 0.5 };

    await db
      .prepare(
        `INSERT INTO capabilities (
           id, name, name_en, "desc", desc_en, input, input_en, output, output_en,
           endpoint, endpoint_type, category, provenance,
           trust_source, trust_usage, trust_usage_rate, trust_success, trust_risk, trust_time,
           evidence_count, evidence_uncertainty,
           features, features_en, usage_guide, usage_guide_en, code_example,
           contributor_login, contributor_id,
           last_updated, version
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        body.id,
        body.name,
        body.name_en,
        body.desc,
        body.desc_en,
        body.input || "",
        body.input_en || "",
        body.output || "",
        body.output_en || "",
        body.endpoint,
        body.endpointType,
        body.category,
        body.provenance || "",
        typeof body.trustSource === "number" ? body.trustSource : 0.5,
        body.trustUsage || 0,
        body.trustUsageRate || 0,
        typeof body.trustSuccess === "number" ? body.trustSuccess : 0.5,
        typeof body.trustRisk === "number" ? body.trustRisk : 0.5,
        typeof body.trustTime === "number" ? body.trustTime : 0.8,
        evidence.count || 0,
        evidence.uncertainty || 0.5,
        features,
        featuresEn,
        body.usageGuide || "",
        body.usageGuide_en || "",
        body.codeExample || "",
        contributor ? contributor.github_login : "",
        contributor ? contributor.github_id : 0,
        body.lastUpdated || now,
        1,
      )
      .run();

    await db
      .prepare(
        `INSERT INTO capability_versions (cap_id, version, changes, data_snapshot)
         VALUES (?, 1, ?, ?)`,
      )
      .bind(
        body.id,
        "Initial contribution via CCP contribute API",
        JSON.stringify(body),
      )
      .run();

    if (contributor) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO contributors
           (github_id, github_login, github_name, github_avatar, contributions_count, last_seen)
           VALUES (?, ?, ?, ?, COALESCE((SELECT contributions_count FROM contributors WHERE github_id = ?), 0) + 1, datetime('now'))`,
        )
        .bind(
          contributor.github_id,
          contributor.github_login,
          contributor.github_name || "",
          contributor.github_avatar || "",
          contributor.github_id,
        )
        .run();

      await db
        .prepare(
          `INSERT INTO contribution_records (github_id, capability_id, action)
           VALUES (?, ?, 'create')`,
        )
        .bind(contributor.github_id, body.id)
        .run();
    }

    const responseData = {
      protocol: "CCP",
      version: CCP_VERSION,
      accepted: true,
      capability_id: body.id,
      message: "Capability anchor accepted. Thank you for your contribution!",
      next_steps: {
        search: `/api/ccp/v1/search?q=${encodeURIComponent(body.name)}`,
        adapter: `/api/ccp/v1/capabilities/${body.id}/adapters/langchain`,
        telemetry: `POST /api/ccp/v1/telemetry { capability_id: "${body.id}", success: true }`,
        trust_tracking: `信任向量将在首次调用后自动更新，访问 /api/ccp/v1/capabilities/${body.id} 查看`,
      },
    };

    if (contributor) {
      responseData.contributor = {
        github_login: contributor.github_login,
        github_id: contributor.github_id,
      };
    }

    try {
      if (env && env.CCP_KV) {
        await env.CCP_KV.delete(cacheKey("list"));
      }
    } catch (_) {}

    return jsonResponse(responseData, 201);
  } catch (e) {
    return structuredError("INTERNAL_ERROR", {
      detail: { cause: e.message },
    });
  }
}

export default { handleContribute };
