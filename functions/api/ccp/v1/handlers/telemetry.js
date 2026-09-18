/**
 * 遥测端点处理器
 * ===============
 * CCP 协议遥测端点 — 信任向量运行时闭环。
 *
 * POST /api/ccp/v1/telemetry    → 遥测回传（Agent / DSH 插件）
 * GET  /api/ccp/v1/telemetry    → 遥测记录列表（按 source 筛选）
 *
 * 接收 Agent 或 DSH 插件回传的调用结果，自动更新：
 * - 信任向量（trustUsage, trustUsageRate, trustSuccess, trustTime）
 * - 证据层（evidence.count, evidence.uncertainty）
 * - 版本历史（capability_versions 表）
 *
 * 限流：每 IP 每能力每秒最多 1 次请求
 * 持久化：随请求同步写入 D1（信任向量 + 版本历史 + 遥测明细）
 *
 * 版本：v1.1 — 新增 source 字段 + GET 列表端点（DSH 遥测闭环 S15）
 * 协议：CCP v1.0.0
 */

import { queryOne } from "../lib/db.js";
import { computeTelemetryUpdate } from "../lib/trust-vector.js";
import { jsonResponse } from "../lib/response.js";
import { structuredError } from "../lib/errors.js";

const CCP_VERSION = "v1.0.0";
const TELEMETRY_RATE_LIMIT = new Map();

function getRateKey(ip, capId) {
  return `${ip}:${capId}`;
}

function checkRateLimit(ip, capId) {
  const now = Date.now();
  const key = getRateKey(ip, capId);
  const lastCall = TELEMETRY_RATE_LIMIT.get(key);
  if (lastCall && now - lastCall < 1000) {
    return false;
  }
  TELEMETRY_RATE_LIMIT.set(key, now);
  if (TELEMETRY_RATE_LIMIT.size > 10000) {
    const keys = [...TELEMETRY_RATE_LIMIT.keys()];
    for (let i = 0; i < 1000; i++) TELEMETRY_RATE_LIMIT.delete(keys[i]);
  }
  return true;
}

// 单条遥测持久化：更新信任向量 + 写版本历史 + 写遥测明细
// （S9-3/S9-7 依赖此三处落库；必须随请求同步完成，不能依赖后台批量 flush，
//  否则 Serverless isolate 回收会导致明细与版本历史丢失）
async function persistItem({
  db,
  capId,
  update,
  version,
  agentId,
  success,
  latencyMs,
  traceId,
  traceParent,
  source,
  dshPluginId,
}) {
  try {
    await db
      .prepare(
        `UPDATE capabilities SET
           trust_usage = ?,
           trust_usage_rate = ?,
           trust_success = ?,
           evidence_count = ?,
           evidence_uncertainty = ?,
           trust_time = ?,
           last_updated = ?,
           version = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(
        update.trustUsage,
        update.trustUsageRate,
        update.trustSuccess,
        update.evidenceCount,
        update.evidenceUncertainty,
        update.trustTime,
        update.lastUpdated,
        version,
        capId,
      )
      .run();

    await db
      .prepare(
        `INSERT INTO capability_versions (cap_id, version, changes, data_snapshot)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(
        capId,
        version,
        JSON.stringify(update.changes),
        JSON.stringify(update.snapshot),
      )
      .run();

    // S9-3：遥测明细落 telemetry_records（健康面板数据源）
    // S10-9：附加 W3C Trace Context（trace_id + trace_parent）
    // S15：附加 source（direct/dsh）和 dsh_plugin_id（DSH 遥测闭环）
    await db
      .prepare(
        `INSERT INTO telemetry_records (capability_id, agent_id, event_type, success, latency_ms, trace_id, source, dsh_plugin_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(
        capId,
        agentId || "unknown",
        success ? "invocation" : "error",
        success ? 1 : 0,
        latencyMs || 0,
        traceId || null,
        source || "direct",
        dshPluginId || null,
      )
      .run();
  } catch (_) {}
}

export async function handleTelemetry(request, db, env) {
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

  const capId = body.capability_id;
  if (!capId || typeof capId !== "string") {
    return structuredError("VALIDATION_ERROR", {
      detail: { field: "capability_id", reason: "required string" },
    });
  }
  if (typeof body.success !== "boolean") {
    return structuredError("VALIDATION_ERROR", {
      detail: { field: "success", reason: "required boolean" },
    });
  }
  if (!body.agent_id || typeof body.agent_id !== "string") {
    return structuredError("VALIDATION_ERROR", {
      detail: { field: "agent_id", reason: "required string" },
    });
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(ip, capId)) {
    return structuredError("RATE_LIMITED", {
      detail: { scope: "per-capability", limit: "1 req/sec" },
    });
  }

  // S10-9：W3C Trace Context — 提取 traceparent 头
  const traceParent = request.headers.get("traceparent") || "";
  const traceId =
    body.trace_id || (traceParent ? traceParent.split("-")[1] : null);

  // S15：DSH 遥测闭环 — 追踪遥测来源
  const source = body.source === "dsh" ? "dsh" : "direct";
  const dshPluginId = body.dsh_plugin_id || null;

  try {
    const existing = await queryOne(db, capId);
    if (!existing) {
      return structuredError("CAPABILITY_NOT_FOUND", {
        detail: { id: capId },
      });
    }

    const result = computeTelemetryUpdate(existing, {
      success: body.success,
      latency_ms: body.latency_ms,
      error: body.error,
    });

    const newVersion = (existing.version || 1) + 1;

    // 同步落库：信任向量 / 版本历史 / 遥测明细随请求完成持久化
    await persistItem({
      db,
      capId,
      version: newVersion,
      agentId: body.agent_id,
      success: body.success,
      latencyMs: body.latency_ms || 0,
      traceId,
      traceParent,
      source,
      dshPluginId,
      update: {
        ...result,
        snapshot: existing,
      },
    });

    return jsonResponse({
      protocol: "CCP",
      version: CCP_VERSION,
      capability_id: capId,
      agent_id: body.agent_id,
      success: body.success,
      source,
      dsh_plugin_id: dshPluginId || undefined,
      trace_id: traceId || undefined,
      updated: {
        trust_usage: result.trustUsage,
        trust_usage_rate: result.trustUsageRate,
        trust_success: result.trustSuccess,
        evidence_count: result.evidenceCount,
        evidence_uncertainty: result.evidenceUncertainty,
        trust_time: result.trustTime,
        last_updated: result.lastUpdated,
        version: newVersion,
      },
    });
  } catch (e) {
    return structuredError("INTERNAL_ERROR", {
      detail: { cause: e.message },
    });
  }
}

// ============================================================
// GET /api/ccp/v1/telemetry — 遥测记录列表
// 查询参数：
//   ?source=direct|dsh  按来源筛选（可选，默认全部）
//   ?capability_id={id}  按能力 ID 筛选（可选）
//   ?limit={n}           返回条数限制（默认 20，最大 100）
// ============================================================
export async function handleTelemetryList(db, url) {
  if (!db) {
    return structuredError("DB_ERROR", {
      detail: { reason: "D1 database not available" },
    });
  }

  const params = new URL(url).searchParams;
  const sourceFilter = params.get("source");
  const capFilter = params.get("capability_id");
  const limit = Math.min(parseInt(params.get("limit") || "20", 10), 100);

  let where = [];
  let binds = [];

  if (sourceFilter === "direct" || sourceFilter === "dsh") {
    where.push("source = ?");
    binds.push(sourceFilter);
  }
  if (capFilter) {
    where.push("capability_id = ?");
    binds.push(capFilter);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const records = await db
      .prepare(
        `SELECT * FROM telemetry_records ${whereClause} ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(...binds, limit)
      .all();

    const totalResult = await db
      .prepare("SELECT COUNT(*) as total FROM telemetry_records")
      .first();

    const dshResult = await db
      .prepare(
        "SELECT COUNT(*) as total FROM telemetry_records WHERE source = 'dsh'",
      )
      .first();

    const directResult = await db
      .prepare(
        "SELECT COUNT(*) as total FROM telemetry_records WHERE source = 'direct'",
      )
      .first();

    return jsonResponse({
      protocol: "CCP",
      version: CCP_VERSION,
      records: (records.results || []).map((r) => ({
        id: r.id,
        capability_id: r.capability_id,
        agent_id: r.agent_id,
        event_type: r.event_type,
        success: r.success === 1,
        latency_ms: r.latency_ms,
        source: r.source || "direct",
        dsh_plugin_id: r.dsh_plugin_id || null,
        trace_id: r.trace_id || null,
        created_at: r.created_at,
      })),
      summary: {
        total: totalResult?.total || 0,
        by_source: {
          direct: directResult?.total || 0,
          dsh: dshResult?.total || 0,
        },
      },
    });
  } catch (e) {
    return structuredError("INTERNAL_ERROR", {
      detail: { cause: e.message },
    });
  }
}

export default { handleTelemetry, handleTelemetryList };
