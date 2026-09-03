/**
 * KV 缓存层
 * =========
 * CCP 协议 KV 缓存模块。
 *
 * 缓存策略：
 * - 能力列表：TTL 5 分钟（300s）
 * - 能力详情：TTL 10 分钟（600s）
 * - 搜索：不缓存（变化频繁）
 * - 适配器：TTL 30 分钟（1800s）
 *
 * 版本：v1.0
 * 协议：CCP v1.0.0
 */

const CACHE_TTL = {
  list: 300,
  detail: 600,
  adapter: 1800,
};

/**
 * 从 KV 缓存读取
 *
 * @param {object} env - Cloudflare Pages 环境变量
 * @param {string} key - 缓存键
 * @returns {Promise<object|null>} 缓存数据或 null
 */
export async function cacheGet(env, key) {
  if (!env || !env.skillmesh_cache) return null;
  try {
    const raw = await env.skillmesh_cache.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * 写入 KV 缓存
 *
 * @param {object} env - Cloudflare Pages 环境变量
 * @param {string} key - 缓存键
 * @param {object} data - 缓存数据
 * @param {number} ttl - TTL（秒）
 */
export async function cacheSet(env, key, data, ttl) {
  if (!env || !env.skillmesh_cache) return;
  try {
    await env.skillmesh_cache.put(key, JSON.stringify(data), {
      expirationTtl: ttl,
    });
  } catch (_) {}
}

/**
 * 使缓存失效
 *
 * @param {object} env - Cloudflare Pages 环境变量
 * @param {string} key - 缓存键
 */
export async function cacheInvalidate(env, key) {
  if (!env || !env.skillmesh_cache) return;
  try {
    await env.skillmesh_cache.delete(key);
  } catch (_) {}
}

/**
 * 构建缓存键
 *
 * @param {string} type - 缓存类型（list|detail|adapter|search）
 * @param {string} id - 可选标识符
 * @returns {string} 缓存键
 */
export function cacheKey(type, id) {
  const prefix = "ccp:v1";
  switch (type) {
    case "list":
      return `${prefix}:list`;
    case "detail":
      return `${prefix}:detail:${id}`;
    case "adapter":
      return `${prefix}:adapter:${id}`;
    default:
      return `${prefix}:${type}:${id || ""}`;
  }
}

export { CACHE_TTL };
export default { cacheGet, cacheSet, cacheInvalidate, cacheKey, CACHE_TTL };
