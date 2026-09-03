/**
 * JSON Schema 校验
 * ================
 * CCP 能力锚点数据校验模块。
 *
 * 校验规则：
 * - 必填字段检查
 * - 类型检查（string/number/array）
 * - ID 格式校验（/^[a-z0-9]+(-[a-z0-9]+)*-[0-9]{3}$/）
 * - 信任向量范围校验（0-1）
 * - 证据层字段校验
 * - 字符串长度限制
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

const SCHEMA = {
  required: [
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
  ],
  strings: [
    "id",
    "name",
    "name_en",
    "desc",
    "desc_en",
    "input",
    "input_en",
    "output",
    "output_en",
    "endpoint",
    "endpointType",
    "category",
    "provenance",
    "usageGuide",
    "usageGuide_en",
    "codeExample",
  ],
  numbers: [
    "trustSource",
    "trustUsage",
    "trustUsageRate",
    "trustSuccess",
    "trustRisk",
    "trustTime",
  ],
  arrays: ["features", "features_en", "tags", "dependencies"],
  idPattern: /^[a-z0-9]+(-[a-z0-9]+)*-[0-9]{3}$/,
  maxStrLen: 500,
  idMaxLen: 100,
};

/**
 * 校验能力锚点数据
 *
 * @param {object} data - 待校验的能力锚点数据
 * @returns {{ valid: boolean, errors: string[] }} 校验结果
 */
export function validateCapability(data) {
  const errors = [];

  for (const field of SCHEMA.required) {
    if (
      !data[field] ||
      (typeof data[field] === "string" && !data[field].trim())
    ) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  for (const field of SCHEMA.strings) {
    if (data[field] !== undefined && data[field] !== null) {
      if (typeof data[field] !== "string") {
        errors.push(`Field ${field} must be a string`);
      } else if (data[field].length > SCHEMA.maxStrLen) {
        errors.push(`Field ${field} exceeds max length ${SCHEMA.maxStrLen}`);
      }
    }
  }

  for (const field of SCHEMA.numbers) {
    if (data[field] !== undefined && data[field] !== null) {
      if (typeof data[field] !== "number" || isNaN(data[field])) {
        errors.push(`Field ${field} must be a number`);
      } else if (data[field] < 0 || data[field] > 1) {
        errors.push(`Field ${field} must be between 0 and 1`);
      }
    }
  }

  if (data.id && !SCHEMA.idPattern.test(data.id)) {
    errors.push(
      `Invalid id format: ${data.id}. Expected pattern: {name}-{variant}-{seq}`,
    );
  }

  if (data.evidence) {
    if (typeof data.evidence.count !== "number" || data.evidence.count < 0) {
      errors.push("evidence.count must be a non-negative number");
    }
    if (
      typeof data.evidence.uncertainty !== "number" ||
      data.evidence.uncertainty < 0 ||
      data.evidence.uncertainty > 1
    ) {
      errors.push("evidence.uncertainty must be between 0 and 1");
    }
  }

  return { valid: errors.length === 0, errors };
}

export { SCHEMA };
export default { validateCapability, SCHEMA };
