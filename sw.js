/* App-Shell. Fremde Adressen, auch Open Food Facts, werden nicht angefasst. */
var CACHE = "vfnd-static-v3";
var ASSETS = [
  "./",
  "./index.html",
  "./tokens.css",
  "./styles.css",
  "./logic.js",
  "./off.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(ASSETS);
  }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
      return caches.delete(key);
    }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(function (cache) {
    return fetch(req).then(function (fresh) {
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    }).catch(function () {
      return cache.match(req).then(function (cached) {
        if (cached) return cached;
        if (req.mode === "navigate") {
          return cache.match("./index.html").then(function (shell) {
            return shell || cache.match("./");
          });
        }
        return Response.error();
      });
    });
  }));
});
