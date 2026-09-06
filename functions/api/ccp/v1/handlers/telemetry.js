/**
 * 遥测端点处理器
 * ===============
 * CCP 协议遥测端点 — 信任向量运行时闭环。
 *
 * POST /api/ccp/v1/telemetry
 *
 * 接收 Agent 回传的调用结果，自动更新：
 * - 信任向量（trustUsage, trustUsageRate, trustSuccess, trustTime）
 * - 证据层（evidence.count, evidence.uncertainty）
 * - 版本历史（capability_versions 表）
 *
 * 限流：每 IP 每能力每秒最多 1 次请求
 * 批量写入：内存缓冲 60 秒或 100 条，批量写入 D1
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { queryOne } from "../lib/db.js";
import { computeTelemetryUpdate } from "../lib/trust-vector.js";
import { jsonResponse } from "../lib/response.js";
import { structuredError } from "../lib/errors.js";

const CCP_VERSION = "v1.0.0";
const TELEMETRY_RATE_LIMIT = new Map();
const BATCH_INTERVAL_MS = 60000;
const BATCH_MAX_SIZE = 100;

let batchBuffer = [];
let batchTimer = null;

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

function addToBatch(item) {
  batchBuffer.push(item);
  if (batchBuffer.length >= BATCH_MAX_SIZE) {
    flushBatch();
  } else if (!batchTimer) {
    batchTimer = setTimeout(flushBatch, BATCH_INTERVAL_MS);
  }
}

async function flushBatch() {
  if (batchBuffer.length === 0) return;
  const batch = batchBuffer.splice(0);
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  for (const { db, capId, update, version, agentId, success, latencyMs } of batch) {
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
      await db
        .prepare(
          `INSERT INTO telemetry_records (capability_id, agent_id, event_type, success, latency_ms, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        )
        .bind(
          capId,
          agentId || "unknown",
          success ? "invocation" : "error",
          success ? 1 : 0,
          latencyMs || 0,
        )
        .run();
    } catch (_) {}
  }
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

    addToBatch({
      db,
      capId,
      version: newVersion,
      agentId: body.agent_id,
      success: body.success,
      latencyMs: body.latency_ms || 0,
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

export default { handleTelemetry };
