var CACHE_NAME = "ccp-v4";
// 2026-09-12 S11 第二轮缺陷修复：bump 缓存版本，令新 SW 安装时清除旧 ccp-v3 缓存
var URLS_TO_CACHE = ["/", "/index.html", "/health.html", "/css/tokens.css?v=20260912b", "/css/style.css?v=20260912b", "/dark-mode.css?v=20260912b", "/dark-mode.js?v=20260912b", "/js/i18n.js?v=20260912b", "/js/data.js?v=20260912b", "/js/app.js?v=20260912b"];
self.addEventListener("install", function(e) { e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(URLS_TO_CACHE); })); });
self.addEventListener("fetch", function(e) {
    if (e.request.method !== "GET") return;
    e.respondWith(caches.match(e.request).then(function(cached) {
        var p = fetch(e.request).then(function(r) { if (r && r.status === 200) { var clone = r.clone(); caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); }); } return r; }).catch(function() { return cached; });
        return cached || p;
    }));
});
self.addEventListener("activate", function(e) { e.waitUntil(caches.keys().then(function(k) { return Promise.all(k.filter(function(x) { return x !== CACHE_NAME; }).map(function(x) { return caches.delete(x); })); })); });
