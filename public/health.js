/**
 * CCP 联邦网络健康面板 — 前端逻辑
 * =================================
 * 从 /api/ccp/v1/health 获取数据并渲染仪表盘。
 */

const API_BASE = "/api/ccp/v1/health";
const REFRESH_INTERVAL = 60000; // 60 秒

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatDate(iso) {
  if (!iso) return "--";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();

  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return d.toLocaleDateString("zh-CN");
}

function renderOverallStatus(data) {
  const el = document.getElementById("overall-status");
  const ts = document.getElementById("timestamp");

  el.textContent = data.status === "healthy" ? "🟢 健康" : "🟡 降级";
  el.className = `status-indicator ${data.status}`;
  ts.textContent = new Date(data.timestamp).toLocaleString("zh-CN");
}

function renderStats(data) {
  if (!data.stats) return;

  document.getElementById("stat-capabilities").textContent =
    data.stats.capabilities || 0;
  document.getElementById("stat-nodes").textContent =
    data.stats.federation_nodes || 0;
  document.getElementById("stat-contributors").textContent =
    data.stats.contributors || 0;
  document.getElementById("stat-telemetries").textContent =
    data.stats.telemetries || 0;
  document.getElementById("stat-proposals").textContent =
    data.stats.governance_proposals || 0;
}

function renderNodes(data) {
  const nodes = data.nodes || [];
  const summary = data.summary || data.status_summary || {};

  document.getElementById("healthy-count").textContent =
    summary.healthy_nodes || summary.healthy || 0;
  document.getElementById("degraded-count").textContent =
    summary.degraded_nodes || summary.degraded || 0;
  document.getElementById("offline-count").textContent =
    summary.offline_nodes || summary.offline || 0;

  const tbody = document.getElementById("nodes-tbody");

  if (nodes.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="loading">暂无联邦节点</td></tr>';
    return;
  }

  tbody.innerHTML = nodes
    .map(
      (node) => `
    <tr>
      <td><strong>${escapeHtml(node.name || node.id)}</strong></td>
      <td class="mono">${escapeHtml(node.endpoint || "--")}</td>
      <td><span class="status-dot ${node.status}"></span>${node.status}</td>
      <td>${(node.trust_score || 0.5).toFixed(2)}</td>
      <td>${node.capabilities_count || 0}</td>
      <td>${formatDate(node.last_exchange)}</td>
    </tr>`,
    )
    .join("");
}

function renderCoverage(data) {
  const coverage = data.index_coverage;
  if (!coverage) return;

  const avg = Math.round((coverage.average_coverage || 0) * 100);
  document.getElementById("coverage-fill").style.width = `${avg}%`;
  document.getElementById("coverage-text").textContent = `${avg}%`;

  const detail = document.getElementById("coverage-detail");
  const byNode = coverage.coverage_by_node || [];
  detail.innerHTML =
    byNode.length > 0
      ? byNode
          .map(
            (c) =>
              `节点 ${escapeHtml(c.node_id)}: ${c.indexed_count} / ${coverage.total_capabilities} (${Math.round(c.coverage * 100)}%)`,
          )
          .join(" · ")
      : "暂无索引数据";
}

function renderTelemetry(data) {
  const telemetry = data.telemetry;
  if (!telemetry) return;

  document.getElementById("telemetry-total").textContent =
    telemetry.total_telemetries || 0;
  document.getElementById("telemetry-24h").textContent =
    telemetry.last_24h || 0;

  const types = document.getElementById("telemetry-types");
  const byType = telemetry.by_type || [];
  types.innerHTML = byType
    .map(
      (t) =>
        `<span class="telemetry-type-tag">${escapeHtml(t.event_type)}: ${t.count}</span>`,
    )
    .join("");
}

function renderCategories(data) {
  if (!data.categories) return;

  const chart = document.getElementById("categories-chart");
  const categories = data.categories.slice(0, 10);
  const max = Math.max(...categories.map((c) => c.count), 1);

  chart.innerHTML = categories
    .map(
      (c) => `
    <div class="category-bar">
      <span class="category-label">${escapeHtml(c.category)}</span>
      <div class="category-track">
        <div class="category-fill" style="width: ${Math.round((c.count / max) * 100)}%"></div>
      </div>
      <span class="category-count">${c.count}</span>
    </div>`,
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function refresh() {
  try {
    const [healthData, statsData] = await Promise.all([
      fetchJSON(API_BASE),
      fetchJSON(`${API_BASE}/stats`),
    ]);

    renderOverallStatus(healthData);
    renderStats(statsData);
    renderNodes(healthData);
    renderCoverage(healthData);
    renderTelemetry(healthData);
    renderCategories(statsData);
  } catch (err) {
    console.error("健康面板数据获取失败:", err);
    document.getElementById("overall-status").textContent = "⚠️ 连接失败";
    document.getElementById("overall-status").className =
      "status-indicator offline";
  }
}

refresh();
setInterval(refresh, REFRESH_INTERVAL);
