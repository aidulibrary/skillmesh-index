/**
 * CCP 独立节点搭建脚本 — 第 2 节点
 * =================================
 * 注册到主节点并执行一次联邦索引交换，验证联邦协议闭环。
 *
 * 运行：
 *   node scripts/ccp-standalone-node.js
 * 环境变量（可选）：
 *   CCP_PRIMARY      主节点 CCP API 根地址
 *   CCP_MY_NAME      本节点 ID
 *   CCP_MY_ENDPOINT  本节点对外端点
 */
const PRIMARY = process.env.CCP_PRIMARY || "https://skillmesh.礼字号.中国/api/ccp/v1";
const MY_NAME = process.env.CCP_MY_NAME || "ccp-node2";
const MY_ENDPOINT = process.env.CCP_MY_ENDPOINT || "https://my-node.example.com/api/ccp/v1";

async function fetchJSON(url, options = {}) {
    const res = await fetch(url, { headers: { "Accept": "application/json", "Content-Type": "application/json" }, ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
}

async function main() {
    console.log("=".repeat(60));
    console.log(`CCP 独立节点启动: ${MY_NAME}`);
    console.log("=".repeat(60));

    // 1. 注册到主节点
    console.log(`[${MY_NAME}] 注册到主节点: ${PRIMARY}`);
    const reg = await fetchJSON(`${PRIMARY}/federation/nodes`, {
        method: "POST",
        body: JSON.stringify({ id: MY_NAME, name: MY_NAME, endpoint: MY_ENDPOINT, description: "CCP 独立节点 — 阶段九联邦交换验证" }),
    });
    console.log(`[${MY_NAME}] 注册结果:`, JSON.stringify(reg, null, 2));

    // 2. 索引交换
    console.log(`[${MY_NAME}] 发送索引交换请求`);
    const exc = await fetchJSON(`${PRIMARY}/federation/exchange`, {
        method: "POST",
        body: JSON.stringify({ node: { id: MY_NAME, name: MY_NAME, endpoint: MY_ENDPOINT }, capabilities: [{ id: "standalone-echo-001", name: "Echo Service", name_en: "Echo Service", category: "dev", trust_summary: { usage_rate: 0, success: 0.5, uncertainty: 0.5 } }], summary: { total: 1, categories: { dev: 1 } } }),
    });
    console.log(`[${MY_NAME}] 交换结果:`, JSON.stringify(exc, null, 2));

    // 3. 验证联邦状态
    const nodes = await fetchJSON(`${PRIMARY}/federation/nodes`);
    console.log(`[${MY_NAME}] 联邦节点数: ${nodes.count}`);
    nodes.nodes.forEach(n => console.log(`  - ${n.id}: ${n.name} (${n.endpoint})`));
    console.log("\n✅ 联邦交换验证完成！");
}

main().catch(e => console.error("❌ 失败:", e.message));
