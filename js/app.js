/* ============================================================
   SkillMesh / 插台 — Application Logic
   ============================================================ */

const App = (() => {
  "use strict";

  // --- State ---
  let currentLang = "zh";
  let currentCategory = "all";
  let currentModalId = null;
  let modalTriggerEl = null;
  let searchDebounce = null;
  let semanticReady = false;
  let embeddingsCache = null;
  let currentUser = null;
  let caps = [];
  let capsLoaded = false;
  let federated = false;
  let federationNodes = [];

  // --- API Data Loading ---
  const API_BASE = "/api/ccp/v1";

  async function loadCapabilities() {
    if (capsLoaded && caps.length > 0) return caps;
    try {
      const res = await fetch(`${API_BASE}/capabilities`);
      if (res.ok) {
        const data = await res.json();
        caps = data.capabilities || [];
        capsLoaded = true;
        return caps;
      }
    } catch (_) {
      /* API unavailable, fallback to static data */
    }
    caps = window.CAPABILITIES || [];
    capsLoaded = true;
    return caps;
  }

  async function searchCapabilities(query) {
    if (!query) return loadCapabilities();
    try {
      const params = new URLSearchParams({ q: query });
      if (federated) params.set("federated", "true");
      const res = await fetch(`${API_BASE}/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        // 后端 /search 返回 data.results；兼容旧契约 data.capabilities
        return data.results || data.capabilities || [];
      }
    } catch (_) {
      /* API unavailable, fallback to local search */
    }
    return caps.filter((c) => matchCapability(c, query));
  }

  function getAgentId() {
    const KEY = "skillmesh_agent_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        "web-client-" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8);
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  async function sendTelemetry(capId, success, latencyMs, errorType) {
    try {
      await fetch(`${API_BASE}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: getAgentId(),
          capability_id: capId,
          success,
          latency_ms: latencyMs,
          error_type: errorType || null,
        }),
      });
    } catch (_) {
      /* telemetry is best-effort, silent failure is acceptable */
    }
  }

  // --- Federation Management ---
  async function loadFederationNodes() {
    try {
      const res = await fetch(`${API_BASE}/federation/nodes`);
      if (res.ok) {
        const data = await res.json();
        federationNodes = data.nodes || [];
        renderFederationNodes();
      }
    } catch (_) {
      /* API unavailable */
    }
  }

  function renderFederationNodes() {
    if (federationNodes.length === 0) {
      dom.federationNoNodes.style.display = "block";
      dom.federationNodesList.innerHTML = "";
      dom.federationNodesList.appendChild(dom.federationNoNodes);
      return;
    }
    dom.federationNoNodes.style.display = "none";

    const statusLabels = {
      active: t("federationNodeActive"),
      inactive: t("federationNodeInactive"),
      suspended: t("federationNodeSuspended"),
    };

    dom.federationNodesList.innerHTML = federationNodes
      .map(
        (n) => `
        <div class="federation-node-card">
          <div class="federation-node-info">
            <span class="federation-node-name">${escapeHtml(n.name || n.id)}</span>
            <span class="federation-node-endpoint">${escapeHtml(n.endpoint || "")}</span>
          </div>
          <div class="federation-node-meta">
            <span class="federation-node-status ${n.status || "active"}">${statusLabels[n.status] || n.status}</span>
            <span class="federation-node-trust">${((n.trust_weight || 0.5) * 100).toFixed(0)}%</span>
            <span>${n.capabilities_count || 0} ${t("federationCapCount")}</span>
            <button class="federation-node-remove" data-node-id="${escapeHtml(n.id)}" title="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>`,
      )
      .join("");

    dom.federationNodesList
      .querySelectorAll(".federation-node-remove")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          removeFederationNode(btn.dataset.nodeId),
        );
      });
  }

  async function addFederationNode() {
    const id = dom.fedNodeId.value.trim();
    const name = dom.fedNodeName.value.trim();
    const endpoint = dom.fedNodeEndpoint.value.trim();
    if (!id || !name || !endpoint) {
      alert(t("federationNodeAddError") + ": Missing required fields");
      return;
    }

    dom.fedAddBtn.disabled = true;
    dom.fedAddBtn.textContent = "…";

    try {
      const res = await fetch(`${API_BASE}/federation/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          endpoint,
          description: dom.fedNodeDesc.value.trim(),
          trust_weight: parseFloat(dom.fedNodeTrust.value) || 0.5,
        }),
      });
      if (res.ok) {
        dom.fedNodeId.value = "";
        dom.fedNodeName.value = "";
        dom.fedNodeEndpoint.value = "";
        dom.fedNodeDesc.value = "";
        await loadFederationNodes();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(t("federationNodeAddError") + ": " + (err.error || res.status));
      }
    } catch (_) {
      alert(t("federationNodeAddError"));
    } finally {
      dom.fedAddBtn.disabled = false;
      dom.fedAddBtn.textContent = t("federationAddBtn");
    }
  }

  async function removeFederationNode(nodeId) {
    try {
      const res = await fetch(`${API_BASE}/federation/nodes/${nodeId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        federationNodes = federationNodes.filter((n) => n.id !== nodeId);
        renderFederationNodes();
      }
    } catch (_) {
      /* best-effort removal */
    }
  }

  function toggleFederation() {
    federated = dom.federatedToggle.checked;
    dom.federatedToggleText.textContent = federated
      ? t("federationToggle") + " ✓"
      : t("federationToggle");
    if (dom.searchInput.value.trim()) {
      handleSearch();
    }
  }

  // --- DOM References ---
  const dom = {
    app: document.getElementById("app"),
    btnZh: document.getElementById("btn-zh"),
    btnEn: document.getElementById("btn-en"),
    btnJa: document.getElementById("btn-ja"),
    authArea: document.getElementById("auth-area"),
    userArea: document.getElementById("user-area"),
    subtitle: document.getElementById("subtitle"),
    searchInput: document.getElementById("searchInput"),
    searchHint: document.getElementById("searchHint"),
    categoryFilter: document.getElementById("categoryFilter"),
    cardGrid: document.getElementById("cardGrid"),
    loadingSkeleton: document.getElementById("loadingSkeleton"),
    emptyState: document.getElementById("emptyState"),
    emptyTitle: document.querySelector("#emptyState .empty-title"),
    emptySub: document.querySelector("#emptyState .empty-sub"),
    modalOverlay: document.getElementById("modalOverlay"),
    modalContainer: document.getElementById("modalContainer"),
    modalTitle: document.getElementById("modalTitle"),
    modalDesc: document.getElementById("modalDesc"),
    modalInput: document.getElementById("modalInput"),
    modalOutput: document.getElementById("modalOutput"),
    modalEndpoint: document.getElementById("modalEndpoint"),
    modalProvenance: document.getElementById("modalProvenance"),
    modalFeatures: document.getElementById("modalFeatures"),
    modalUsageGuide: document.getElementById("modalUsageGuide"),
    modalCodeExample: document.getElementById("modalCodeExample"),
    trustSource: document.getElementById("trustSource"),
    trustSourceVal: document.getElementById("trustSourceVal"),
    trustUsage: document.getElementById("trustUsage"),
    trustUsageVal: document.getElementById("trustUsageVal"),
    trustSuccess: document.getElementById("trustSuccess"),
    trustSuccessVal: document.getElementById("trustSuccessVal"),
    trustRisk: document.getElementById("trustRisk"),
    trustRiskVal: document.getElementById("trustRiskVal"),
    trustTime: document.getElementById("trustTime"),
    trustTimeVal: document.getElementById("trustTimeVal"),
    evidenceCount: document.getElementById("evidenceCount"),
    evidenceUncertainty: document.getElementById("evidenceUncertainty"),

    // Federation
    federatedToggle: document.getElementById("federatedToggle"),
    federatedToggleText: document.getElementById("federatedToggleText"),
    federationPanel: document.getElementById("federationPanel"),
    federationToggleBtn: document.getElementById("federationToggleBtn"),
    federationBody: document.getElementById("federationBody"),
    federationTitle: document.getElementById("federationTitle"),
    federationAddNodeTitle: document.getElementById("federationAddNodeTitle"),
    federationNodesTitle: document.getElementById("federationNodesTitle"),
    fedNodeId: document.getElementById("fedNodeId"),
    fedNodeName: document.getElementById("fedNodeName"),
    fedNodeEndpoint: document.getElementById("fedNodeEndpoint"),
    fedNodeDesc: document.getElementById("fedNodeDesc"),
    fedNodeTrust: document.getElementById("fedNodeTrust"),
    fedAddBtn: document.getElementById("fedAddBtn"),
    federationNodesList: document.getElementById("federationNodesList"),
    federationNoNodes: document.getElementById("federationNoNodes"),
  };

  // --- Helpers ---
  function t(key) {
    return I18N[currentLang][key] || key;
  }

  function getLocalized(cap, field) {
    if (currentLang === "zh") return cap[field];
    const enField = field + "_en";
    return cap[enField] || cap[field];
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Star Rating ---
  function renderStars(score) {
    const full = Math.floor(score * 5);
    const hasHalf = score * 5 - full >= 0.25;
    let html = "";
    for (let i = 0; i < 5; i++) {
      if (i < full) {
        html +=
          '<svg viewBox="0 0 20 20" fill="var(--sm-amber-500)"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
      } else if (i === full && hasHalf) {
        html +=
          '<svg viewBox="0 0 20 20" fill="var(--sm-amber-500)"><defs><linearGradient id="half"><stop offset="50%" stop-color="var(--sm-amber-500)"/><stop offset="50%" stop-color="var(--sm-border-subtle)"/></linearGradient></defs><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" fill="url(#half)"/></svg>';
      } else {
        html +=
          '<svg viewBox="0 0 20 20" fill="var(--sm-border-subtle)"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
      }
    }
    return html;
  }

  // --- Endpoint Icon ---
  function getEndpointIcon(type) {
    const icons = {
      http: '<svg class="endpoint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
      mcp: '<svg class="endpoint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      command:
        '<svg class="endpoint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
      prompt:
        '<svg class="endpoint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
      workflow:
        '<svg class="endpoint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
    };
    return icons[type] || "";
  }

  // --- Category Labels ---
  function getCategoryLabel(cat) {
    const map = {
      all: "categoryAll",
      ai: "categoryAI",
      data: "categoryData",
      media: "categoryMedia",
      language: "categoryLanguage",
      dev: "categoryDev",
    };
    return t(map[cat] || "categoryAll");
  }

  // ============================================================
  //  综合信任分 (Task 2.2)
  // ============================================================
  function computeTrustScore(cap) {
    const w = {
      source: 0.25,
      usage: 0.2,
      success: 0.3,
      risk: 0.15,
      time: 0.1,
    };
    const riskScore = 1 - (cap.trustRisk || 0.5);
    const usageNorm =
      cap.trustUsageRate ??
      (function (u) {
        return Math.min(1, Math.log10(Math.max(u || 0, 1)) / 5);
      })(cap.trustUsage);
    const base =
      w.source * (cap.trustSource || 0.5) +
      w.usage * usageNorm +
      w.success * (cap.trustSuccess || 0.5) +
      w.risk * riskScore +
      w.time * (cap.trustTime || 0.5);
    const uncertainty = cap.evidence ? cap.evidence.uncertainty : 0.5;
    return Math.max(0, base * (1 - uncertainty));
  }

  // ============================================================
  //  不确定性徽标 (Task 2.1)
  // ============================================================
  function getUncertaintyBadge(cap) {
    if (cap.evidence && cap.evidence.count < 100) {
      return t("newCapability");
    }
    return "";
  }

  // ============================================================
  //  Search — keyword matching (fallback)
  // ============================================================
  function matchCapability(cap, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const searchText = [
      cap.name,
      cap.name_en,
      cap.desc,
      cap.desc_en,
      cap.id,
      cap.endpointType,
      cap.category,
    ]
      .join(" ")
      .toLowerCase();
    return searchText.includes(q);
  }

  // ============================================================
  //  Semantic Search (Task 3.1)
  // ============================================================
  function getEmbeddingKey() {
    return "skillmesh-embeddings-v1";
  }

  function getEmbeddingText(cap) {
    return [cap.name, cap.name_en, cap.desc, cap.desc_en]
      .join(" ")
      .toLowerCase();
  }

  async function buildEmbeddings() {
    if (embeddingsCache) return embeddingsCache;

    const cached = localStorage.getItem(getEmbeddingKey());
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.ids && parsed.vectors && parsed.ids.length === caps.length) {
          embeddingsCache = parsed;
          return parsed;
        }
      } catch (_) {
        /* ignore corrupt cache */
      }
    }

    if (!window.__transformers || !window.__transformers.pipeline) {
      return null;
    }

    try {
      const extractor = await window.__transformers.pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
      const vectors = [];
      for (const cap of caps) {
        const text = getEmbeddingText(cap);
        const result = await extractor(text, {
          pooling: "mean",
          normalize: true,
        });
        vectors.push(Array.from(result.data));
      }
      const data = {
        ids: caps.map((c) => c.id),
        vectors: vectors,
        ts: Date.now(),
      };
      localStorage.setItem(getEmbeddingKey(), JSON.stringify(data));
      embeddingsCache = data;
      return data;
    } catch (e) {
      console.warn("Semantic embedding build failed:", e.message);
      return null;
    }
  }

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

  async function semanticSearch(query) {
    const data = await buildEmbeddings();
    if (!data) return null;

    if (!window.__transformers || !window.__transformers.pipeline) return null;

    try {
      const extractor = await window.__transformers.pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
      const result = await extractor(query, {
        pooling: "mean",
        normalize: true,
      });
      const queryVec = Array.from(result.data);

      const scored = data.ids.map((id, i) => ({
        id,
        score: cosineSimilarity(queryVec, data.vectors[i]),
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.map((s) => s.id);
    } catch (e) {
      console.warn("Semantic search failed, falling back:", e.message);
      return null;
    }
  }

  async function initSemanticSearch() {
    try {
      await buildEmbeddings();
      semanticReady = true;
    } catch (_) {
      semanticReady = false;
    }
  }

  // ============================================================
  //  Filter + Sort
  // ============================================================
  function filterCapabilities() {
    const query = dom.searchInput.value.trim();
    let list = caps;

    if (currentCategory !== "all") {
      list = list.filter((c) => c.category === currentCategory);
    }

    list = list.filter((c) => matchCapability(c, query));

    list.sort((a, b) => computeTrustScore(b) - computeTrustScore(a));

    return list;
  }

  async function filterCapabilitiesAsync() {
    const query = dom.searchInput.value.trim();
    let list = caps;

    if (currentCategory !== "all") {
      list = list.filter((c) => c.category === currentCategory);
    }

    if (query && semanticReady) {
      const semanticIds = await semanticSearch(query);
      if (semanticIds && semanticIds.length > 0) {
        const idSet = new Set(semanticIds);
        list = list.filter((c) => idSet.has(c.id));
        list.sort(
          (a, b) => semanticIds.indexOf(a.id) - semanticIds.indexOf(b.id),
        );
      } else {
        list = list.filter((c) => matchCapability(c, query));
        list.sort((a, b) => computeTrustScore(b) - computeTrustScore(a));
      }
    } else {
      list = list.filter((c) => matchCapability(c, query));
      list.sort((a, b) => computeTrustScore(b) - computeTrustScore(a));
    }

    return list;
  }

  // --- Render ---
  function renderCard(cap, index) {
    const name = getLocalized(cap, "name");
    const desc = getLocalized(cap, "desc");
    const tagClass = `endpoint-tag tag-${cap.endpointType || "mcp"}`;
    const tagLabel = (cap.endpointType || "mcp").toUpperCase();
    const icon = getEndpointIcon(cap.endpointType || "mcp");
    const trustScore = computeTrustScore(cap);
    const stars = renderStars(trustScore);
    const delay = Math.min(index * 60, 600);
    const badge = getUncertaintyBadge(cap);
    const usageCount = cap.evidence ? cap.evidence.count : cap.trustUsage;
    const isFederated = cap._source === "federated";
    const fedBadge = isFederated
      ? `<span class="federated-badge">${t("federatedSource")}: ${escapeHtml(cap._source_node || "")}</span>`
      : "";
    const onClick = isFederated
      ? `window.open('${cap._source_endpoint}/capabilities/${cap.id}', '_blank')`
      : `App.openModal('${cap.id}')`;

    return `
      <div
        class="card fade-in${isFederated ? " card-federated" : ""}"
        style="animation-delay:${delay}ms"
        onclick="${onClick}"
        onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); ${onClick}; }"
        role="button"
        tabindex="0"
        aria-label="${escapeHtml(name)} — ${t("source")}: ${(trustScore * 5).toFixed(1)}/5${isFederated ? " (" + t("federatedSource") + ")" : ""}"
      >
        ${badge ? `<span class="badge-new">${badge}</span>` : ""}
        <div class="card-header">
          <h3 class="card-title">${escapeHtml(name)}${fedBadge}</h3>
          <span class="${tagClass}">${icon} ${tagLabel}</span>
        </div>
        <p class="card-desc">${escapeHtml(desc)}</p>
        <div class="card-footer">
          <div class="card-stars" title="${(trustScore * 5).toFixed(1)} / 5">
            ${stars}
          </div>
          <span class="card-usage">${usageCount.toLocaleString()} ${t("calls")}</span>
        </div>
      </div>`;
  }

  function renderSkeleton() {
    let html = "";
    for (let i = 0; i < 6; i++) {
      html += `
        <div class="skeleton-card">
          <div class="skeleton-line short"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line medium"></div>
        </div>`;
    }
    return html;
  }

  function renderCards() {
    const filtered = filterCapabilities();

    dom.loadingSkeleton.classList.add("hidden");

    if (caps.length === 0) {
      dom.cardGrid.innerHTML = "";
      dom.emptyState.classList.remove("hidden");
      dom.emptyTitle.textContent = t("noData");
      dom.emptySub.textContent = "";
      return;
    }

    if (filtered.length === 0) {
      dom.cardGrid.innerHTML = "";
      dom.emptyState.classList.remove("hidden");
      dom.emptyTitle.textContent = t("empty");
      dom.emptySub.textContent = t("emptySub");
      return;
    }

    dom.emptyState.classList.add("hidden");
    dom.cardGrid.innerHTML = filtered.map((c, i) => renderCard(c, i)).join("");

    requestAnimationFrame(() => {
      const cards = dom.cardGrid.querySelectorAll(".card");
      cards.forEach((card) => {
        card.classList.add("reveal", "visible");
      });
    });
  }

  async function renderCardsAsync() {
    const query = dom.searchInput.value.trim();

    if (query) {
      let filtered;
      try {
        filtered = await searchCapabilities(query);
      } catch (_) {
        filtered = semanticReady
          ? await filterCapabilitiesAsync()
          : filterCapabilities();
      }

      dom.loadingSkeleton.classList.add("hidden");

      if (caps.length === 0) {
        dom.cardGrid.innerHTML = "";
        dom.emptyState.classList.remove("hidden");
        dom.emptyTitle.textContent = t("noData");
        dom.emptySub.textContent = "";
        return;
      }

      if (filtered.length === 0) {
        dom.cardGrid.innerHTML = "";
        dom.emptyState.classList.remove("hidden");
        dom.emptyTitle.textContent = t("empty");
        dom.emptySub.textContent = t("emptySub");
        return;
      }

      dom.emptyState.classList.add("hidden");
      dom.cardGrid.innerHTML = filtered
        .map((c, i) => renderCard(c, i))
        .join("");

      requestAnimationFrame(() => {
        const cards = dom.cardGrid.querySelectorAll(".card");
        cards.forEach((card) => {
          card.classList.add("reveal", "visible");
        });
      });
    } else {
      renderCards();
    }
  }

  function showLoading() {
    dom.cardGrid.innerHTML = "";
    dom.emptyState.classList.add("hidden");
    dom.loadingSkeleton.innerHTML = renderSkeleton();
    dom.loadingSkeleton.classList.remove("hidden");
  }

  // --- Category Filter ---
  function renderCategoryChips() {
    const categories = ["all", "ai", "data", "media", "language", "dev"];
    dom.categoryFilter.innerHTML = categories
      .map(
        (cat) =>
          `<button
            class="category-chip${cat === currentCategory ? " active" : ""}"
            onclick="App.setCategory('${cat}')"
            aria-pressed="${cat === currentCategory}"
          >${getCategoryLabel(cat)}</button>`,
      )
      .join("");
  }

  function setCategory(cat) {
    if (cat === currentCategory) return;
    currentCategory = cat;
    renderCategoryChips();
    showLoading();
    setTimeout(renderCards, 150);
  }

  // --- Modal ---
  function openModal(id) {
    const cap = caps.find((c) => c.id === id);
    if (!cap) return;

    currentModalId = id;
    modalTriggerEl = document.activeElement;

    dom.modalTitle.textContent = getLocalized(cap, "name");
    dom.modalDesc.textContent = getLocalized(cap, "desc");
    dom.modalInput.textContent = getLocalized(cap, "input");
    dom.modalOutput.textContent = getLocalized(cap, "output");
    dom.modalEndpoint.textContent = cap.endpoint;
    dom.modalProvenance.textContent = cap.provenance;
    dom.modalProvenance.href = cap.provenance;

    const features = getLocalized(cap, "features") || [];
    dom.modalFeatures.innerHTML = features
      .map((f) => `<span class="feature-tag">${escapeHtml(f)}</span>`)
      .join("");

    dom.modalUsageGuide.textContent = getLocalized(cap, "usageGuide") || "";

    dom.modalCodeExample.textContent = cap.codeExample || "";

    // Trust vector — use real data, no random
    dom.trustSource.style.width = `${(cap.trustSource * 100).toFixed(0)}%`;
    dom.trustSourceVal.textContent = cap.trustSource.toFixed(2);

    const usagePct =
      cap.trustUsageRate != null
        ? cap.trustUsageRate * 100
        : Math.min(cap.trustUsage / 5000, 1) * 100;
    dom.trustUsage.style.width = `${usagePct.toFixed(0)}%`;
    dom.trustUsageVal.textContent =
      cap.trustUsageRate != null
        ? cap.trustUsageRate.toFixed(2)
        : cap.trustUsage.toLocaleString();

    dom.trustSuccess.style.width = `${(cap.trustSuccess * 100).toFixed(0)}%`;
    dom.trustSuccessVal.textContent = cap.trustSuccess.toFixed(2);

    dom.trustRisk.style.width = `${(cap.trustRisk * 100).toFixed(0)}%`;
    dom.trustRiskVal.textContent = cap.trustRisk.toFixed(2);

    // TimeScore — computed from lastUpdated (no random!)
    let timeScore = cap.trustTime;
    if (cap.lastUpdated) {
      const lastDate = new Date(cap.lastUpdated);
      const today = new Date();
      const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      timeScore = Math.max(0, 1 - daysSince / 90);
      timeScore = Math.round(timeScore * 100) / 100;
    }
    dom.trustTime.style.width = `${(timeScore * 100).toFixed(0)}%`;
    dom.trustTimeVal.textContent = timeScore.toFixed(2);

    // Evidence bar
    if (cap.evidence) {
      const countText = t("evidenceCount").replace(
        "{n}",
        cap.evidence.count.toLocaleString(),
      );
      dom.evidenceCount.textContent = countText;
      dom.evidenceUncertainty.textContent =
        t("uncertainty") +
        " " +
        (cap.evidence.uncertainty * 100).toFixed(0) +
        "%";
    } else {
      dom.evidenceCount.textContent = "";
      dom.evidenceUncertainty.textContent = "";
    }

    // Show overlay
    dom.modalOverlay.classList.remove("hidden");
    dom.modalContainer.classList.add("enter");
    dom.modalContainer.scrollTop = 0;
    requestAnimationFrame(() => {
      dom.modalContainer.classList.add("enter-active");
    });

    document.body.style.overflow = "hidden";

    // Accessibility: hide background content from screen readers
    if (dom.app) dom.app.setAttribute("aria-hidden", "true");

    // Focus management: move focus into modal (close button)
    requestAnimationFrame(() => {
      const closeBtn = dom.modalOverlay.querySelector(".modal-close-btn");
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeModal() {
    dom.modalContainer.classList.remove("enter-active");
    dom.modalContainer.classList.add("exit");

    const onTransitionEnd = () => {
      dom.modalOverlay.classList.add("hidden");
      dom.modalContainer.classList.remove("exit", "enter");
      dom.modalContainer.removeEventListener("transitionend", onTransitionEnd);
      document.body.style.overflow = "";
      if (dom.app) dom.app.removeAttribute("aria-hidden");
      if (modalTriggerEl && typeof modalTriggerEl.focus === "function") {
        modalTriggerEl.focus();
      }
      currentModalId = null;
      modalTriggerEl = null;
    };

    dom.modalContainer.addEventListener("transitionend", onTransitionEnd);
  }

  // ============================================================
  //  Routing Operations (Task: 调用路由层)
  // ============================================================

  function getCurrentCap() {
    if (!currentModalId) return null;
    return caps.find((c) => c.id === currentModalId) || null;
  }

  // --- DOM refs for routing panels ---
  const routingDom = {
    codePanel: document.getElementById("codePanel"),
    codePanelTitle: document.getElementById("codePanelTitle"),
    codeContent: document.getElementById("codeContent"),
    codeTabs: document.getElementById("codeTabs"),
    tryItPanel: document.getElementById("tryItPanel"),
    tryItBtn: document.getElementById("tryItBtn"),
    tryItOnlyHttp: document.getElementById("tryItOnlyHttp"),
    tryItForm: document.getElementById("tryItForm"),
    tryItMethod: document.getElementById("tryItMethod"),
    tryItParams: document.getElementById("tryItParams"),
    tryItHeaders: document.getElementById("tryItHeaders"),
    tryItResult: document.getElementById("tryItResult"),
    tryItMeta: document.getElementById("tryItMeta"),
    tryItResponse: document.getElementById("tryItResponse"),
    exportPanel: document.getElementById("exportPanel"),
    exportContent: document.getElementById("exportContent"),
    exportContentTitle: document.getElementById("exportContentTitle"),
    exportCodeContent: document.getElementById("exportCodeContent"),
    dshInstallSection: document.getElementById("dshInstallSection"),
    dshCliCommand: document.getElementById("dshCliCommand"),
    dshUrlCommand: document.getElementById("dshUrlCommand"),
  };

  let currentCodeTab = "curl";
  let currentGeneratedCode = "";
  let currentExportCode = "";

  // --- Generate Code (Pattern 1: Code Generation) ---
  function generateCode() {
    const cap = getCurrentCap();
    if (!cap) return;

    const isOpen = !routingDom.codePanel.classList.contains("hidden");
    routingDom.codePanel.classList.toggle("hidden");

    if (isOpen) return;

    routingDom.tryItPanel.classList.add("hidden");
    routingDom.exportPanel.classList.add("hidden");
    routingDom.exportContent.classList.add("hidden");

    currentCodeTab = "curl";
    const tabs = ["curl", "fetch", "python", "node"];
    routingDom.codeTabs.innerHTML = tabs
      .map(
        (t) =>
          `<button class="routing-tab${
            t === currentCodeTab ? " active" : ""
          }" onclick="App.switchCodeTab('${t}')">${t}</button>`,
      )
      .join("");

    routingDom.codePanelTitle.textContent = t("generateCode");
    switchCodeTab("curl");
  }

  function switchCodeTab(tab) {
    const cap = getCurrentCap();
    if (!cap) return;

    currentCodeTab = tab;

    const tabs = routingDom.codeTabs.querySelectorAll(".routing-tab");
    tabs.forEach((t) => {
      t.classList.toggle("active", t.textContent.trim() === tab);
    });

    const endpoint = cap.endpoint;
    const epType = cap.endpointType;
    const example = cap.codeExample || "";

    let code = "";
    switch (tab) {
      case "curl":
        if (epType === "http") {
          code = `curl -X POST "${endpoint}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "input": "your-value-here"\n  }'`;
        } else if (epType === "mcp") {
          code = `# MCP endpoint — use MCP client to invoke\n# Endpoint: ${endpoint}\n# Example via mcp-cli:\nmcp-cli call ${endpoint} --params '{"input": "value"}'`;
        } else if (epType === "command") {
          code = `# Command line invocation\n${endpoint}`;
        } else {
          code = `# ${epType} endpoint\n# Endpoint: ${endpoint}`;
        }
        break;
      case "fetch":
        if (epType === "http") {
          code = `fetch("${endpoint}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ input: "your-value-here" })\n})\n  .then(res => res.json())\n  .then(data => console.log(data));`;
        } else {
          code = `// ${epType} type — use respective client library\n// Endpoint: ${endpoint}`;
        }
        break;
      case "python":
        if (epType === "http") {
          code = `import requests\n\nresponse = requests.post(\n    "${endpoint}",\n    headers={"Content-Type": "application/json"},\n    json={"input": "your-value-here"}\n)\nprint(response.json())`;
        } else if (epType === "mcp") {
          code = `# MCP endpoint\n# Install: pip install mcp\nfrom mcp import Client\n\nclient = Client("${endpoint}")\nresult = client.call("${endpoint}", {"input": "value"})\nprint(result)`;
        } else {
          code = `# ${epType} endpoint\n# Endpoint: ${endpoint}`;
        }
        break;
      case "node":
        if (epType === "http") {
          code = `const response = await fetch("${endpoint}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ input: "your-value-here" })\n});\nconst data = await response.json();\nconsole.log(data);`;
        } else {
          code = `// ${epType} type — use respective client library\n// Endpoint: ${endpoint}`;
        }
        break;
    }

    if (example && tab === "curl") {
      code = example + "\n\n" + code;
    }

    currentGeneratedCode = code;
    routingDom.codeContent.textContent = code;
  }

  // --- Toggle Try-It (Pattern 2: Browser Try-It) ---
  function toggleTryIt() {
    const cap = getCurrentCap();
    if (!cap) return;

    const isOpen = !routingDom.tryItPanel.classList.contains("hidden");
    routingDom.tryItPanel.classList.toggle("hidden");

    if (isOpen) return;

    routingDom.codePanel.classList.add("hidden");
    routingDom.exportPanel.classList.add("hidden");
    routingDom.exportContent.classList.add("hidden");

    if (cap.endpointType !== "http") {
      routingDom.tryItOnlyHttp.classList.remove("hidden");
      routingDom.tryItForm.classList.add("hidden");
      routingDom.tryItResult.classList.add("hidden");
      return;
    }

    routingDom.tryItOnlyHttp.classList.add("hidden");
    routingDom.tryItForm.classList.remove("hidden");
    routingDom.tryItResult.classList.add("hidden");

    routingDom.tryItMethod.value = "POST";
    routingDom.tryItParams.value = JSON.stringify(
      { input: "your-value-here" },
      null,
      2,
    );
    routingDom.tryItHeaders.value = JSON.stringify(
      { "Content-Type": "application/json" },
      null,
      2,
    );
  }

  // --- Send Try-It Request ---
  async function sendTryIt() {
    const cap = getCurrentCap();
    if (!cap || cap.endpointType !== "http") return;

    const method = routingDom.tryItMethod.value;
    const endpoint = cap.endpoint;
    let params, headers;

    try {
      params = JSON.parse(routingDom.tryItParams.value || "{}");
    } catch (_) {
      params = {};
    }
    try {
      headers = JSON.parse(routingDom.tryItHeaders.value || "{}");
    } catch (_) {
      headers = { "Content-Type": "application/json" };
    }

    const startTime = performance.now();
    routingDom.tryItResult.classList.remove("hidden");
    routingDom.tryItResponse.textContent = "请求中…";

    async function tryDirect() {
      const options = { method, headers };
      if (method === "POST" || method === "PUT" || method === "PATCH") {
        options.body = JSON.stringify(params);
      }
      const response = await fetch(endpoint, options);
      const elapsed = (performance.now() - startTime).toFixed(0);
      let body;
      try {
        body = await response.json();
      } catch (_) {
        body = await response.text();
      }
      routingDom.tryItMeta.textContent = `${t("tryItStatus")}: ${response.status} | ${t("tryItTime")}: ${elapsed}ms`;
      routingDom.tryItResponse.textContent =
        typeof body === "object" ? JSON.stringify(body, null, 2) : String(body);
      if (cap.evidence) {
        cap.evidence.count++;
      }
      sendTelemetry(
        cap.id,
        response.ok,
        parseInt(elapsed),
        response.ok ? null : `HTTP ${response.status}`,
      );
    }

    async function tryViaProxy() {
      routingDom.tryItResponse.textContent = "通过代理请求中…";
      const proxyResp = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: endpoint,
          method: method,
          headers: headers,
          body: params,
        }),
      });

      if (!proxyResp.ok) {
        const errData = await proxyResp.json().catch(() => ({}));
        throw new Error(
          errData.message || errData.error || `代理返回 ${proxyResp.status}`,
        );
      }

      const proxyData = await proxyResp.json();
      const elapsed =
        proxyData.elapsed_ms || (performance.now() - startTime).toFixed(0);
      routingDom.tryItMeta.textContent = `${t("tryItStatus")}: ${proxyData.status} | ${t("tryItTime")}: ${elapsed}ms (代理)`;
      routingDom.tryItResponse.textContent =
        typeof proxyData.body === "object"
          ? JSON.stringify(proxyData.body, null, 2)
          : String(proxyData.body);
      if (cap.evidence) {
        cap.evidence.count++;
      }
      sendTelemetry(
        cap.id,
        proxyData.status >= 200 && proxyData.status < 300,
        parseInt(elapsed),
        null,
      );
    }

    try {
      await tryDirect();
    } catch (directErr) {
      if (
        directErr.name === "TypeError" &&
        (directErr.message.includes("Failed to fetch") ||
          directErr.message.includes("NetworkError"))
      ) {
        try {
          await tryViaProxy();
        } catch (proxyErr) {
          const elapsed = (performance.now() - startTime).toFixed(0);
          routingDom.tryItMeta.textContent = `${t("tryItError")} | ${t("tryItTime")}: ${elapsed}ms`;
          routingDom.tryItResponse.textContent =
            `${t("tryItError")}: ${directErr.message}\n` +
            `代理回退: ${proxyErr.message}\n\n` +
            `提示：目标 API 可能不可达或不在 CCP 能力锚点白名单中。`;
          sendTelemetry(cap.id, false, parseInt(elapsed), proxyErr.message);
        }
      } else {
        const elapsed = (performance.now() - startTime).toFixed(0);
        routingDom.tryItMeta.textContent = `${t("tryItError")} | ${t("tryItTime")}: ${elapsed}ms`;
        routingDom.tryItResponse.textContent = `${t("tryItError")}: ${directErr.message}`;
        sendTelemetry(cap.id, false, parseInt(elapsed), directErr.message);
      }
    }
  }

  // --- Toggle Export (Pattern 3: Agent Adapter) ---
  function toggleExport() {
    const cap = getCurrentCap();
    if (!cap) return;

    const isOpen = !routingDom.exportPanel.classList.contains("hidden");
    routingDom.exportPanel.classList.toggle("hidden");

    if (isOpen) return;

    routingDom.codePanel.classList.add("hidden");
    routingDom.tryItPanel.classList.add("hidden");
    routingDom.exportContent.classList.add("hidden");
    routingDom.dshInstallSection.classList.add("hidden");

    const radios = routingDom.exportPanel.querySelectorAll(
      'input[name="exportTarget"]',
    );
    radios.forEach((r) => (r.checked = false));
  }

  // --- Generate Export Adapter ---
  function generateExport() {
    const cap = getCurrentCap();
    if (!cap) return;

    const selected = routingDom.exportPanel.querySelector(
      'input[name="exportTarget"]:checked',
    );
    if (!selected) return;

    const target = selected.value;
    let code = "";
    let title = "";

    routingDom.dshInstallSection.classList.add("hidden");

    switch (target) {
      case "dsh":
        title = "DeepSeek-Harness (plugin.yaml)";
        code = generateDSHAdapter(cap);
        routingDom.dshInstallSection.classList.remove("hidden");
        routingDom.dshCliCommand.textContent = `dsh plugin add --config ./skillmesh-${cap.id}.plugin.yaml`;
        routingDom.dshUrlCommand.textContent = `dsh plugin add https://skillmesh.xn--rpr94o750a.xn--fiqs8s/api/ccp/${cap.id}/dsh.yaml`;
        break;
      case "mcp":
        title = "MCP 客户端 (mcp.json)";
        code = generateMCPAdapter(cap);
        break;
      case "langchain":
        title = "LangChain (Tool JSON)";
        code = generateLangChainAdapter(cap);
        break;
      case "crewai":
        title = "CrewAI (Tool Schema)";
        code = generateCrewAIAdapter(cap);
        break;
      case "dify":
        title = "Dify (工具配置)";
        code = generateDifyAdapter(cap);
        break;
    }

    routingDom.exportContentTitle.textContent = title;
    routingDom.exportCodeContent.textContent = code;
    routingDom.exportContent.classList.remove("hidden");
    currentExportCode = code;
  }

  // --- DSH Adapter Generator ---
  function generateDSHAdapter(cap) {
    const name = getLocalized(cap, "name");
    const nameEn = getLocalized(cap, "name_en");
    const desc = getLocalized(cap, "desc");
    const features = getLocalized(cap, "features") || [];
    const endpoint = cap.endpoint;
    const epType = cap.endpointType;
    const repo = cap.provenance || "";
    const category = cap.category;
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    const runtimeType =
      epType === "mcp" ? "mcp-server" : epType === "http" ? "http" : "function";

    const caps = features
      .map(
        (f, i) =>
          `  - name: ${f.toLowerCase().replace(/\s+/g, "-")}\n    description: "${f}"`,
      )
      .join("\n");

    const capabilitiesSection = caps ? `\ncapabilities:\n${caps}` : "";

    const riskScore = ((1 - cap.trustSource) * 5 + cap.trustRisk * 5).toFixed(
      1,
    );

    return `# ============================================================
# 由 SkillMesh / CCP 路由操作自动生成
# 源能力锚点：${cap.id}
# 生成时间：${now}
# CCP 协议版本：v1.0.0
# ============================================================

apiVersion: deepseek.io/plugin/v1
kind: Plugin
metadata:
  name: ${cap.id.replace(/_/g, "-")}
  version: 1.0.0
  description: "${name} — ${nameEn}"
  authors:
    - name: "CCP Community"
  license: MIT
  homepage: "https://skillmesh.礼字号.中国"
  repository: "${repo}"
  tags: [${cap.id.split("-").slice(0, -1).join(", ")}]
  categories: [${category}]
  maturity: stable
  minHarnessVersion: "0.8.0"

runtime:
  type: ${runtimeType}
  entrypoint:
    command: ["python", "-m", "${cap.id.replace(/-/g, "_").replace(/_\d+$/, "")}"]
  env:
    - name: ENDPOINT_URL
      description: "Service endpoint"
      required: true
      default: "${endpoint}"${capabilitiesSection}

permissions:
  services:
    inject: [fs]
    provide: [${cap.id.replace(/-/g, "-")}]
  sandbox:
    recommended: workspace-read
  riskScore: ${riskScore}

# CCP 信任向量（以注释形式保留，供 DSH 安全策略参考）
# trustSource: ${cap.trustSource.toFixed(2)}
# trustUsage: ${cap.trustUsage}
# trustSuccess: ${cap.trustSuccess.toFixed(2)}
# trustRisk: ${cap.trustRisk.toFixed(2)}
# trustTime: ${cap.trustTime.toFixed(2)}
# evidence: { count: ${cap.evidence ? cap.evidence.count : 0}, uncertainty: ${cap.evidence ? cap.evidence.uncertainty.toFixed(2) : 0.1} }`;
  }

  // --- MCP Adapter Generator ---
  function generateMCPAdapter(cap) {
    return JSON.stringify(
      {
        mcpServers: {
          [cap.id]: {
            type: cap.endpointType === "mcp" ? "stdio" : "http",
            url: cap.endpoint,
            description: getLocalized(cap, "desc"),
            trust: {
              source: cap.trustSource,
              success: cap.trustSuccess,
              evidence: cap.evidence ? cap.evidence.count : 0,
            },
          },
        },
      },
      null,
      2,
    );
  }

  // --- LangChain Adapter Generator ---
  function generateLangChainAdapter(cap) {
    return JSON.stringify(
      {
        type: "function",
        function: {
          name: cap.id.replace(/-/g, "_"),
          description: getLocalized(cap, "desc"),
          parameters: {
            type: "object",
            properties: {
              input: {
                type: "string",
                description: getLocalized(cap, "input"),
              },
            },
            required: ["input"],
          },
        },
        endpoint: cap.endpoint,
        endpointType: cap.endpointType,
        _ccp_trust: {
          source: cap.trustSource,
          success: cap.trustSuccess,
          evidence: cap.evidence ? cap.evidence.count : 0,
        },
      },
      null,
      2,
    );
  }

  // --- CrewAI Adapter Generator ---
  function generateCrewAIAdapter(cap) {
    return JSON.stringify(
      {
        name: cap.id.replace(/-/g, "_"),
        description: getLocalized(cap, "desc"),
        expected_output: getLocalized(cap, "output"),
        endpoint: cap.endpoint,
        endpoint_type: cap.endpointType,
        trust_metadata: {
          source_verified: cap.trustSource,
          success_rate: cap.trustSuccess,
          evidence_count: cap.evidence ? cap.evidence.count : 0,
        },
      },
      null,
      2,
    );
  }

  // --- Dify Adapter Generator ---
  function generateDifyAdapter(cap) {
    return [
      `# Dify 自定义工具配置`,
      `# 由 SkillMesh / CCP 路由操作自动生成`,
      `# 源能力锚点：${cap.id}`,
      ``,
      `name: ${cap.id}`,
      `description: ${getLocalized(cap, "desc")}`,
      `endpoint: ${cap.endpoint}`,
      `method: POST`,
      `headers:`,
      `  Content-Type: application/json`,
      `parameters:`,
      `  - name: input`,
      `    type: string`,
      `    description: ${getLocalized(cap, "input")}`,
      `    required: true`,
      `# CCP 信任参考`,
      `# trust_source: ${cap.trustSource.toFixed(2)}`,
      `# trust_success: ${cap.trustSuccess.toFixed(2)}`,
      `# evidence_count: ${cap.evidence ? cap.evidence.count : 0}`,
    ].join("\n");
  }

  // --- Copy Code ---
  function copyCode() {
    const code = routingDom.codeContent.textContent;
    if (!code || code === "暂无代码") return;

    navigator.clipboard.writeText(code).then(() => {
      const btn = document.querySelector(".routing-copy-btn");
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = "✓";
        setTimeout(() => {
          btn.innerHTML = orig;
        }, 1500);
      }
    });
  }

  // --- Copy All (Export) ---
  function copyAll() {
    const code = currentExportCode || routingDom.exportCodeContent.textContent;
    if (!code) return;

    navigator.clipboard.writeText(code).then(() => {
      const btn = document.querySelector(".export-copy-btn");
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = "✓ " + t("codeCopied");
        setTimeout(() => {
          btn.textContent = orig;
        }, 1500);
      }
    });
  }

  // --- Language ---
  function detectBrowserLang() {
    const lang = navigator.language || navigator.userLanguage || "";
    if (lang.toLowerCase().startsWith("zh")) return "zh";
    return "en";
  }

  function setLang(lang) {
    if (lang === currentLang) return;
    currentLang = lang;

    dom.btnZh.classList.toggle("active", lang === "zh");
    dom.btnEn.classList.toggle("active", lang === "en");
    dom.btnJa.classList.toggle("active", lang === "ja");

    dom.subtitle.textContent = t("subtitle");
    dom.searchInput.placeholder = t("searchPlaceholder");
    dom.searchHint.textContent = t("searchHint");

    // Federation panel
    dom.federatedToggleText.textContent = federated
      ? t("federationToggle") + " ✓"
      : t("federationToggle");
    dom.federationTitle.textContent = t("federation");
    dom.federationAddNodeTitle.textContent = t("federationAddNode");
    dom.federationNodesTitle.textContent = t("federationNodes");
    dom.fedNodeId.placeholder = t("federationNodeId");
    dom.fedNodeName.placeholder = t("federationNodeName");
    dom.fedNodeEndpoint.placeholder = t("federationNodeEndpoint");
    dom.fedNodeDesc.placeholder = t("federationNodeDesc");
    dom.fedNodeTrust.placeholder = t("federationNodeTrust");
    dom.fedAddBtn.textContent = t("federationAddBtn");
    dom.federationNoNodes.textContent = t("federationNoNodes");
    renderFederationNodes();

    updateAuthUI();
    renderCategoryChips();
    renderCards();
  }

  // --- Event Handlers ---
  function handleSearch() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      showLoading();
      if (semanticReady && dom.searchInput.value.trim()) {
        setTimeout(() => renderCardsAsync(), 100);
      } else {
        setTimeout(renderCards, 100);
      }
    }, 200);
  }

  function handleOverlayClick(e) {
    if (e.target === dom.modalOverlay) {
      closeModal();
    }
  }

  function getModalFocusables() {
    if (!currentModalId) return [];
    return Array.from(
      dom.modalOverlay.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      if (currentModalId) {
        closeModal();
      } else {
        dom.searchInput.blur();
      }
    }

    // Focus trap inside modal
    if (currentModalId && e.key === "Tab") {
      const focusables = getModalFocusables();
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      dom.searchInput.focus();
    }
  }

  // --- Init ---
  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/github/user");
      const data = await res.json();
      if (data.authenticated && data.user) {
        currentUser = data.user;
      } else {
        currentUser = null;
      }
    } catch (_) {
      currentUser = null;
    }
    updateAuthUI();
  }

  function updateAuthUI() {
    if (!dom.authArea || !dom.userArea) return;

    if (currentUser) {
      dom.authArea.style.display = "none";
      dom.userArea.style.display = "";
      const span = dom.userArea.querySelector("[data-i18n]");
      if (span) {
        span.textContent = t("loginAs").replace(
          "{name}",
          currentUser.github_login,
        );
      }
    } else {
      dom.authArea.style.display = "";
      dom.userArea.style.display = "none";
      const span = dom.authArea.querySelector("[data-i18n]");
      if (span) span.textContent = t("login");
    }
  }

  async function init() {
    currentLang = detectBrowserLang();
    dom.btnZh.classList.toggle("active", currentLang === "zh");
    dom.btnEn.classList.toggle("active", currentLang === "en");

    dom.subtitle.textContent = t("subtitle");
    dom.searchInput.placeholder = t("searchPlaceholder");
    dom.searchHint.textContent = t("searchHint");

    dom.searchInput.addEventListener("input", handleSearch);
    dom.modalOverlay.addEventListener("click", handleOverlayClick);
    document.addEventListener("keydown", handleKeydown);

    // Federation
    dom.federatedToggle.addEventListener("change", toggleFederation);
    dom.federatedToggleText.textContent = t("federationToggle");
    dom.federationToggleBtn.addEventListener("click", () => {
      dom.federationPanel.classList.toggle("expanded");
    });
    dom.fedAddBtn.addEventListener("click", addFederationNode);
    dom.federationPanel.classList.add("expanded");

    renderCategoryChips();
    showLoading();

    try {
      await loadCapabilities();
    } catch (_) {
      caps = [];
    }
    renderCards();

    initSemanticSearch();
    checkAuth();
    loadFederationNodes();
  }

  // --- Public API ---
  return {
    init,
    openModal,
    closeModal,
    setLang,
    setCategory,
    handleSearch,
    renderCards,
    checkAuth,

    // --- Routing Operations ---
    getCurrentCap,
    generateCode,
    switchCodeTab,
    toggleTryIt,
    sendTryIt,
    toggleExport,
    generateExport,
    copyCode,
    copyAll,
  };
})();

// Boot
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
