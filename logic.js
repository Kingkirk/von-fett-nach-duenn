/* Lokale Datenlogik. Kein Netzwerk. */
(function (root) {
  var KEY = "von-fett-nach-duenn.v1";
  var SLOTS = [
    { id: "fruehstueck", label: "Frühstück" },
    { id: "mittag", label: "Mittag" },
    { id: "abend", label: "Abend" },
    { id: "snacks", label: "Snacks" }
  ];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function localDateKey(date) {
    var d = date instanceof Date ? date : new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function dateFromKey(key) {
    var p = String(key || "").split("-");
    var y = Number(p[0]);
    var m = Number(p[1]);
    var d = Number(p[2]);
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d);
  }

  function addDays(key, delta) {
    var d = dateFromKey(key);
    d.setDate(d.getDate() + delta);
    return localDateKey(d);
  }

  function isDateKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ""))) return false;
    var d = dateFromKey(key);
    return !Number.isNaN(d.getTime()) && localDateKey(d) === key;
  }

  function parseGermanNumber(input) {
    var s = String(input == null ? "" : input).trim().replace(/\s/g, "");
    if (!s) return { ok: false, error: "leer" };
    if (/[a-zA-Z]/.test(s)) return { ok: false, error: "zeichen" };
    var n;
    if (s.indexOf(",") !== -1) {
      if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) && !/^-?\d+(,\d+)?$/.test(s)) {
        return { ok: false, error: "format" };
      }
      n = Number(s.replace(/\./g, "").replace(",", "."));
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
      n = Number(s.replace(/\./g, ""));
    } else if (/^-?\d+(\.\d+)?$/.test(s)) {
      n = Number(s);
    } else {
      return { ok: false, error: "format" };
    }
    if (!Number.isFinite(n)) return { ok: false, error: "format" };
    return { ok: true, value: n };
  }

  function formatInt(n) {
    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n));
  }

  function formatKg(n) {
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
  }

  function formatMacro(n) {
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(n);
  }

  function formatSignedKg(n) {
    var body = formatKg(Math.abs(n)) + " kg";
    if (n < -0.049) return "−" + body;
    if (n > 0.049) return "+" + body;
    return body;
  }

  function emptyDay() {
    return {
      meals: { fruehstueck: [], mittag: [], abend: [], snacks: [] },
      water: 0,
      movement: null
    };
  }

  function defaultState() {
    return {
      version: 1,
      settings: {
        theme: "system",
        senior: false,
        onboarded: false,
        displayName: "",
        calorieGoal: null,
        proteinGoal: null,
        carbsGoal: null,
        fatGoal: null,
        waterGoal: 8,
        startWeight: null,
        goalWeight: null
      },
      days: {},
      weights: [],
      favorites: [],
      recent: []
    };
  }

  function cleanText(value, max) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function numOrNull(value, min, max) {
    if (value == null || value === "") return null;
    var n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return n;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function sanitizeMeal(raw) {
    if (!raw || typeof raw !== "object") return null;
    var name = cleanText(raw.name, 80);
    var kcal = numOrNull(raw.kcal, 0, 20000);
    if (!name || kcal == null || Math.round(kcal) !== kcal) return null;
    return {
      id: cleanText(raw.id, 80) || uid(),
      name: name,
      kcal: kcal,
      protein: numOrNull(raw.protein, 0, 1000) == null ? null : round1(numOrNull(raw.protein, 0, 1000)),
      carbs: numOrNull(raw.carbs, 0, 1000) == null ? null : round1(numOrNull(raw.carbs, 0, 1000)),
      fat: numOrNull(raw.fat, 0, 1000) == null ? null : round1(numOrNull(raw.fat, 0, 1000)),
      grams: numOrNull(raw.grams, 0, 5000) == null ? null : round1(numOrNull(raw.grams, 0, 5000)),
      source: raw.source === "off" ? "off" : "manual",
      offCode: /^\d{8,14}$/.test(String(raw.offCode || "")) ? String(raw.offCode) : null
    };
  }

  function sanitizeMovement(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.kind === "steps") {
      var steps = numOrNull(raw.steps, 0, 200000);
      if (steps == null || Math.round(steps) !== steps) return null;
      return { kind: "steps", steps: steps };
    }
    if (raw.kind === "note") {
      var note = cleanText(raw.note, 80);
      if (!note) return null;
      return { kind: "note", note: note };
    }
    return null;
  }

  function sanitizePer100(raw) {
    if (!raw || typeof raw !== "object") return null;
    function field(v) {
      if (v == null || v === "") return null;
      var n = numOrNull(v, 0, 10000);
      return n == null ? null : n;
    }
    return {
      kcal: field(raw.kcal),
      protein: field(raw.protein),
      carbs: field(raw.carbs),
      fat: field(raw.fat)
    };
  }

  function sanitizeFoodSnap(raw) {
    if (!raw || typeof raw !== "object") return null;
    var name = cleanText(raw.name, 80);
    if (!name) return null;
    var grade = String(raw.nutriscore || "").toLowerCase();
    return {
      code: /^\d{8,14}$/.test(String(raw.code || "")) ? String(raw.code) : null,
      name: name,
      brand: cleanText(raw.brand, 80),
      per100: sanitizePer100(raw.per100),
      servingGrams: numOrNull(raw.servingGrams, 1, 2000),
      nutriscore: /^[a-e]$/.test(grade) ? grade : null
    };
  }

  function uid() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") return root.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function sanitizeState(raw) {
    var base = defaultState();
    var dropped = false;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { state: base, corrupted: true, sanitized: false };
    }
    if (raw.version != null && raw.version !== 1) {
      return { state: base, corrupted: true, sanitized: false };
    }
    var s = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    if (s.theme === "light" || s.theme === "dark" || s.theme === "system") base.settings.theme = s.theme;
    else if (s.theme != null) dropped = true;
    base.settings.senior = s.senior === true;
    base.settings.onboarded = s.onboarded === true;
    base.settings.displayName = cleanText(s.displayName, 40);
    base.settings.calorieGoal = numOrNull(s.calorieGoal, 1, 20000);
    if (s.calorieGoal != null && s.calorieGoal !== "" && base.settings.calorieGoal == null) dropped = true;
    if (base.settings.calorieGoal != null) base.settings.calorieGoal = Math.round(base.settings.calorieGoal);
    base.settings.proteinGoal = numOrNull(s.proteinGoal, 0, 1000);
    base.settings.carbsGoal = numOrNull(s.carbsGoal, 0, 1000);
    base.settings.fatGoal = numOrNull(s.fatGoal, 0, 1000);
    var waterGoal = numOrNull(s.waterGoal, 1, 30);
    base.settings.waterGoal = waterGoal == null ? 8 : Math.round(waterGoal);
    base.settings.startWeight = numOrNull(s.startWeight, 2, 500);
    base.settings.goalWeight = numOrNull(s.goalWeight, 2, 500);
    if (base.settings.startWeight != null) base.settings.startWeight = round1(base.settings.startWeight);
    if (base.settings.goalWeight != null) base.settings.goalWeight = round1(base.settings.goalWeight);

    var days = raw.days && typeof raw.days === "object" ? raw.days : {};
    Object.keys(days).forEach(function (key) {
      if (!isDateKey(key)) {
        dropped = true;
        return;
      }
      var src = days[key] || {};
      var day = emptyDay();
      var meals = src.meals && typeof src.meals === "object" ? src.meals : {};
      SLOTS.forEach(function (slot) {
        var list = Array.isArray(meals[slot.id]) ? meals[slot.id] : [];
        list.forEach(function (item) {
          var meal = sanitizeMeal(item);
          if (meal) day.meals[slot.id].push(meal);
          else dropped = true;
        });
      });
      var water = numOrNull(src.water, 0, 50);
      day.water = water == null ? 0 : Math.round(water);
      day.movement = sanitizeMovement(src.movement);
      if (src.movement && !day.movement) dropped = true;
      base.days[key] = day;
    });

    var weights = Array.isArray(raw.weights) ? raw.weights : [];
    var seen = {};
    weights.forEach(function (w) {
      if (!w || !isDateKey(w.date)) {
        dropped = true;
        return;
      }
      var kg = numOrNull(w.kg, 2, 500);
      if (kg == null) {
        dropped = true;
        return;
      }
      seen[w.date] = round1(kg);
    });
    base.weights = Object.keys(seen)
      .sort()
      .map(function (date) { return { date: date, kg: seen[date] }; });

    ["favorites", "recent"].forEach(function (bucket) {
      var list = Array.isArray(raw[bucket]) ? raw[bucket] : [];
      list.forEach(function (item) {
        var snap = sanitizeFoodSnap(item);
        if (snap) base[bucket].push(snap);
        else if (item) dropped = true;
      });
    });
    base.favorites = base.favorites.slice(0, 30);
    base.recent = base.recent.slice(0, 8);
    return { state: base, corrupted: false, sanitized: dropped };
  }

  function loadState(storage) {
    try {
      var raw = storage.getItem(KEY);
      if (raw == null) return { ok: true, state: defaultState(), corrupted: false, empty: true, storageError: false };
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return { ok: true, state: defaultState(), corrupted: true, empty: false, storageError: false };
      }
      var clean = sanitizeState(parsed);
      return {
        ok: true,
        state: clean.state,
        corrupted: clean.corrupted,
        sanitized: clean.sanitized,
        empty: false,
        storageError: false
      };
    } catch (e) {
      return { ok: false, state: defaultState(), corrupted: false, empty: false, storageError: true };
    }
  }

  function saveState(storage, state) {
    try {
      storage.setItem(KEY, JSON.stringify(state));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "write" };
    }
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function ensure(state, date) {
    if (!state.days[date]) state.days[date] = emptyDay();
    return state.days[date];
  }

  function addMeal(state, date, slot, meal) {
    if (!isDateKey(date) || !SLOTS.some(function (s) { return s.id === slot; })) {
      return { ok: false, error: "datum", state: state };
    }
    var clean = sanitizeMeal(meal);
    if (!clean) return { ok: false, error: "mahlzeit", state: state };
    var next = clone(state);
    ensure(next, date).meals[slot].push(clean);
    return { ok: true, state: next, meal: clean };
  }

  function removeMeal(state, date, id) {
    var next = clone(state);
    var day = next.days[date];
    if (!day) return { ok: false, state: state };
    var removed = false;
    SLOTS.forEach(function (slot) {
      var before = day.meals[slot.id].length;
      day.meals[slot.id] = day.meals[slot.id].filter(function (m) { return m.id !== id; });
      if (day.meals[slot.id].length !== before) removed = true;
    });
    return { ok: removed, state: removed ? next : state };
  }

  function setWater(state, date, count) {
    if (!isDateKey(date)) return { ok: false, state: state };
    var goal = state.settings.waterGoal || 8;
    var n = Math.round(Number(count));
    if (!Number.isFinite(n)) return { ok: false, state: state };
    n = Math.max(0, Math.min(goal, n));
    var next = clone(state);
    ensure(next, date).water = n;
    return { ok: true, state: next, water: n };
  }

  function upsertWeight(state, date, kg) {
    if (!isDateKey(date)) return { ok: false, error: "datum", state: state };
    var n = numOrNull(kg, 2, 500);
    if (n == null) return { ok: false, error: "gewicht", state: state };
    var next = clone(state);
    var value = round1(n);
    var found = false;
    next.weights = next.weights.map(function (w) {
      if (w.date === date) {
        found = true;
        return { date: date, kg: value };
      }
      return w;
    });
    if (!found) next.weights.push({ date: date, kg: value });
    next.weights.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return { ok: true, state: next };
  }

  function removeWeight(state, date) {
    var next = clone(state);
    var before = next.weights.length;
    next.weights = next.weights.filter(function (w) { return w.date !== date; });
    return { ok: next.weights.length !== before, state: next };
  }

  function setMovement(state, date, movement) {
    if (!isDateKey(date)) return { ok: false, state: state };
    var clean = movement == null ? null : sanitizeMovement(movement);
    if (movement && !clean) return { ok: false, error: "bewegung", state: state };
    var next = clone(state);
    ensure(next, date).movement = clean;
    return { ok: true, state: next };
  }

  function allMeals(state, date) {
    var day = state.days[date];
    if (!day) return [];
    var out = [];
    SLOTS.forEach(function (slot) {
      (day.meals[slot.id] || []).forEach(function (m) { out.push(m); });
    });
    return out;
  }

  function eatenKcal(state, date) {
    return allMeals(state, date).reduce(function (sum, m) { return sum + m.kcal; }, 0);
  }

  function sumField(meals, field) {
    var sum = 0;
    var any = false;
    var missing = false;
    meals.forEach(function (m) {
      var v = m[field];
      if (v == null) {
        missing = true;
        return;
      }
      any = true;
      sum += v;
    });
    return { sum: any ? round1(sum) : null, missing: missing, any: any };
  }

  function macroTotals(state, date) {
    var meals = allMeals(state, date);
    return {
      protein: sumField(meals, "protein"),
      carbs: sumField(meals, "carbs"),
      fat: sumField(meals, "fat")
    };
  }

  function scaleNutrient(per100, grams) {
    if (per100 == null || grams == null) return null;
    if (!Number.isFinite(per100) || !Number.isFinite(grams) || grams <= 0) return null;
    return (per100 * grams) / 100;
  }

  function scalePortion(per100, grams) {
    var g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return null;
    return {
      grams: round1(g),
      kcal: scaleNutrient(per100.kcal, g) == null ? null : Math.round(scaleNutrient(per100.kcal, g)),
      protein: scaleNutrient(per100.protein, g) == null ? null : round1(scaleNutrient(per100.protein, g)),
      carbs: scaleNutrient(per100.carbs, g) == null ? null : round1(scaleNutrient(per100.carbs, g)),
      fat: scaleNutrient(per100.fat, g) == null ? null : round1(scaleNutrient(per100.fat, g))
    };
  }

  function dayHasEntry(state, date) {
    var day = state.days[date];
    if (day && (allMeals(state, date).length || day.water > 0 || day.movement)) return true;
    return state.weights.some(function (w) { return w.date === date; });
  }

  function recentDays(state, anchor, count) {
    var n = count || 7;
    var start = anchor;
    var i;
    for (i = 0; i < n - 1; i += 1) start = addDays(start, -1);
    var out = [];
    var key = start;
    for (i = 0; i < n; i += 1) {
      out.push({ date: key, has: dayHasEntry(state, key) });
      key = addDays(key, 1);
    }
    return out;
  }

  function quietNotes(state, date) {
    var notes = [];
    if (allMeals(state, date).length) notes.push("Mahlzeit eingetragen");
    var day = state.days[date];
    if (day && day.water > 0) notes.push("Getrunken");
    if (day && day.movement) notes.push("Bewegung notiert");
    if (state.weights.some(function (w) { return w.date === date; })) notes.push("Gewicht eingetragen");
    return notes;
  }

  function weightOn(state, date) {
    return state.weights.find(function (w) { return w.date === date; }) || null;
  }

  function currentWeight(state) {
    if (!state.weights.length) return null;
    return state.weights[state.weights.length - 1];
  }

  function earliestWeight(state) {
    if (!state.weights.length) return null;
    return state.weights[0];
  }

  function rememberFood(state, snap, bucket) {
    var clean = sanitizeFoodSnap(snap);
    if (!clean) return { ok: false, state: state };
    var next = clone(state);
    var list = next[bucket].filter(function (item) {
      return !(clean.code && item.code === clean.code) && item.name !== clean.name;
    });
    list.unshift(clean);
    next[bucket] = list.slice(0, bucket === "favorites" ? 30 : 8);
    return { ok: true, state: next };
  }

  function resetKeepingDisplay(state) {
    var next = defaultState();
    next.settings.theme = state.settings.theme;
    next.settings.senior = state.settings.senior;
    next.settings.onboarded = true;
    return next;
  }

  function validateName(input) {
    var name = cleanText(input, 80);
    if (!name) return { ok: false, error: "Bitte einen Namen eingeben." };
    return { ok: true, value: name };
  }

  function validateKcal(input, required) {
    if (String(input == null ? "" : input).trim() === "") {
      return required ? { ok: false, error: "Bitte Kalorien als ganze Zahl eingeben." } : { ok: true, value: null };
    }
    var parsed = parseGermanNumber(input);
    if (!parsed.ok || parsed.value < 0 || parsed.value > 20000 || Math.round(parsed.value) !== parsed.value) {
      return { ok: false, error: "Bitte eine ganze Zahl von 0 bis 20.000 eingeben." };
    }
    return { ok: true, value: parsed.value };
  }

  function validateMacro(input) {
    if (String(input == null ? "" : input).trim() === "") return { ok: true, value: null };
    var parsed = parseGermanNumber(input);
    if (!parsed.ok || parsed.value < 0 || parsed.value > 1000) {
      return { ok: false, error: "Bitte Gramm zwischen 0 und 1.000 eingeben oder das Feld leer lassen." };
    }
    return { ok: true, value: round1(parsed.value) };
  }

  function validateWeight(input, allowEmpty) {
    if (String(input == null ? "" : input).trim() === "") {
      return allowEmpty ? { ok: true, value: null } : { ok: false, error: "Bitte ein Gewicht eintragen." };
    }
    var parsed = parseGermanNumber(input);
    if (!parsed.ok || parsed.value < 2 || parsed.value > 500) {
      return { ok: false, error: "Bitte ein Gewicht zwischen 2 und 500 kg eintragen." };
    }
    return { ok: true, value: round1(parsed.value) };
  }

  function validateSteps(input) {
    var parsed = parseGermanNumber(input);
    if (!parsed.ok || parsed.value < 0 || parsed.value > 200000 || Math.round(parsed.value) !== parsed.value) {
      return { ok: false, error: "Bitte Schritte als ganze Zahl von 0 bis 200.000 eingeben." };
    }
    return { ok: true, value: parsed.value };
  }

  function validateBarcode(input) {
    var code = String(input || "").replace(/\s/g, "");
    if (!/^\d{8,14}$/.test(code)) return { ok: false, error: "Bitte 8 bis 14 Ziffern eingeben." };
    return { ok: true, value: code };
  }

  function validateSearch(input) {
    var q = cleanText(input, 80);
    if (q.length < 2) return { ok: false, error: "Bitte mindestens 2 Zeichen eingeben." };
    return { ok: true, value: q };
  }

  function futureKey(key, today) {
    return key > today;
  }

  root.VFND = {
    KEY: KEY,
    SLOTS: SLOTS,
    localDateKey: localDateKey,
    dateFromKey: dateFromKey,
    addDays: addDays,
    isDateKey: isDateKey,
    parseGermanNumber: parseGermanNumber,
    formatInt: formatInt,
    formatKg: formatKg,
    formatMacro: formatMacro,
    formatSignedKg: formatSignedKg,
    defaultState: defaultState,
    sanitizeState: sanitizeState,
    loadState: loadState,
    saveState: saveState,
    addMeal: addMeal,
    removeMeal: removeMeal,
    setWater: setWater,
    upsertWeight: upsertWeight,
    removeWeight: removeWeight,
    setMovement: setMovement,
    allMeals: allMeals,
    eatenKcal: eatenKcal,
    macroTotals: macroTotals,
    scaleNutrient: scaleNutrient,
    scalePortion: scalePortion,
    dayHasEntry: dayHasEntry,
    recentDays: recentDays,
    quietNotes: quietNotes,
    weightOn: weightOn,
    currentWeight: currentWeight,
    earliestWeight: earliestWeight,
    rememberFood: rememberFood,
    resetKeepingDisplay: resetKeepingDisplay,
    validateName: validateName,
    validateKcal: validateKcal,
    validateMacro: validateMacro,
    validateWeight: validateWeight,
    validateSteps: validateSteps,
    validateBarcode: validateBarcode,
    validateSearch: validateSearch,
    futureKey: futureKey,
    uid: uid
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
