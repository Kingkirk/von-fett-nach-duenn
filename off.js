/* Explizite Open-Food-Facts-Abfragen. Keine Gesundheitsdaten, kein Tracking.
   Namenssuche: /cgi/search.pl mit search_terms. /api/v2/search?q= ignoriert den
   Suchbegriff und liefert einen ungefilterten Katalog. search.openfoodfacts.org
   filtert, sendet aber kein Access-Control-Allow-Origin und ist im Browser nicht lesbar.
   Strichcode bleibt /api/v2/product/{code}. */
(function (root) {
  var WORLD = "https://world.openfoodfacts.org";
  var FIELDS = "code,product_name,product_name_de,brands,nutriments,serving_quantity,serving_size,nutriscore_grade,image_front_small_url";

  function asNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      var n = Number(value.replace(",", "."));
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function nutrient(nutriments, key) {
    if (!nutriments || typeof nutriments !== "object") return null;
    if (!Object.prototype.hasOwnProperty.call(nutriments, key)) return null;
    var n = asNumber(nutriments[key]);
    if (n == null || n < 0 || n > 10000) return null;
    return n;
  }

  function brandText(value) {
    if (Array.isArray(value)) return value.map(function (v) { return String(v); }).join(", ").slice(0, 80);
    if (typeof value === "string") return value.trim().slice(0, 80);
    return "";
  }

  function nutriscore(value) {
    var g = String(value || "").trim().toLowerCase();
    return /^[a-e]$/.test(g) ? g : null;
  }

  function servingGrams(product) {
    var size = String(product.serving_size || "");
    if (/ml/i.test(size) && !/\d+(?:[.,]\d+)?\s*g/i.test(size)) return null;
    var q = asNumber(product.serving_quantity);
    if (q != null && q > 0 && q <= 2000) return q;
    var m = size.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
    if (!m) return null;
    var n = asNumber(m[1]);
    if (n != null && n > 0 && n <= 2000) return n;
    return null;
  }

  function per100From(product) {
    var n = product.nutriments || {};
    var grams = servingGrams(product);
    function pick(key100, keyServing) {
      var direct = nutrient(n, key100);
      if (direct != null) return direct;
      var serving = nutrient(n, keyServing);
      if (serving == null || grams == null || grams <= 0) return null;
      return (serving * 100) / grams;
    }
    return {
      kcal: pick("energy-kcal_100g", "energy-kcal_serving"),
      protein: pick("proteins_100g", "proteins_serving"),
      carbs: pick("carbohydrates_100g", "carbohydrates_serving"),
      fat: pick("fat_100g", "fat_serving")
    };
  }

  function sanitizeImageUrl(raw, searchTerm) {
    if (typeof raw !== "string" || !raw) return null;
    var url;
    try {
      url = new URL(raw);
    } catch (e) {
      return null;
    }
    if (url.protocol !== "https:") return null;
    if (!/(^|\.)openfoodfacts\.org$/i.test(url.hostname)) return null;
    url.search = "";
    url.hash = "";
    var needle = String(searchTerm || "").trim().toLowerCase();
    if (needle.length >= 3) {
      var hit = url.pathname.toLowerCase().split("/").some(function (seg) {
        return seg.indexOf(needle) !== -1;
      });
      if (hit) return null;
    }
    return url.href;
  }

  function parseProduct(raw, searchTerm) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var name = String(raw.product_name_de || raw.product_name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!name) return null;
    var code = String(raw.code || "");
    return {
      code: /^\d{8,14}$/.test(code) ? code : null,
      name: name,
      brand: brandText(raw.brands),
      per100: per100From(raw),
      servingGrams: servingGrams(raw),
      nutriscore: nutriscore(raw.nutriscore_grade),
      imageUrl: sanitizeImageUrl(raw.image_front_small_url, searchTerm)
    };
  }

  function parseCollection(data, searchTerm) {
    var list = [];
    if (data && Array.isArray(data.products)) list = data.products;
    else if (data && Array.isArray(data.hits)) list = data.hits;
    else return [];
    var out = [];
    list.forEach(function (item) {
      var parsed = parseProduct(item, searchTerm);
      if (parsed && out.length < 5) out.push(parsed);
    });
    return out;
  }

  function hostOk(responseUrl, allowedHost) {
    try {
      return new URL(responseUrl).hostname === allowedHost;
    } catch (e) {
      return false;
    }
  }

  function fetchJson(url, allowedHost, signal) {
    return fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      referrerPolicy: "no-referrer",
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
      signal: signal
    }).then(function (res) {
      if (!hostOk(res.url, allowedHost)) {
        var err = new Error("host");
        err.code = "host";
        throw err;
      }
      if (res.status === 429) {
        var rate = new Error("rate");
        rate.code = "rate";
        throw rate;
      }
      if (!res.ok) {
        var http = new Error("http");
        http.code = "http";
        http.status = res.status;
        throw http;
      }
      return res.json().catch(function () {
        var bad = new Error("json");
        bad.code = "json";
        throw bad;
      });
    });
  }

  function withTimeout(ms) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(ms);
    }
    var ctrl = new AbortController();
    setTimeout(function () { ctrl.abort(); }, ms);
    return ctrl.signal;
  }

  function searchFoods(query) {
    var url = new URL("/cgi/search.pl", WORLD);
    url.searchParams.set("search_terms", query);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "5");
    url.searchParams.set("fields", FIELDS);
    return fetchJson(url.href, "world.openfoodfacts.org", withTimeout(12000)).then(function (data) {
      return { source: "cgi", products: parseCollection(data, query) };
    });
  }

  function fetchBarcode(code) {
    var url = new URL("/api/v2/product/" + code, WORLD);
    url.searchParams.set("fields", FIELDS);
    return fetchJson(url.href, "world.openfoodfacts.org", withTimeout(12000)).then(function (data) {
      if (!data || data.status !== 1 || !data.product) return { found: false, product: null };
      var product = parseProduct(data.product, "");
      if (!product) return { found: false, product: null };
      product.code = code;
      return { found: true, product: product };
    });
  }

  function messageFor(err) {
    if (err && err.name === "AbortError") return "Die Abfrage hat zu lange gedauert. Du kannst Name und Nährwerte von Hand eintragen.";
    if (err && err.code === "rate") return "Open Food Facts begrenzt gerade Anfragen. Bitte kurz warten oder von Hand eintragen.";
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "Keine Verbindung. Du kannst Name und Nährwerte von Hand eintragen.";
    }
    return "Die Abfrage ist fehlgeschlagen. Du kannst Name und Nährwerte von Hand eintragen.";
  }

  root.OFF = {
    searchFoods: searchFoods,
    fetchBarcode: fetchBarcode,
    parseProduct: parseProduct,
    parseCollection: parseCollection,
    sanitizeImageUrl: sanitizeImageUrl,
    messageFor: messageFor
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
