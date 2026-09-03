/**
 * 请求监控
 * =========
 * CCP 协议最小化请求监控模块。
 *
 * 指标：
 * - 请求总数（按端点分类）
 * - 错误数（按端点+状态码分类）
 * - P99 延迟（简化：记录最近 100 次请求延迟）
 *
 * 存储：内存（不持久化），可选 KV 定期刷新
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

const METRICS = {
  requests: {},
  errors: {},
  latencies: [],
};

const MAX_LATENCY_SAMPLES = 100;

export function recordRequest(endpoint, latencyMs, statusCode) {
  const ep = endpoint || "unknown";
  METRICS.requests[ep] = (METRICS.requests[ep] || 0) + 1;

  if (statusCode >= 400) {
    const key = `${ep}:${statusCode}`;
    METRICS.errors[key] = (METRICS.errors[key] || 0) + 1;
  }

  METRICS.latencies.push(latencyMs);
  if (METRICS.latencies.length > MAX_LATENCY_SAMPLES) {
    METRICS.latencies.shift();
  }
}

export function getMetrics() {
  const sorted = METRICS.latencies.slice().sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

  return {
    requests: { ...METRICS.requests },
    errors: { ...METRICS.errors },
    latency: {
      p50,
      p99,
      avg:
        METRICS.latencies.length > 0
          ? Math.round(
              METRICS.latencies.reduce((a, b) => a + b, 0) /
                METRICS.latencies.length,
            )
          : 0,
      samples: METRICS.latencies.length,
    },
    uptime: process.uptime ? Math.round(process.uptime()) : 0,
  };
}

export default { recordRequest, getMetrics };
