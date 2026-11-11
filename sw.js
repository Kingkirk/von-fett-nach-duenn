/* App-Shell. Bilder liegen in einem eigenen Cache und werden erst beim Abruf gespeichert.
   Fremde Adressen, auch Open Food Facts, werden nicht angefasst. */
var CACHE = "vfnd-static-v8";
var IMAGE_CACHE = "vfnd-img-v1";
var THUMBS = [
  "./img/rezepte/rezept-apfel-mit-mandeln-400.webp",
  "./img/rezepte/rezept-brot-frischkaese-gurke-400.webp",
  "./img/rezepte/rezept-brot-putenbrust-senf-400.webp",
  "./img/rezepte/rezept-bunter-salat-feta-400.webp",
  "./img/rezepte/rezept-gemuesesticks-quarkdip-400.webp",
  "./img/rezepte/rezept-haehnchen-reis-brokkoli-400.webp",
  "./img/rezepte/rezept-haferbrei-mit-apfel-400.webp",
  "./img/rezepte/rezept-huehner-gemuese-suppe-400.webp",
  "./img/rezepte/rezept-joghurt-banane-hafer-400.webp",
  "./img/rezepte/rezept-kartoffel-lauch-suppe-400.webp",
  "./img/rezepte/rezept-kartoffeln-spinat-ei-400.webp",
  "./img/rezepte/rezept-knaeckebrot-huettenkaese-400.webp",
  "./img/rezepte/rezept-kuerbissuppe-400.webp",
  "./img/rezepte/rezept-nudeln-tomatensauce-zucchini-400.webp",
  "./img/rezepte/rezept-ofenapfel-zimt-400.webp",
  "./img/rezepte/rezept-ofenkartoffeln-kraeuterquark-400.webp",
  "./img/rezepte/rezept-omelett-pilze-paprika-400.webp",
  "./img/rezepte/rezept-quark-mit-beeren-400.webp",
  "./img/rezepte/rezept-rote-linsen-suppe-400.webp",
  "./img/rezepte/rezept-ruehrei-mit-tomate-400.webp",
  "./img/rezepte/rezept-seelachs-gemuese-kartoffeln-400.webp",
  "./img/rezepte/rezept-thunfisch-kichererbsen-salat-400.webp",
  "./img/rezepte/rezept-tomate-mozzarella-brot-400.webp",
  "./img/rezepte/rezept-tomatensuppe-400.webp",
  "./img/training/uebung-auf-einem-bein-stehen-400.webp",
  "./img/training/uebung-aufstehen-vom-stuhl-400.webp",
  "./img/training/uebung-bein-seitlich-heben-400.webp",
  "./img/training/uebung-beine-strecken-im-sitzen-400.webp",
  "./img/training/uebung-ferse-zum-po-400.webp",
  "./img/training/uebung-fersen-und-zehen-heben-400.webp",
  "./img/training/uebung-fuesse-voreinander-400.webp",
  "./img/training/uebung-gehen-an-der-arbeitsplatte-400.webp",
  "./img/training/uebung-liegestuetz-an-der-wand-400.webp",
  "./img/training/uebung-marschieren-im-sitzen-400.webp",
  "./img/training/uebung-schultern-kreisen-400.webp",
  "./img/training/uebung-spaziergang-400.webp",
  "./img/training/uebung-waden-dehnen-400.webp",
  "./img/training/uebung-zehenstand-mit-halt-400.webp"
];

var ASSETS = [
  "./",
  "./index.html",
  "./tokens.css",
  "./styles.css",
  "./logic.js",
  "./shop.js",
  "./off.js",
  "./app.js",
  "./vendor/zxing-browser.min.js",
  "./data/recipes.json",
  "./data/prices.json",
  "./data/training.json",
  "./data/ui-texts.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./lizenzen.md"
];

function isContentImage(url) {
  return /\/img\/(?:rezepte|training)\/[^/]+\.webp$/i.test(url.pathname);
}

self.addEventListener("install", function (event) {
  event.waitUntil(Promise.all([
    caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); }),
    caches.open(IMAGE_CACHE).then(function (cache) { return cache.addAll(THUMBS); })
  ]).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key !== CACHE && key !== IMAGE_CACHE;
    }).map(function (key) {
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
  if (isContentImage(url)) {
    event.respondWith(caches.open(IMAGE_CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (fresh) {
          if (fresh && fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        });
      });
    }));
    return;
  }
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
