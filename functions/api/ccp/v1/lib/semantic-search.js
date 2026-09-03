/**
 * 语义搜索（Workers AI）
 * ======================
 * CCP 协议语义搜索模块。
 *
 * 使用 Cloudflare Workers AI 的 text-embeddings 模型进行语义匹配。
 * 模型：@cf/baai/bge-base-en-v1.5（支持中英文）
 *
 * 流程：
 * 1. 对查询文本生成 embedding
 * 2. 对能力锚点描述生成 embedding（缓存于 KV）
 * 3. 计算余弦相似度
 * 4. 返回 top-N 结果
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

import { queryAll } from "./db.js";
import { cacheGet, cacheSet, cacheKey } from "./cache.js";

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
const SEMANTIC_CACHE_TTL = 86400;
const TOP_N = 20;

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function buildCapText(cap) {
  return [
    cap.name || "",
    cap.name_en || "",
    cap.desc || "",
    cap.desc_en || "",
    ...(cap.features || []),
    ...(cap.features_en || []),
    cap.category || "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function getEmbedding(env, text) {
  if (!env || !env.AI) return null;
  try {
    const result = await env.AI.run(EMBEDDING_MODEL, { text: [text] });
    return result.data[0];
  } catch (_) {
    return null;
  }
}

async function getCapabilityEmbeddings(env, db) {
  const cacheKeyStr = cacheKey("semantic", "embeddings");
  const cached = await cacheGet(env, cacheKeyStr);
  if (cached) return cached;

  let caps;
  if (db) {
    try {
      caps = await queryAll(db);
    } catch (_) {
      caps = (await import("../../../../_data/capabilities")).CAPABILITIES;
    }
  } else {
    caps = (await import("../../../../_data/capabilities")).CAPABILITIES;
  }

  const embeddings = [];
  for (const cap of caps) {
    const text = buildCapText(cap);
    const emb = await getEmbedding(env, text);
    if (emb) {
      embeddings.push({ cap, embedding: emb });
    }
  }

  if (embeddings.length > 0) {
    await cacheSet(env, cacheKeyStr, embeddings, SEMANTIC_CACHE_TTL);
  }

  return embeddings;
}

export async function semanticSearch(env, db, query, keywordResults = []) {
  if (!env || !env.AI) {
    return keywordResults;
  }

  const queryEmbedding = await getEmbedding(env, query);
  if (!queryEmbedding) {
    return keywordResults;
  }

  const capEmbeddings = await getCapabilityEmbeddings(env, db);
  if (capEmbeddings.length === 0) {
    return keywordResults;
  }

  const keywordIds = new Set(keywordResults.map((c) => c.id));

  const scored = capEmbeddings.map(({ cap, embedding }) => ({
    cap,
    score: cosineSimilarity(queryEmbedding, embedding),
    isKeywordMatch: keywordIds.has(cap.id),
  }));

  scored.sort((a, b) => {
    if (a.isKeywordMatch && !b.isKeywordMatch) return -1;
    if (!a.isKeywordMatch && b.isKeywordMatch) return 1;
    return b.score - a.score;
  });

  const filtered = scored.filter((s) => s.score > 0.3);
  if (filtered.length === 0) {
    return keywordResults;
  }

  return filtered.slice(0, TOP_N).map((s) => ({
    ...s.cap,
    _semanticScore: Math.round(s.score * 100) / 100,
  }));
}

export default { semanticSearch };
