import { describe, it, expect } from "vitest";
import {
  computeUsageRate,
  computeSuccess,
  computeUncertainty,
  computeTimeScore,
  computeWeightedScore,
} from "../functions/api/ccp/v1/lib/trust-vector.js";

describe("computeUsageRate", () => {
  it("0 次调用 → 0", () => {
    expect(computeUsageRate(0)).toBe(0);
  });

  it("1 次调用 → 0", () => {
    expect(computeUsageRate(1)).toBe(0);
  });

  it("10 次调用 → 0.2", () => {
    expect(computeUsageRate(10)).toBeCloseTo(0.2, 1);
  });

  it("100 次调用 → 0.4", () => {
    expect(computeUsageRate(100)).toBeCloseTo(0.4, 1);
  });

  it("1000 次调用 → 0.6", () => {
    expect(computeUsageRate(1000)).toBeCloseTo(0.6, 1);
  });

  it("100000 次调用 → 1.0（上限）", () => {
    expect(computeUsageRate(100000)).toBe(1);
  });

  it("超过上限的值仍返回 1.0", () => {
    expect(computeUsageRate(1000000)).toBe(1);
  });
});

describe("computeSuccess", () => {
  it("无历史证据，成功 → 1.0", () => {
    expect(computeSuccess(0, 0, true)).toBe(1);
  });

  it("无历史证据，失败 → 0.5", () => {
    expect(computeSuccess(0, 0, false)).toBe(0.5);
  });

  it("100 次历史（成功率 0.9），新成功 → 滚动更新", () => {
    const result = computeSuccess(0.9, 100, true);
    expect(result).toBeCloseTo((0.9 * 100 + 1) / 101, 5);
  });

  it("100 次历史（成功率 0.9），新失败 → 滚动更新", () => {
    const result = computeSuccess(0.9, 100, false);
    expect(result).toBeCloseTo((0.9 * 100) / 101, 5);
  });
});

describe("computeUncertainty", () => {
  it("0 次证据 → 1.0（完全不确定）", () => {
    expect(computeUncertainty(0)).toBe(1);
  });

  it("10 次证据 → 0.5", () => {
    expect(computeUncertainty(10)).toBeCloseTo(0.5, 1);
  });

  it("100 次证据 → 0.33", () => {
    expect(computeUncertainty(100)).toBeCloseTo(1 / 3, 1);
  });

  it("1000 次证据 → 0.25", () => {
    expect(computeUncertainty(1000)).toBe(0.25);
  });
});

describe("computeTimeScore", () => {
  it("默认时效性 0.5 → 上升", () => {
    const result = computeTimeScore(0.5);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThan(0.55);
  });

  it("undefined 时效性 → 默认 0.5", () => {
    const result = computeTimeScore(undefined);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThan(0.55);
  });
});

describe("computeWeightedScore", () => {
  it("所有维度取最大值，极低不确定性 → 分数接近 0.95", () => {
    const cap = {
      trustSource: 0.95,
      trustUsage: 1000,
      trustUsageRate: 0.95,
      trustSuccess: 0.95,
      trustRisk: 0.05,
      trustTime: 0.95,
    };
    const score = computeWeightedScore(cap, 0.0001);
    expect(score).toBeGreaterThan(0.85);
    expect(score).toBeLessThan(1.0);
  });

  it("不确定性惩罚 → 降低分数", () => {
    const cap = {
      trustSource: 0.9,
      trustUsageRate: 0.8,
      trustSuccess: 0.9,
      trustRisk: 0.2,
      trustTime: 0.8,
    };
    const scoreLow = computeWeightedScore(cap, 0.0001);
    const scoreHigh = computeWeightedScore(cap, 0.5);
    expect(scoreHigh).toBeLessThan(scoreLow);
  });

  it("完全不确定 → 分数为 0", () => {
    const cap = {
      trustSource: 0.9,
      trustUsageRate: 0.8,
      trustSuccess: 0.9,
      trustRisk: 0.2,
      trustTime: 0.8,
    };
    const score = computeWeightedScore(cap, 1);
    expect(score).toBe(0);
  });

  it("低信任所有维度 → 分数很低", () => {
    const cap = {
      trustSource: 0.1,
      trustUsageRate: 0.1,
      trustSuccess: 0.1,
      trustRisk: 0.9,
      trustTime: 0.1,
    };
    const score = computeWeightedScore(cap, 0.0001);
    expect(score).toBeLessThan(0.3);
  });

  it("自定义权重 → 影响分数", () => {
    const cap = {
      trustSource: 0.9,
      trustUsageRate: 0.8,
      trustSuccess: 0.9,
      trustRisk: 0.2,
      trustTime: 0.8,
    };
    const defaultScore = computeWeightedScore(cap, 0.0001);
    const customScore = computeWeightedScore(cap, 0.0001, {
      source: 0.5,
      usage: 0.1,
      success: 0.2,
      risk: 0.1,
      time: 0.1,
    });
    expect(customScore).not.toBe(defaultScore);
  });
});
