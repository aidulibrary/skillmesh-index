var CACHE_NAME = "ccp-v1";
var URLS_TO_CACHE = ["/", "/index.html", "/health.html", "/health.js", "/health.css", "/api/ccp/v1/capabilities"];
self.addEventListener("install", function(e) { e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(URLS_TO_CACHE); })); });
self.addEventListener("fetch", function(e) {
    if (e.request.method !== "GET") return;
    e.respondWith(caches.match(e.request).then(function(cached) {
        var p = fetch(e.request).then(function(r) { if (r && r.status === 200) { var clone = r.clone(); caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); }); } return r; }).catch(function() { return cached; });
        return cached || p;
    }));
});
self.addEventListener("activate", function(e) { e.waitUntil(caches.keys().then(function(k) { return Promise.all(k.filter(function(x) { return x !== CACHE_NAME; }).map(function(x) { return caches.delete(x); })); })); });
