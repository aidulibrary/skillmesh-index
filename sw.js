var CACHE_NAME = "ccp-v7";
// 2026-09-13 主题全屏一致性修复：bump 缓存版本，令新 SW 安装时清除旧 ccp-v4 缓存
var PRECACHE = [
  "/",
  "/index.html",
  "/health.html",
  "/css/tokens.css?v=20260913c",
  "/css/style.css?v=20260913c",
  "/dark-mode.css?v=20260913c",
  "/dark-mode.js?v=20260913c",
  "/js/i18n.js?v=20260913c",
  "/js/data.js?v=20260913c",
  "/js/app.js?v=20260913c",
];
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) {
      return c.addAll(PRECACHE);
    }),
  );
  self.skipWaiting();
});
// 结构资源（HTML/CSS/JS）：network-first，避免旧缓存把主题修复挡在门外（根因 E）
function isCodeAsset(url) {
  return (
    /\.(?:css|js)$/.test(url.pathname) ||
    /\.html?$/.test(url.pathname) ||
    url.pathname === "/"
  );
}
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (isCodeAsset(url)) {
    e.respondWith(
      fetch(e.request)
        .then(function (r) {
          if (r && r.status === 200) {
            var clone = r.clone();
            caches.open(CACHE_NAME).then(function (c) {
              c.put(e.request, clone);
            });
          }
          return r;
        })
        .catch(function () {
          return caches.match(e.request).then(function (cached) {
            return cached || caches.match("/index.html");
          });
        }),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var p = fetch(e.request)
        .then(function (r) {
          if (r && r.status === 200) {
            var clone = r.clone();
            caches.open(CACHE_NAME).then(function (c) {
              c.put(e.request, clone);
            });
          }
          return r;
        })
        .catch(function () {
          return cached;
        });
      return cached || p;
    }),
  );
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (k) {
        return Promise.all(
          k
            .filter(function (x) {
              return x !== CACHE_NAME;
            })
            .map(function (x) {
              return caches.delete(x);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});
