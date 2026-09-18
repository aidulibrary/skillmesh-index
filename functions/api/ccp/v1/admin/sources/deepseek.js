/**
 * S18 能力采集引擎 — DeepSeek API 官方能力适配器
 * ===================================================
 *
 * 从 api-docs.deepseek.com 解析官方 API 能力，转换为 CCP 锚点格式。
 *
 * 采集策略：
 * - 通过 DeepSeek API 文档已知端点列表构建能力描述
 * - 不解析 HTML（避免页面结构变更），使用硬编码的稳定端点映射
 * - 新增端点通过定期更新此映射来支持
 *
 * 版本：v1.0
 */

const CCP_SOURCE = "deepseek-api-official";

const DEEPSEEK_CAPABILITIES = [
  {
    id: "deepseek-chat-completion",
    name: "DeepSeek 对话补全",
    name_en: "DeepSeek Chat Completion",
    desc: "调用 DeepSeek-V3/R1 模型进行多轮对话、文本生成、代码生成",
    desc_en:
      "Call DeepSeek-V3/R1 models for multi-turn chat, text generation, and code generation",
    input: "{ model, messages[], temperature?, max_tokens?, stream? }",
    output: "{ choices[], usage }",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    endpoint_type: "http",
    category: "ai",
    provenance: "https://api-docs.deepseek.com/api/create-chat-completion",
    features: ["多轮对话", "文本生成", "代码生成", "流式输出", "JSON Mode"],
    features_en: [
      "Multi-turn Chat",
      "Text Generation",
      "Code Generation",
      "Streaming",
      "JSON Mode",
    ],
    trust_source: 0.8,
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek 推理器",
    name_en: "DeepSeek Reasoner",
    desc: "使用 DeepSeek-R1 进行深度推理，自动生成思维链（Chain of Thought）",
    desc_en:
      "Use DeepSeek-R1 for deep reasoning with automatic chain-of-thought generation",
    input: "{ model: 'deepseek-reasoner', messages[] }",
    output: "{ choices[], reasoning_content }",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    endpoint_type: "http",
    category: "ai",
    provenance: "https://api-docs.deepseek.com/guides/reasoning_model",
    features: ["深度推理", "思维链", "数学推导", "逻辑分析"],
    features_en: [
      "Deep Reasoning",
      "Chain of Thought",
      "Math Derivation",
      "Logic Analysis",
    ],
    trust_source: 0.8,
  },
  {
    id: "deepseek-fim-completion",
    name: "DeepSeek FIM 代码补全",
    name_en: "DeepSeek FIM Code Completion",
    desc: "代码填充（Fill-in-the-Middle），在光标位置插入/替换代码片段",
    desc_en:
      "Fill-in-the-Middle code completion: insert or replace code at cursor position",
    input: "{ model, prompt, suffix, max_tokens? }",
    output: "{ choices[], usage }",
    endpoint: "https://api.deepseek.com/beta/completions",
    endpoint_type: "http",
    category: "dev",
    provenance: "https://api-docs.deepseek.com/api/create-completion",
    features: ["代码填充", "FIM", "上下文感知"],
    features_en: ["Fill-in-the-Middle", "FIM", "Context-Aware"],
    trust_source: 0.75,
  },
  {
    id: "deepseek-function-calling",
    name: "DeepSeek 函数调用",
    name_en: "DeepSeek Function Calling",
    desc: "让模型输出结构化的函数调用参数，连接到外部工具或 API",
    desc_en:
      "Let models output structured function call arguments to connect external tools/APIs",
    input: "{ model, messages[], tools[], tool_choice? }",
    output: "{ choices[].message.tool_calls[] }",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    endpoint_type: "http",
    category: "ai",
    provenance: "https://api-docs.deepseek.com/guides/function_calling",
    features: ["工具调用", "结构化输出", "多函数并行"],
    features_en: [
      "Tool Calling",
      "Structured Output",
      "Parallel Function Calls",
    ],
    trust_source: 0.8,
  },
  {
    id: "deepseek-file-upload",
    name: "DeepSeek 文件上传",
    name_en: "DeepSeek File Upload",
    desc: "上传文件至 DeepSeek 平台供模型处理（支持 txt/pdf/docx/pptx/xlsx 等）",
    desc_en:
      "Upload files to DeepSeek platform for model processing (txt/pdf/docx/pptx/xlsx etc.)",
    input: "{ file: multipart, purpose: 'batch' }",
    output: "{ id, object, bytes, created_at, filename }",
    endpoint: "https://api.deepseek.com/v1/files",
    endpoint_type: "http",
    category: "data",
    provenance: "https://api-docs.deepseek.com/api/file-upload",
    features: ["文件处理", "多格式支持", "批处理"],
    features_en: ["File Processing", "Multi-format", "Batch Processing"],
    trust_source: 0.75,
  },
  {
    id: "deepseek-models-list",
    name: "DeepSeek 模型列表",
    name_en: "DeepSeek Model List",
    desc: "获取当前可用的 DeepSeek 模型列表及其属性",
    desc_en: "List currently available DeepSeek models and their properties",
    input: "GET /models",
    output: "{ data: [{ id, object, owned_by }] }",
    endpoint: "https://api.deepseek.com/v1/models",
    endpoint_type: "http",
    category: "ai",
    provenance: "https://api-docs.deepseek.com/api/list-models",
    features: ["模型发现", "版本查询"],
    features_en: ["Model Discovery", "Version Query"],
    trust_source: 0.85,
  },
  {
    id: "deepseek-tokenizer",
    name: "DeepSeek Token 估算",
    name_en: "DeepSeek Token Estimation",
    desc: "估算文本的 token 数量，用于计算 API 调用成本和控制上下文窗口",
    desc_en:
      "Estimate token count for text, used for cost calculation and context window control",
    input: "{ model, messages[] } or '{ text }'",
    output: "{ total_tokens }",
    endpoint: "https://api.deepseek.com/v1/tokenize",
    endpoint_type: "http",
    category: "dev",
    provenance: "https://api-docs.deepseek.com/quick_start/pricing",
    features: ["Token 计数", "成本估算"],
    features_en: ["Token Counting", "Cost Estimation"],
    trust_source: 0.7,
  },
];

export function getDeepSeekCapabilities() {
  return DEEPSEEK_CAPABILITIES.map((cap) => ({
    ...cap,
    source: CCP_SOURCE,
  }));
}

export function getDeepSeekCapIds() {
  return DEEPSEEK_CAPABILITIES.map((c) => c.id);
}

export const SOURCE_NAME = "deepseek-api-official";
export const SOURCE_DISPLAY = "DeepSeek 官方 API";
