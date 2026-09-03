/**
 * Trust Vector Algorithm v1.0.0
 * ==============================
 * CCP 协议信任向量计算标准库 — 自 v1.0.0 起冻结，算法承诺向后兼容。
 *
 * 信任向量是五维可信度评估体系：
 * - trustSource:  源码可验证性（0-1，越高越可信）
 * - trustUsage:   使用痕迹（调用次数，原始值）
 * - trustUsageRate: 使用痕迹率（归一化至 0-1，基于 log10）
 * - trustSuccess: 成功率（滚动平均，0-1）
 * - trustRisk:    依赖风险（0-1，越低越好）
 * - trustTime:    时效性（衰减函数，0-1）
 *
 * 证据层（L2）：
 * - evidence.count:       证据量（调用次数）
 * - evidence.uncertainty: 不确定性（基于 Josang 主观逻辑，0-1）
 *
 * 冻结承诺：
 * - 公式不变（log10用法痕迹率、滚动平均成功率、Josang不确定性、衰减时效性）
 * - 权重可调（默认 source=25%, usage=20%, success=30%, risk=15%, time=10%）
 * - 新增维度为 additive（不修改已有维度）
 *
 * 版本：v1.0.0（冻结）
 * 协议：CCP v1.0.0
 * 许可：CC BY-SA 4.0
 */

/**
 * 计算使用痕迹率（归一化至 0-1）
 * 公式：min(1, log10(max(usage, 1)) / 5)
 * 1 次调用 → 0, 10 次 → 0.2, 100 次 → 0.4, 1000 次 → 0.6, 100000 次 → 1.0
 *
 * @param {number} usage - 总调用次数
 * @returns {number} 0-1 之间的使用痕迹率
 */
export function computeUsageRate(usage) {
  return Math.min(1, Math.log10(Math.max(usage, 1)) / 5);
}

/**
 * 计算成功率（滚动平均）
 * 公式：newSuccess = (oldSuccess * oldEvidence + newSuccessValue) / (oldEvidence + 1)
 *
 * @param {number} oldSuccess - 旧成功率（0-1）
 * @param {number} oldEvidence - 旧证据量
 * @param {boolean} success - 本次调用是否成功
 * @returns {number} 新的成功率（0-1）
 */
export function computeSuccess(oldSuccess, oldEvidence, success) {
  if (oldEvidence > 0) {
    return (oldSuccess * oldEvidence + (success ? 1 : 0)) / (oldEvidence + 1);
  }
  return success ? 1 : 0.5;
}

/**
 * 计算不确定性（基于 Josang 主观逻辑）
 * 公式：u = 1 / (1 + log10(max(count, 1)))
 * 0 次证据 → 1.0（完全不确定）, 10 次 → 0.5, 100 次 → 0.33, 1000 次 → 0.25
 *
 * @param {number} evidenceCount - 证据量
 * @returns {number} 0-1 之间的不确定性
 */
export function computeUncertainty(evidenceCount) {
  return 1 / (1 + Math.log10(Math.max(evidenceCount, 1)));
}

/**
 * 计算时效性（衰减函数）
 * 公式：newTime = min(1, oldTime * 0.95 + 0.05)
 * 每次更新向 1.0 靠近 5%，长期不更新则自然衰减
 *
 * @param {number} oldTime - 旧时效性（0-1）
 * @returns {number} 新的时效性（0-1）
 */
export function computeTimeScore(oldTime) {
  return Math.min(1, (oldTime || 0.5) * 0.95 + 0.05);
}

/**
 * 计算加权综合信任分
 * 默认权重：source=25%, usage=20%, success=30%, risk=15%, time=10%
 * 结果受不确定性惩罚：finalScore = weightedScore * (1 - uncertainty)
 *
 * @param {object} trust - 信任向量对象
 * @param {number} uncertainty - 不确定性
 * @param {object} weights - 可选权重配置
 * @returns {number} 0-1 之间的综合信任分
 */
export function computeWeightedScore(trust, uncertainty, weights = {}) {
  const w = {
    source: weights.source || 0.25,
    usage: weights.usage || 0.2,
    success: weights.success || 0.3,
    risk: weights.risk || 0.15,
    time: weights.time || 0.1,
  };

  const usageRate =
    trust.trustUsageRate || computeUsageRate(trust.trustUsage || 0);
  const riskInverted = 1 - (trust.trustRisk || 0.5);

  const weighted =
    (trust.trustSource || 0.5) * w.source +
    usageRate * w.usage +
    (trust.trustSuccess || 0.5) * w.success +
    riskInverted * w.risk +
    (trust.trustTime || 0.5) * w.time;

  return weighted * (1 - (uncertainty || 0.5));
}

/**
 * 根据遥测数据计算完整的信任向量更新
 *
 * @param {object} existing - 现有能力锚点数据
 * @param {object} telemetry - 遥测数据 { success, latency_ms, error }
 * @returns {object} 更新后的信任向量 + 证据层 + 变更记录
 */
export function computeTelemetryUpdate(existing, telemetry) {
  const newUsage = (existing.trustUsage || 0) + 1;
  const newUsageRate = computeUsageRate(newUsage);
  const oldEvidence = existing.evidence ? existing.evidence.count : 0;
  const newEvidence = oldEvidence + 1;
  const newSuccess = computeSuccess(
    existing.trustSuccess || 0.5,
    oldEvidence,
    telemetry.success,
  );
  const newUncertainty = computeUncertainty(newEvidence);
  const newTimeScore = computeTimeScore(existing.trustTime);
  const newLastUpdated = new Date().toISOString().split("T")[0];

  const changes = {
    trust_usage: { from: existing.trustUsage || 0, to: newUsage },
    trust_usage_rate: {
      from: existing.trustUsageRate || 0,
      to: Math.round(newUsageRate * 100) / 100,
    },
    trust_success: {
      from: existing.trustSuccess || 0.5,
      to: Math.round(newSuccess * 10000) / 10000,
    },
    evidence_count: { from: oldEvidence, to: newEvidence },
    evidence_uncertainty: {
      from: existing.evidence ? existing.evidence.uncertainty : 0.5,
      to: Math.round(newUncertainty * 100) / 100,
    },
    trust_time: {
      from: existing.trustTime || 0.5,
      to: Math.round(newTimeScore * 100) / 100,
    },
    last_updated: { from: existing.lastUpdated || "", to: newLastUpdated },
  };

  return {
    trustUsage: newUsage,
    trustUsageRate: Math.round(newUsageRate * 100) / 100,
    trustSuccess: Math.round(newSuccess * 10000) / 10000,
    trustTime: Math.round(newTimeScore * 100) / 100,
    evidenceCount: newEvidence,
    evidenceUncertainty: Math.round(newUncertainty * 100) / 100,
    lastUpdated: newLastUpdated,
    changes,
  };
}

export default {
  computeUsageRate,
  computeSuccess,
  computeUncertainty,
  computeTimeScore,
  computeWeightedScore,
  computeTelemetryUpdate,
};
