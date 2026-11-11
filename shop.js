/* Mengen, Portionen und Schätzpreise. Keine Netzwerkpreise. */
(function (root) {
  var MASS = { g: 1, kg: 1000 };
  var VOL = { ml: 1, l: 1000 };
  var COUNT = { stueck: 1 };

  function canon(unit) {
    var s = String(unit || "").trim().toLowerCase().replace(/\./g, "");
    var aliases = {
      g: "g", gramm: "g", gr: "g",
      kg: "kg", kilogramm: "kg",
      ml: "ml", milliliter: "ml",
      l: "l", liter: "l", lt: "l",
      stück: "stueck", stueck: "stueck", stk: "stueck", st: "stueck", stuecke: "stueck", stückchen: "stueck"
    };
    var key = aliases[s];
    if (!key) return null;
    if (MASS[key]) return { dim: "mass", unit: key, factor: MASS[key], base: "g" };
    if (VOL[key]) return { dim: "vol", unit: key, factor: VOL[key], base: "ml" };
    return { dim: "count", unit: key, factor: 1, base: "Stück" };
  }

  function toBase(amount, unit) {
    var n = Number(amount);
    if (!Number.isFinite(n)) return { ok: false, amount: 0, unit: String(unit || ""), dim: "invalid" };
    var parsed = canon(unit);
    if (!parsed) {
      var raw = String(unit || "").trim() || "?";
      return { ok: false, amount: n, unit: raw, dim: "raw:" + raw.toLowerCase(), base: raw };
    }
    return { ok: true, amount: n * parsed.factor, unit: parsed.base, dim: parsed.dim, base: parsed.base };
  }

  function displayAmount(baseAmount, baseUnit) {
    var amount = baseAmount;
    var unit = baseUnit;
    if (baseUnit === "g" && baseAmount >= 1000) {
      amount = baseAmount / 1000;
      unit = "kg";
    } else if (baseUnit === "ml" && baseAmount >= 1000) {
      amount = baseAmount / 1000;
      unit = "l";
    }
    return { amount: Math.round(amount * 1000) / 1000, unit: unit };
  }

  function scaleIngredients(ingredients, basePortions, wantedPortions) {
    var base = Number(basePortions);
    var wanted = Number(wantedPortions);
    if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(wanted) || wanted <= 0) return [];
    var factor = wanted / base;
    return (ingredients || []).map(function (item) {
      return {
        name: String(item.name || "").trim(),
        amount: Number(item.amount) * factor,
        unit: item.unit
      };
    }).filter(function (item) { return item.name && Number.isFinite(item.amount); });
  }

  function mergeLines(lines) {
    var groups = {};
    var order = [];
    (lines || []).forEach(function (line) {
      var name = String(line.name || "").trim();
      if (!name) return;
      var base = toBase(line.amount, line.unit);
      var key = name.toLowerCase() + "|" + base.dim;
      if (!groups[key]) {
        groups[key] = { name: name, amount: 0, unit: base.base, dim: base.dim, ok: base.ok };
        order.push(key);
      }
      groups[key].amount += base.amount;
    });
    return order.map(function (key) {
      var group = groups[key];
      var shown = group.ok ? displayAmount(group.amount, group.unit) : { amount: Math.round(group.amount * 1000) / 1000, unit: group.unit };
      return {
        key: key,
        name: group.name,
        amount: shown.amount,
        unit: shown.unit,
        baseAmount: group.amount,
        baseUnit: group.unit
      };
    });
  }

  function estimateLine(line, prices, overrideEur) {
    if (overrideEur != null && Number.isFinite(Number(overrideEur))) {
      return { eur: Math.round(Number(overrideEur) * 100) / 100, source: "eigen" };
    }
    var list = Array.isArray(prices) ? prices : [];
    var hit = null;
    list.forEach(function (price) {
      if (hit) return;
      if (String(price.name || "").trim().toLowerCase() === line.name.toLowerCase()) hit = price;
    });
    if (!hit || !Number.isFinite(Number(hit.eur))) return null;
    var pack = toBase(hit.amount, hit.unit);
    var need = toBase(line.baseAmount, line.baseUnit);
    if (!pack.ok || !need.ok || pack.dim !== need.dim || pack.amount <= 0) return null;
    return { eur: Math.round((Number(hit.eur) * (need.amount / pack.amount)) * 100) / 100, source: "schaetzung" };
  }

  function applyOverrides(lines, overrides) {
    return (lines || []).map(function (line) {
      var copy = {};
      Object.keys(line).forEach(function (key) { copy[key] = line[key]; });
      var value = overrides && overrides[line.key];
      if (value != null && Number.isFinite(Number(value))) {
        copy.estimate = { eur: Math.round(Number(value) * 100) / 100, source: "eigen" };
        copy.ownPrice = true;
      } else {
        copy.ownPrice = false;
      }
      return copy;
    });
  }

  function sumEstimates(rows) {
    var sum = 0;
    var any = false;
    (rows || []).forEach(function (row) {
      if (!row || !row.estimate || !Number.isFinite(row.estimate.eur)) return;
      any = true;
      sum += row.estimate.eur;
    });
    return any ? Math.round(sum * 100) / 100 : null;
  }

  function classifyScan(text) {
    var raw = String(text || "").trim();
    if (!raw) return { kind: "empty", text: "" };
    if (/^\d{8}$/.test(raw) || /^\d{12}$/.test(raw) || /^\d{13}$/.test(raw) || /^\d{14}$/.test(raw)) {
      return { kind: "ean", code: raw };
    }
    if (/^https?:\/\//i.test(raw)) return { kind: "url", text: raw };
    var digits = raw.replace(/\s/g, "");
    if (/^\d{8,14}$/.test(digits)) return { kind: "ean", code: digits };
    return { kind: "text", text: raw };
  }

  function planShopping(picks, recipes, prices, manual) {
    var priceById = {};
    (prices || []).forEach(function (item) { priceById[item.ingredientId] = item; });
    var recipeById = {};
    (recipes || []).forEach(function (item) { recipeById[item.id] = item; });
    var groups = {};
    var order = [];
    function addIngredient(id, name, amount, unit, recipeTitle) {
      var price = id && priceById[id];
      var base = null;
      if (price) {
        if (unit === price.baseUnit) base = amount;
        else if (price.unitToBase && price.unitToBase[unit] != null) base = amount * Number(price.unitToBase[unit]);
      }
      var key = (price ? "id|" + id : "raw|" + String(name).toLowerCase()) + "|" + String(unit || "").toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          name: (price && price.name) || name,
          amount: 0,
          unit: unit,
          base: 0,
          price: base == null ? null : price,
          category: price && price.category ? price.category : "",
          titles: {}
        };
        order.push(key);
      }
      groups[key].amount += amount;
      if (base != null) groups[key].base += base;
      if (recipeTitle) groups[key].titles[recipeTitle] = true;
    }
    (picks || []).forEach(function (pick) {
      var recipe = recipeById[pick.recipeId];
      if (!recipe) return;
      var factor = Number(pick.portions) / (Number(recipe.servings) || 1);
      (recipe.ingredients || []).forEach(function (item) {
        addIngredient(item.ingredientId, item.name, Number(item.amount) * factor, item.unit, recipe.title);
      });
    });
    (manual || []).forEach(function (item) {
      addIngredient(item.ingredientId, item.name, Number(item.amount), item.unit);
    });
    return order.map(function (key) {
      var group = groups[key];
      var packages = null;
      var eur = null;
      if (group.price && group.base > 0 && group.price.packageBaseAmount > 0) {
        packages = Math.ceil(group.base / group.price.packageBaseAmount - 1e-9);
        eur = Math.round(packages * Number(group.price.estimatedPriceEur) * 100) / 100;
      }
      return {
        key: key,
        name: group.name,
        amount: Math.round(group.amount * 1000) / 1000,
        unit: group.unit,
        packages: packages,
        packageSize: group.price ? group.price.packageSize : null,
        packageUnit: group.price ? group.price.packageUnit : null,
        estimate: eur == null ? null : { eur: eur, source: "schaetzung" },
        category: group.category || "",
        titles: Object.keys(group.titles || {})
      };
    });
  }

  root.VFNDShop = {
    canon: canon,
    toBase: toBase,
    scaleIngredients: scaleIngredients,
    mergeLines: mergeLines,
    estimateLine: estimateLine,
    sumEstimates: sumEstimates,
    applyOverrides: applyOverrides,
    classifyScan: classifyScan,
    planShopping: planShopping
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
