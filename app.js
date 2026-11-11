(function () {
  var VFND = globalThis.VFND;
  var OFF = globalThis.OFF;
  var state;
  var loadInfo;
  var selectedDate = VFND.localDateKey(new Date());
  var offResults = [];
  var offError = "";
  var offBusy = false;
  var formError = "";
  var prefill = null;
  var undoSnap = null;
  var toastTimer = 0;
  var lastRoute = "";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function svg(name) {
    var paths = {
      sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"></path>',
      meal: '<path d="M7 3v6M9 3v6M11 3v6M9 9v12M16 3c2 3 2 6 0 9v9"></path>',
      chart: '<path d="M4 19V5M4 19h16"></path><path d="m7 15 4-5 3 3 5-7"></path>',
      drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"></path>',
      user: '<circle cx="12" cy="8" r="3"></circle><path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19"></path>',
      bag: '<path d="M6 8h12l-1 12H7L6 8z"></path><path d="M9 8V7a3 3 0 0 1 6 0v1"></path>',
      book: '<path d="M6 4h5a3 3 0 0 1 3 3v13H8a2 2 0 0 0-2 2z"></path><path d="M18 4h-5a3 3 0 0 0-3 3v13h6a2 2 0 0 1 2 2z"></path>',
      train: '<path d="M7 5h10v7a5 5 0 0 1-10 0z"></path><path d="M8 20l2-4M16 20l-2-4M9 9h6"></path>',
      more: '<circle cx="6" cy="12" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="18" cy="12" r="1.3"></circle>',
      camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"></path><circle cx="12" cy="13" r="3"></circle>',
      back: '<path d="M15 6 9 12l6 6"></path>',
      warn: '<path d="M12 4 3 19h18L12 4z"></path><path d="M12 10v4M12 16.5h.01"></path>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
  }

  function seniorOn() {
    return state.settings.look !== "lila";
  }

  function todayKey() {
    return VFND.localDateKey(new Date());
  }

  function greeting() {
    var h = new Date().getHours();
    var text = "Gute Nacht";
    if (h >= 5 && h < 11) text = "Guten Morgen";
    else if (h >= 11 && h < 17) text = "Guten Tag";
    else if (h >= 17 && h < 22) text = "Guten Abend";
    if (state.settings.displayName) text += ", " + state.settings.displayName;
    return text;
  }

  function fullDate(key) {
    return VFND.dateFromKey(key).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function shortDay(key) {
    return VFND.dateFromKey(key).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  }

  function applyTheme() {
    var pref = state.settings.theme;
    var dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.setAttribute("data-theme", dark ? "dark" : "light");
    root.setAttribute("data-theme-pref", pref);
    root.removeAttribute("data-mode");
    if (state.settings.look === "lila") root.setAttribute("data-look", "lila");
    else root.removeAttribute("data-look");
    root.style.colorScheme = dark ? "dark" : "light";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var color = getComputedStyle(root).getPropertyValue("--bg").trim();
      if (color) meta.setAttribute("content", color);
    }
  }

  function announce(text) {
    var live = document.getElementById("live");
    if (live) live.textContent = text;
  }

  function toast(text) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.hidden = false;
    el.innerHTML = "<span>" + esc(text) + " ✓</span><button type=\"button\" class=\"btn\" data-undo=\"1\" data-testid=\"undo\">Rückgängig</button>";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3000);
  }

  function commit(next, message) {
    undoSnap = state;
    state = next;
    var saved = VFND.saveState(localStorage, state);
    loadInfo.writeError = !saved.ok;
    if (saved.ok) {
      loadInfo.corrupted = false;
      loadInfo.storageError = false;
      if (message && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && navigator.vibrate) {
        try { navigator.vibrate(10); } catch (e) {}
      }
      toast(message || "Gespeichert");
      announce(message || "Gespeichert");
    } else {
      announce("Speichern ist fehlgeschlagen.");
    }
    render();
  }

  function route() {
    var parts = String(location.hash || "#/").replace(/^#\/?/, "").split("/").filter(Boolean);
    var name = parts[0] || "dashboard";
    var known = { dashboard: 1, heute: 1, mahlzeiten: 1, fortschritt: 1, wasser: 1, profil: 1, hinweise: 1, start: 1, rezepte: 1, einkauf: 1, training: 1, scanner: 1, lizenzen: 1 };
    if (!known[name]) name = "dashboard";
    return { name: name, extra: parts[1] || "", more: parts.slice(2).join("/") };
  }

  function banner() {
    if (state.settings.displayName !== "Testdaten") return "";
    return '<p class="banner" data-testid="example-banner">Beispieldaten, keine echten Angaben</p>';
  }

  function storageBanner() {
    if (loadInfo.storageError) return '<p class="err" data-testid="storage-banner"><span aria-hidden="true">' + svg("warn") + '</span><span>Fehler: Speicher nicht verfügbar. Einträge bleiben nur bis zum Schließen der Seite.</span></p>';
    if (loadInfo.writeError) return '<p class="err" data-testid="storage-banner"><span aria-hidden="true">' + svg("warn") + '</span><span>Fehler: Speichern ist fehlgeschlagen. Der Stand bleibt nur bis zum Neuladen.</span></p>';
    if (loadInfo.corrupted) return '<p class="banner" data-testid="storage-banner">Gespeicherte Daten waren nicht lesbar. Es wird nichts ersetzt, bis du etwas neu speicherst.</p>';
    if (loadInfo.sanitized) return '<p class="banner" data-testid="storage-banner">Einige ungültige Einträge wurden ausgelassen.</p>';
    return "";
  }

  function errorBox(text) {
    if (!text) return "";
    return '<p class="err" role="alert"><span aria-hidden="true">' + svg("warn") + '</span><span>Fehler: ' + esc(text) + "</span></p>";
  }

  function kcalLine(date) {
    var eaten = VFND.eatenKcal(state, date);
    var goal = state.settings.calorieGoal;
    if (!goal && !eaten) return "Noch nichts eingetragen";
    if (!goal) return VFND.formatInt(eaten) + " kcal gegessen";
    if (eaten <= goal) return VFND.formatInt(goal - eaten) + " kcal übrig";
    return VFND.formatInt(eaten - goal) + " kcal über dem gesetzten Ziel";
  }

  function progressLine() {
    var cur = VFND.currentWeight(state);
    var start = state.settings.startWeight;
    if (start == null) {
      var first = VFND.earliestWeight(state);
      start = first ? first.kg : null;
    }
    if (start == null || !cur) return "Noch kein Gewicht";
    return VFND.formatSignedKg(cur.kg - start) + " seit Start";
  }

  function headerBlock() {
    return '<header class="page-head"><p class="greet">' + esc(greeting()) + "</p><h1>von fett nach dünn</h1></header>";
  }

  function iconBtn(test, go, icon, label) {
    return '<button type="button" class="btn with-icon" data-go="' + go + '" data-testid="' + test + '">' + svg(icon) + "<span>" + label + "</span></button>";
  }

  function backBtn(target) {
    return '<button type="button" class="btn secondary" data-go="' + target + '">' + svg("back") + " Zurück</button>";
  }

  function pager() {
    var today = todayKey();
    if (selectedDate > today) selectedDate = today;
    var nextDisabled = selectedDate >= today ? " disabled" : "";
    return '<div class="pager"><button type="button" class="btn secondary" data-shift="-1" data-testid="prev-day">Vorheriger Tag</button><p data-testid="day-label">' + esc(fullDate(selectedDate)) + '</p><button type="button" class="btn secondary" data-shift="1" data-testid="next-day"' + nextDisabled + ">Nächster Tag</button></div>";
  }

  function seriesBlock(words) {
    var anchor = todayKey();
    var days = VFND.recentDays(state, anchor, 7);
    var count = days.filter(function (d) { return d.has; }).length;
    var items = days.map(function (d) {
      var word = d.has ? "Eintrag" : "Pause";
      if (words) return '<li class="day' + (d.has ? " has" : "") + '"><span>' + esc(shortDay(d.date)) + '</span><span>' + word + "</span></li>";
      return '<li class="day"><i>' + esc(VFND.dateFromKey(d.date).toLocaleDateString("de-DE", { weekday: "short" })) + '</i><span class="mark" aria-hidden="true">' + (d.has ? "●" : "○") + '</span><span class="sr-only">' + word + "</span></li>";
    }).join("");
    return '<section data-testid="series"><h2>Letzte 7 Tage</h2><p class="fine">An ' + count + " von 7 Tagen eingetragen. " + (words ? "Schraffur: Eintrag. Leer: Pause." : "● Eintrag, ○ Pause.") + " Kein Rückstand.</p><ol class=\"days\">" + items + "</ol></section>";
  }

  function quietBlock(date) {
    var notes = VFND.quietNotes(state, date);
    if (!notes.length) return '<p class="fine" data-testid="quiet">Heute ist noch nichts eingetragen. Pausen sind in Ordnung.</p>';
    return '<p data-testid="quiet">' + notes.map(esc).join(" · ") + "</p>";
  }

  function macroBlock(date) {
    var totals = VFND.macroTotals(state, date);
    var rows = [
      ["protein", "Eiweiß", totals.protein, state.settings.proteinGoal],
      ["carbs", "Kohlenhydrate", totals.carbs, state.settings.carbsGoal],
      ["fat", "Fett", totals.fat, state.settings.fatGoal]
    ];
    var html = rows.map(function (row) {
      var total = row[2];
      var goal = row[3];
      var text = total.sum == null ? "nicht angegeben" : VFND.formatMacro(total.sum) + " g";
      if (total.missing && total.any) text += ", unvollständig";
      if (goal != null) text += " · Ziel " + VFND.formatMacro(goal) + " g";
      if (goal != null && total.sum != null && total.sum > goal) text += " · über dem gesetzten Ziel";
      var width = goal != null && total.sum != null && goal > 0 ? Math.min(100, Math.round((total.sum / goal) * 100)) : 0;
      return '<div class="bar ' + row[0] + '" data-testid="macro-' + row[0] + '"><div class="bar-head"><span>' + row[1] + '</span><span class="num">' + esc(text) + '</span></div><div class="track" aria-hidden="true"><div class="fill ' + row[0] + '" style="width:' + width + '%"></div></div></div>';
    }).join("");
    var legend = seniorOn() ? '<p class="fine">Muster: Eiweiß voll, Kohlenhydrate schraffiert, Fett gepunktet. Die Zahl steht daneben.</p>' : "";
    return '<section><h2>Makros</h2>' + legend + '<div class="bars">' + html + '</div><p class="fine">Ziele setzt du selbst. Leere Felder sind kein Soll.</p></section>';
  }

  function movementForm(date) {
    var day = state.days[date] || {};
    var move = day.movement;
    var steps = move && move.kind === "steps" ? String(move.steps) : "";
    var note = move && move.kind === "note" ? move.note : "";
    var stepsChecked = !move || move.kind === "steps" ? " checked" : "";
    var noteChecked = move && move.kind === "note" ? " checked" : "";
    return '<form data-form="movement" class="stack"><fieldset><legend>Bewegung, optional</legend><label class="choice"><input type="radio" name="move" value="steps"' + stepsChecked + "> Schritte</label><label class=\"choice\"><input type=\"radio\" name=\"move\" value=\"note\"" + noteChecked + "> Notiz</label></fieldset><label>Schritte<input name=\"steps\" inputmode=\"numeric\" autocomplete=\"off\" value=\"" + esc(steps) + "\"></label><label>Notiz<input name=\"note\" maxlength=\"80\" autocomplete=\"off\" value=\"" + esc(note) + "\"></label><button class=\"btn\" type=\"submit\">Bewegung speichern</button><button class=\"btn secondary\" type=\"button\" data-clear-move=\"1\">Eintrag entfernen</button></form><p class=\"fine\">Schritte oder eine Notiz. Keine Vorgabe, kein Soll.</p>";
  }

  function ringBlock(date) {
    var eaten = VFND.eatenKcal(state, date);
    var goal = state.settings.calorieGoal;
    var pct = goal ? Math.min(1, eaten / goal) : 0;
    var r = 46;
    var c = 2 * Math.PI * r;
    var offset = c * (1 - pct);
    var big = VFND.formatInt(eaten);
    var small = "kcal gegessen";
    if (goal && eaten <= goal) {
      big = VFND.formatInt(goal - eaten);
      small = "kcal übrig";
    } else if (goal) {
      big = VFND.formatInt(eaten - goal);
      small = "kcal über dem Ziel";
    }
    var label = goal ? (VFND.formatInt(eaten) + " von " + VFND.formatInt(goal) + " kcal gegessen") : (VFND.formatInt(eaten) + " kcal gegessen, Ziel nicht gesetzt");
    var track = seniorOn() ? ' stroke-dasharray="2 7"' : "";
    var grad = seniorOn() ? "" : '<defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C3AED"/><stop offset="1" stop-color="#0D9488"/></linearGradient></defs>';
    return '<div class="ring-wrap" role="img" aria-label="' + esc(label) + '"><svg class="ring" viewBox="0 0 120 120" aria-hidden="true">' + grad + '<circle class="ring-track" cx="60" cy="60" r="' + r + '"' + track + '></circle><circle class="ring-value" cx="60" cy="60" r="' + r + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '"></circle></svg><div class="ring-label"><strong class="num">' + esc(big) + "</strong><span>" + esc(small) + "</span></div></div>";
  }

  function statsBlock(date) {
    var eaten = VFND.eatenKcal(state, date);
    var goal = state.settings.calorieGoal;
    var goalText = goal == null ? "nicht gesetzt" : VFND.formatInt(goal);
    var leftText = goal == null ? "—" : (eaten <= goal ? VFND.formatInt(goal - eaten) : "0");
    var over = goal != null && eaten > goal ? '<p class="fine">' + esc(VFND.formatInt(eaten - goal)) + " kcal über dem gesetzten Ziel.</p>" : "";
    return '<div class="stats"><div class="stat"><span>Ziel</span><b class="num" data-testid="goal-kcal">' + esc(goalText) + '</b></div><div class="stat"><span>Gegessen</span><b class="num" data-testid="eaten">' + esc(VFND.formatInt(eaten)) + '</b></div><div class="stat"><span>' + esc(tx("home.remainingToday")) + '</span><b class="num" data-testid="remaining">' + esc(leftText) + "</b></div></div>" + over;
  }

  function card(test, go, icon, tint, title, text) {
    return '<button type="button" class="card" data-go="' + go + '" data-testid="' + test + '"><span class="tile ' + tint + '">' + svg(icon) + '</span><span class="grow"><span class="decor-gradient" aria-hidden="true"></span><h2>' + title + "</h2><p>" + esc(text) + '</p></span><span class="chev" aria-hidden="true">' + svg("back").replace("M15 6 9 12l6 6", "M9 6l6 6-6 6") + "</span></button>";
  }

  function remainBlock(date) {
    var eaten = VFND.eatenKcal(state, date);
    var goal = state.settings.calorieGoal;
    var left = goal == null ? eaten : Math.max(0, goal - eaten);
    var pct = goal ? Math.min(100, Math.round((eaten / goal) * 100)) : 0;
    var hatch = seniorOn() ? " hatch" : "";
    return '<div class="remain" data-testid="remain"><p class="fine">' + esc(tx("home.remainingToday")) + '</p><p class="remain-num"><strong class="num">' + esc(tx("home.remainingTodayValue", { kcal: VFND.formatInt(left) })) + '</strong></p><div class="remain-track" aria-hidden="true"><div class="remain-fill' + hatch + '" style="width:' + pct + '%"></div></div><div class="remain-meta"><span>Gegessen ' + esc(VFND.formatInt(eaten)) + "</span><span>Ziel " + esc(goal == null ? "nicht gesetzt" : VFND.formatInt(goal)) + "</span></div></div>";
  }

  function heroBlock(date) {
    return '<section class="hero" data-testid="hero"><div class="hero-inner"><p class="greet">' + esc(greeting()) + '</p><h1>von fett nach dünn</h1>' + banner() + '<p class="fine">Nur auf diesem Gerät. Kein medizinischer Rat.</p>' + remainBlock(date) + '<p class="fine">Das Kalorienziel setzt du selbst. Die App rechnet keine Empfehlung.</p></div></section>';
  }

  function actionTile(test, go, icon, label) {
    return '<button type="button" class="action-tile" data-go="' + go + '" data-testid="' + test + '">' + svg(icon) + "<span>" + esc(label) + "</span></button>";
  }

  function actionTiles() {
    return '<section class="action-area" aria-labelledby="do-title"><h2 id="do-title">' + esc(tx("home.tilesTitle")) + '</h2><div class="action-grid" data-testid="action-grid">' +
      actionTile("tile-scan", "scanner", "camera", tx("home.tileScan")) +
      actionTile("tile-recipes", "rezepte", "book", tx("home.tileRecipes")) +
      actionTile("tile-shop", "einkauf", "bag", tx("home.tileShoppingList")) +
      actionTile("tile-training", "training", "train", tx("home.tileTraining")) +
      "</div></section>";
  }

  function backToday() {
    return '<button type="button" class="btn secondary back-today" data-go="dashboard" data-testid="back-today">' + esc(tx("home.backToToday")) + "</button>";
  }

  function tx(path, vars) {
    var node = texts;
    String(path || "").split(".").forEach(function (part) {
      node = node && node[part];
    });
    if (typeof node !== "string") return "";
    return node.replace(/\{(\w+)\}/g, function (_, key) {
      return vars && vars[key] != null ? String(vars[key]) : "{" + key + "}";
    });
  }

  function renderDashboard() {
    var today = todayKey();
    var water = (state.days[today] && state.days[today].water) || 0;
    return '<div class="view">' + heroBlock(today) + actionTiles() + storageBanner() + seriesBlock(false) + quietBlock(today) + '<div class="cards">' +
      card("card-meals", "mahlzeiten", "meal", "", "Mahlzeiten", "Frühstück, Mittag, Abend, Snacks") +
      card("card-progress", "fortschritt", "chart", "teal", "Fortschritt", progressLine()) +
      card("card-water", "wasser", "drop", "", "Wasser", water + " von " + state.settings.waterGoal + " Gläsern") +
      "</div></div>";
  }

  function renderSeniorHome() {
    var today = todayKey();
    return '<div class="view">' + headerBlock() + '<p class="fine">Größere Ansicht</p>' + banner() + storageBanner() +
      '<div class="callout"><p><strong>Bitte ärztlich klären.</strong> Gewichtsabnahme im Alter vorher mit einer Ärztin oder einem Arzt besprechen. Bei Einschränkungen gilt deren Rat, nicht diese App.</p></div>' +
      '<section class="panel" data-testid="senior-kcal"><h2>' + esc(kcalLine(today)) + "</h2><p class=\"fine\">Gegessen: <span class=\"num\" data-testid=\"eaten\">" + esc(VFND.formatInt(VFND.eatenKcal(state, today))) + "</span> kcal. Ziel: <span class=\"num\" data-testid=\"goal-kcal\">" + esc(state.settings.calorieGoal == null ? "nicht gesetzt" : VFND.formatInt(state.settings.calorieGoal)) + "</span>.</p></section>" + actionTiles() +
      '<div class="stack">' + iconBtn("senior-breakfast", "mahlzeiten/fruehstueck", "meal", "Frühstück eintragen") + iconBtn("senior-lunch", "mahlzeiten/mittag", "meal", "Mittag eintragen") + iconBtn("senior-dinner", "mahlzeiten/abend", "meal", "Abend eintragen") + iconBtn("senior-weight", "fortschritt", "chart", "Gewicht eintragen") + iconBtn("senior-water", "wasser", "drop", "Wasser") + "</div>" +
      quietBlock(today) +
      "<details><summary>Makros</summary>" + macroBlock(today) + "</details><details><summary>Bewegung</summary>" + movementForm(today) + "</details><details><summary>Letzte 7 Tage</summary>" + seriesBlock(true) + '</details><a class="btn secondary" href="#/hinweise">Hinweise im Alter</a><p class="hint">Kein medizinischer Rat. Pausen sind in Ordnung.</p></div>';
  }

  function renderHeute() {
    return '<div class="view">' + backBtn("dashboard") + "<header><h1>Heute</h1></header>" + pager() + '<section class="panel">' + ringBlock(selectedDate) + statsBlock(selectedDate) + '<p class="fine">Das Kalorienziel setzt du selbst. Die App rechnet keine Empfehlung.</p></section>' + macroBlock(selectedDate) + movementForm(selectedDate) + '<p class="hint">Kein medizinischer Rat.</p></div>';
  }

  function mealList(date, slot) {
    var day = state.days[date];
    var items = (day && day.meals[slot]) || [];
    if (!items.length) return '<p class="fine">Noch nichts eingetragen.</p>';
    return '<ul class="meal-list" data-testid="meal-list-' + slot + '">' + items.map(function (m) {
      var bits = [VFND.formatInt(m.kcal) + " kcal"];
      bits.push(m.protein == null ? "Eiweiß nicht angegeben" : "Eiweiß " + VFND.formatMacro(m.protein) + " g");
      bits.push(m.carbs == null ? "Kohlenhydrate nicht angegeben" : "Kohlenhydrate " + VFND.formatMacro(m.carbs) + " g");
      bits.push(m.fat == null ? "Fett nicht angegeben" : "Fett " + VFND.formatMacro(m.fat) + " g");
      return '<li class="meal"><div class="meal-top"><strong>' + esc(m.name) + '</strong><span class="kcal num">' + esc(VFND.formatInt(m.kcal)) + ' kcal</span></div><p class="fine">' + esc(bits.join(" · ")) + '</p><button type="button" class="btn danger" data-del="' + esc(m.id) + '">Löschen: ' + esc(m.name) + "</button></li>";
    }).join("") + "</ul>";
  }

  function manualForm(slot) {
    var values = prefill && prefill.slot === slot ? prefill : {};
    function val(key) { return values[key] == null ? "" : String(values[key]); }
    return '<form data-form="manual" data-slot="' + slot + '" class="stack" data-testid="manual-form-' + slot + '" method="post" action="#tagebuch"><label>Name<input name="title" data-testid="manual-name" maxlength="80" autocomplete="off" value="' + esc(val("name")) + '"></label><label>kcal<input name="kcal" data-testid="manual-kcal" inputmode="numeric" autocomplete="off" value="' + esc(val("kcal")) + '"></label><label>Eiweiß in g, optional<input name="protein" data-testid="manual-protein" inputmode="decimal" autocomplete="off" value="' + esc(val("protein")) + '"></label><label>Kohlenhydrate in g, optional<input name="carbs" inputmode="decimal" autocomplete="off" value="' + esc(val("carbs")) + '"></label><label>Fett in g, optional<input name="fat" inputmode="decimal" autocomplete="off" value="' + esc(val("fat")) + '"></label><button class="btn" type="submit" data-testid="add-' + slot + '">Hinzufügen</button></form>';
  }

  function nutriscoreHtml(grade) {
    if (!grade) return "";
    var letter = grade.toUpperCase();
    return '<p>Nutri-Score ' + letter + ' <span class="badge ' + grade + '" aria-hidden="true">' + letter + "</span></p>";
  }

  function per100Text(product) {
    function part(label, value, unit) {
      if (value == null) return label + " nicht angegeben";
      var shown = unit === "kcal" ? VFND.formatInt(value) : VFND.formatMacro(value);
      return label + " " + shown + (unit === "kcal" ? " kcal" : " g");
    }
    var p = product.per100 || {};
    return "je 100 g: " + [part("Kalorien", p.kcal, "kcal"), part("Eiweiß", p.protein, "g"), part("Kohlenhydrate", p.carbs, "g"), part("Fett", p.fat, "g")].join(", ");
  }

  function resultsHtml() {
    if (offBusy) return '<p data-testid="results">Suche läuft.</p>';
    if (!offResults.length) return offError ? '<p data-testid="results">' + esc(offError) + "</p>" : '<div data-testid="results"></div>';
    var items = offResults.map(function (product, index) {
      var img = product.imageUrl ? '<img class="food-img" alt="" width="48" height="48" referrerpolicy="no-referrer" src="' + esc(product.imageUrl) + '">' : "";
      var grams = product.servingGrams ? String(product.servingGrams).replace(".", ",") : "";
      return '<li class="result" data-off-index="' + index + '"><div class="result-top">' + img + "<div><strong>" + esc(product.name) + "</strong><p class=\"fine\">" + esc(product.brand || "Marke nicht angegeben") + "</p>" + nutriscoreHtml(product.nutriscore) + '<p class="fine">' + esc(per100Text(product)) + '</p></div></div><label>Portion in Gramm<input data-grams inputmode="decimal" autocomplete="off" value="' + esc(grams) + '"></label><p class="fine" data-preview>Gramm eintragen, dann wird die Portion aus den Werten je 100 g berechnet.</p><button type="button" class="btn" data-add-off="' + index + '">Eintragen</button><button type="button" class="btn secondary" data-fav="' + index + '">Merken</button></li>';
    }).join("");
    return '<ul class="results" data-testid="results">' + items + "</ul>";
  }

  function snapList(list, empty) {
    if (!list.length) return '<p class="fine">' + empty + "</p>";
    return '<ul class="stack">' + list.map(function (item, index) {
      return '<li class="snap"><strong>' + esc(item.name) + '</strong><p class="fine">' + esc(per100Text(item)) + '</p><button type="button" class="btn secondary" data-use-snap="' + index + '" data-bucket="recent">Nochmal eintragen</button></li>';
    }).join("") + "</ul>";
  }

  function renderMeals() {
    var current = route();
    var focusSlot = VFND.SLOTS.some(function (s) { return s.id === current.extra; }) ? current.extra : "";
    var eaten = VFND.eatenKcal(state, selectedDate);
    var blocks = VFND.SLOTS.map(function (slot) {
      return '<section class="panel" id="slot-' + slot.id + '"><h2>' + slot.label + "</h2>" + mealList(selectedDate, slot.id) + manualForm(slot.id) + "</section>";
    }).join("");
    var open = !seniorOn() || offResults.length || offError || offBusy ? " open" : "";
    return '<div class="view">' + backBtn("dashboard") + "<header><h1>Mahlzeiten</h1></header>" + banner() + pager() + '<p class="fine" data-testid="kcal-total">Heute ' + esc(VFND.formatInt(eaten)) + " kcal</p>" + errorBox(formError) + blocks +
      '<details id="off-panel"' + open + '><summary>Lebensmittel suchen</summary><form data-form="search" data-testid="search-form" class="stack" method="post" action="#suche"><label>Suchbegriff<input id="search-q" name="q" data-testid="search-q" maxlength="80" autocomplete="off"></label><button class="btn" type="submit">Suchen</button></form><form data-form="barcode" data-testid="barcode-form" class="stack" method="post" action="#code"><label>Strichcode<input name="code" data-testid="barcode-code" inputmode="numeric" maxlength="14" autocomplete="off"></label><button class="btn secondary" type="submit">Abrufen</button><button type="button" class="btn with-icon scan-launch" data-go="scanner" data-testid="meals-scan">' + svg("camera") + "<span>" + esc(tx("meals.scanButton")) + "</span></button></form>" + '<p class="fine">Suche und Strichcode starten erst mit dem Knopf. Es gehen nur der Suchbegriff oder der Strichcode und die technisch nötigen Verbindungsdaten an Open Food Facts. Tagebuch, Gewicht und Ziele bleiben hier. Produktbilder nur in dieser Trefferliste, ohne Suchbegriff in der Bildadresse und ohne Referrer.</p>' + resultsHtml() + "<h3>Zuletzt</h3>" + snapList(state.recent, "Noch nichts.") + "<h3>Gemerkt</h3>" + snapList(state.favorites, "Noch nichts gemerkt.").replace(/data-bucket="recent"/g, 'data-bucket="favorites"') + "</details>" +
      '<p class="fine">Daten: <a href="https://world.openfoodfacts.org/data" rel="noreferrer noopener" referrerpolicy="no-referrer">Open Food Facts (ODbL)</a>. Keine komplette Datenbank, nur die Treffer dieser Abfrage.</p>' +
      (focusSlot ? '<p class="sr-only">Bereich ' + esc(focusSlot) + " bereit.</p>" : "") + "</div>";
  }

  function chartBlock() {
    var weights = state.weights;
    if (!weights.length) return '<p class="fine">Noch kein Gewicht eingetragen.</p>';
    var goal = state.settings.goalWeight;
    var vals = weights.map(function (w) { return w.kg; });
    var dataMin = Math.min.apply(null, vals);
    var dataMax = Math.max.apply(null, vals);
    if (goal != null) {
      dataMin = Math.min(dataMin, goal);
      dataMax = Math.max(dataMax, goal);
    }
    if (dataMin === dataMax) { dataMin -= 1; dataMax += 1; }
    var span = dataMax - dataMin;
    var min = dataMin - span * 0.18;
    var max = dataMax + span * 0.18;
    var w = 360;
    var h = 240;
    var left = 64;
    var right = 56;
    var top = 20;
    var bottom = 42;
    function x(i) { return weights.length === 1 ? (left + w - right) / 2 : left + (i * (w - left - right)) / (weights.length - 1); }
    function y(v) { return top + ((max - v) / (max - min)) * (h - top - bottom); }
    var d = weights.map(function (pt, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(pt.kg).toFixed(1); }).join(" ");
    var dots = weights.map(function (pt, i) {
      return '<circle class="dot" cx="' + x(i).toFixed(1) + '" cy="' + y(pt.kg).toFixed(1) + '" r="5"><title>' + esc(shortDay(pt.date) + " " + VFND.formatKg(pt.kg) + " kg") + "</title></circle>";
    }).join("");
    var ticks = [dataMin, (dataMin + dataMax) / 2, dataMax];
    var grid = ticks.map(function (v) {
      var yy = y(v).toFixed(1);
      return '<line class="grid" x1="' + left + '" x2="' + (w - right) + '" y1="' + yy + '" y2="' + yy + '"></line><text class="axis" x="' + (left - 8) + '" y="' + (Number(yy) + 4) + '" text-anchor="end">' + esc(VFND.formatKg(v)) + "</text>";
    }).join("");
    var xLabels = weights.map(function (pt, i) {
      var anchor = i === 0 ? "start" : (i === weights.length - 1 ? "end" : "middle");
      return '<text class="axis" x="' + x(i).toFixed(1) + '" y="' + (h - 14) + '" text-anchor="' + anchor + '">' + esc(shortDay(pt.date)) + "</text>";
    }).join("");
    var goalLine = "";
    if (goal != null) {
      var gy = y(goal);
      goalLine = '<line class="goal" x1="' + left + '" x2="' + (w - right) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"></line><text class="goal-label" x="' + (left + 6) + '" y="' + Math.max(top + 14, gy - 6).toFixed(1) + '">Ziel ' + esc(VFND.formatKg(goal)) + " kg</text>";
    }
    return '<div class="chart-wrap"><svg class="chart" data-testid="chart" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="Gewichtsverlauf mit Kilogramm-Achse, Datum und gestrichelter Ziellinie. Zahlen stehen auch in der Tabelle.">' + grid + goalLine + '<path class="weight" d="' + d + '"></path>' + dots + xLabels + '</svg></div><p class="fine">Durchgezogen: Gewicht. Gestrichelt und beschriftet: Ziel. kg links, Datum unten.</p>';
  }

  function weightFacts() {
    var cur = VFND.currentWeight(state);
    var first = VFND.earliestWeight(state);
    var start = state.settings.startWeight;
    var startLabel = start != null ? "Startgewicht " + VFND.formatKg(start) + " kg" : (first ? "Erstes eingetragenes Gewicht " + VFND.formatKg(first.kg) + " kg" : "Noch kein Startgewicht");
    var goal = state.settings.goalWeight == null ? "Zielgewicht nicht gesetzt" : "Zielgewicht " + VFND.formatKg(state.settings.goalWeight) + " kg";
    var current = cur ? "Aktuell " + VFND.formatKg(cur.kg) + " kg" : "Noch kein Gewicht";
    var delta = "";
    var base = start != null ? start : (first ? first.kg : null);
    if (base != null && cur) delta = " Veränderung seit Start " + VFND.formatSignedKg(cur.kg - base) + ".";
    var gap = "";
    if (state.settings.goalWeight != null && cur) gap = " Differenz zum Zielgewicht " + VFND.formatSignedKg(cur.kg - state.settings.goalWeight) + ".";
    return '<p class="fine">' + esc(startLabel + ". " + goal + ". " + current + "." + delta + gap) + "</p>";
  }

  function renderProgress() {
    var today = todayKey();
    var rows = state.weights.map(function (w) {
      return "<tr><td>" + esc(shortDay(w.date)) + '</td><td class="num">' + esc(VFND.formatKg(w.kg)) + '</td><td><button type="button" class="btn secondary" data-del-weight="' + esc(w.date) + '">Löschen</button></td></tr>';
    }).join("");
    var table = rows ? '<table data-testid="weight-table"><caption>Gewichte</caption><thead><tr><th>Datum</th><th>kg</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>" : '<table data-testid="weight-table"><caption>Gewichte</caption><tbody><tr><td>Noch kein Gewicht</td></tr></tbody></table>';
    return '<div class="view">' + backBtn("dashboard") + "<header><h1>Fortschritt</h1></header>" + banner() + weightFacts() + chartBlock() + table +
      '<form data-form="weight" data-testid="weight-form" class="stack" method="post" action="#gewicht"><label>Datum<input type="date" name="date" value="' + esc(today) + '"></label><label>Gewicht in kg<input name="kg" data-testid="weight-kg" inputmode="decimal" autocomplete="off"></label>' + errorBox(formError) + '<button class="btn" type="submit">Gewicht speichern</button></form><p class="hint">Kein medizinischer Rat. Die Kurve bewertet nichts.</p></div>';
  }

  function renderWater() {
    var goal = state.settings.waterGoal || 8;
    var count = (state.days[selectedDate] && state.days[selectedDate].water) || 0;
    var buttons = "";
    var i;
    for (i = 1; i <= goal; i += 1) {
      var on = i <= count;
      buttons += '<button type="button" class="glass" data-glass="' + i + '" data-testid="glass-' + i + '" aria-pressed="' + (on ? "true" : "false") + '">Glas ' + i + "<br>" + (on ? "voll" : "leer") + "</button>";
    }
    return '<div class="view">' + backBtn("dashboard") + "<header><h1>Wasser</h1></header>" + banner() + pager() + '<p data-testid="water-summary">' + count + " von " + goal + ' Gläsern voll</p><div class="glasses">' + buttons + '</div><div class="stack"><button type="button" class="btn secondary" data-water-step="-1">Ein Glas weniger</button><button type="button" class="btn" data-water-step="1">Ein Glas mehr</button></div><p class="fine">Nur eine Zählhilfe, keine Trinkempfehlung.</p></div>';
  }

  function themeFields() {
    function radio(value, label, test) {
      var checked = state.settings.theme === value ? " checked" : "";
      return '<label class="choice"><input type="radio" name="theme" value="' + value + '" data-testid="' + test + '"' + checked + "> " + label + "</label>";
    }
    function lookCard(value, title, text) {
      var checked = state.settings.look === value ? " checked" : "";
      return '<label class="look-card"><input type="radio" name="look" value="' + value + '"' + checked + '><span><strong>' + title + '</strong><span class="fine">' + text + "</span></span></label>";
    }
    return '<fieldset class="mode-grid"><legend>Darstellung</legend>' + radio("system", "System", "theme-system") + radio("light", "Hell", "theme-light") + radio("dark", "Dunkel", "theme-dark") + '</fieldset><fieldset class="look-box"><legend>Look</legend><div class="look-grid">' + lookCard("gross", "Große Tasten", "Standard · große Schrift, ruhige Farben") + lookCard("lila", "Lila", "Bunter, kompakter") + '</div><p class="fine">Wird nur auf diesem Gerät gespeichert. Gilt für alle Bereiche.</p></fieldset>';
  }

  function renderProfile() {
    var s = state.settings;
    function field(label, name, value, mode, test) {
      var testAttr = test ? ' data-testid="' + test + '"' : "";
      return "<label>" + label + '<input name="' + name + '"' + testAttr + ' inputmode="' + mode + '" autocomplete="off" value="' + esc(value == null ? "" : String(value).replace(".", ",")) + '"></label>';
    }
    return '<div class="view"><header><h1>Profil</h1></header>' + banner() +
      '<form data-form="settings" class="stack" method="post" action="#profil">' + themeFields() + '<label>Anzeigename, optional<input name="displayName" maxlength="40" autocomplete="off" value="' + esc(s.displayName) + '"></label>' +
      field("Kalorienziel, optional", "calorieGoal", s.calorieGoal, "numeric", "goal-input") +
      '<p class="fine">Du setzt das Ziel selbst. Die App rechnet keine Empfehlung und setzt kein Kalorienlimit.</p>' +
      field("Eiweißziel in g, optional", "proteinGoal", s.proteinGoal, "decimal") +
      field("Kohlenhydratziel in g, optional", "carbsGoal", s.carbsGoal, "decimal") +
      field("Fettziel in g, optional", "fatGoal", s.fatGoal, "decimal") +
      '<p><a href="#/lizenzen">Bildnachweise</a></p>' +
      field("Gläser als Zählhilfe", "waterGoal", s.waterGoal, "numeric") +
      field("Startgewicht in kg, optional", "startWeight", s.startWeight, "decimal") +
      field("Zielgewicht in kg, optional", "goalWeight", s.goalWeight, "decimal") +
      errorBox(formError) + '<button class="btn" type="submit" data-testid="save-settings">Ziele speichern</button></form>' +
      '<a class="btn secondary" href="#/hinweise">Hinweise im Alter</a>' +
      '<button type="button" class="btn danger" data-testid="reset-open" id="reset-open">Alle Einträge löschen</button>' +
      '<div class="hint"><p>Tagebuch, Gewicht, Ziele und Name bleiben auf diesem Gerät. Eine Suche sendet nur den Suchbegriff oder den Strichcode. Die Verbindung überträgt dabei die technisch nötigen Daten, zum Beispiel die IP-Adresse, an Open Food Facts. Keine Werbung, kein Tracking, kein Konto.</p><p>Kein medizinischer Rat.</p></div></div>';
  }

  function renderHinweise() {
    return '<div class="view">' + backBtn("profil") + '<div class="senior-area" data-testid="hinweise"><h1>Hinweise im Alter</h1><div class="callout"><p>Gewichtsabnahme im Alter bitte vorher mit einer Ärztin oder einem Arzt besprechen. Bei individuellen Einschränkungen gilt deren Rat, nicht diese App.</p></div><h2>Eiweiß und Muskeln</h2><p>Viele Menschen achten im Alter auf Eiweiß und darauf, Muskeln zu behalten. Eine Grammzahl für alle nennt diese App nicht.</p><h2>Trinken</h2><p>Regelmäßig trinken ist für viele Menschen sinnvoll. Eine Trinkmenge für alle gibt es hier nicht.</p><h2>Tempo</h2><p>Ein langsames, gleichmäßiges Tempo ist ein allgemeiner Gedanke, kein Trainingsplan.</p><h2>Bewegung</h2><p>Alltägliche Bewegung, zum Beispiel Gehen oder Aufstehen, kann sich leicht anfühlen. Ob sie passt, klärst du bei Einschränkungen ärztlich.</p><p>Kein medizinischer Rat. Keine Heilversprechen.</p></div></div>';
  }

  function renderStart() {
    return '<div class="view">' + headerBlock() + storageBanner() + '<p class="fine">Notizen nur auf diesem Gerät. Kein medizinischer Rat.</p><form data-form="start" class="stack" method="post" action="#start">' + themeFields() + '<button class="btn" type="submit" data-testid="onboarding-continue">Weiter</button></form></div>';
  }

  function renderLicenses() {
    if (!licenseText) {
      fetch("lizenzen.md").then(function (res) { return res.text(); }).then(function (text) {
        licenseText = text;
        render();
      }).catch(function () { licenseText = "Die Bildnachweise konnten nicht geladen werden."; render(); });
    }
    return '<div class="view">' + backBtn("profil") + "<header><h1>Bildnachweise</h1></header><pre class=\"license\">" + esc(licenseText || "Die Nachweise werden geladen.") + "</pre></div>";
  }

  function mediaSlot(pic, alt) {
    return '<span class="pic-slot"><img alt="' + esc(alt) + '" width="' + pic.w + '" height="' + pic.h + '" loading="lazy" src="' + esc(pic.src) + '"' + (pic.srcset ? ' srcset="' + esc(pic.srcset) + '" sizes="' + esc(pic.sizes || "100vw") + '"' : "") + "></span>";
  }

  function pictureSet(folder, file, detail) {
    var full = "img/" + folder + "/" + file;
    var small = full.replace(/\.webp$/, "-400.webp");
    if (detail) return { src: full, srcset: small + " 400w, " + full + " 800w", sizes: "800px", w: 800, h: 600 };
    return { src: small, srcset: "", w: 400, h: 300 };
  }

  function portionStepper(id, portions) {
    var shown = String(portions).replace(".", ",");
    return '<div class="portion-stepper" data-recipe-portions="' + esc(id) + '"><p>' + esc(tx("recipes.servingsLabel")) + '</p><div class="portion-row">' +
      '<button type="button" class="btn secondary portion-btn" data-portion-delta="-1" data-testid="portion-dec" aria-label="' + esc(tx("recipes.servingsDecrease")) + '">−</button>' +
      '<span class="num portion-count" data-portion-value>' + esc(shown) + "</span>" +
      '<button type="button" class="btn secondary portion-btn" data-portion-delta="1" data-testid="portion-inc" aria-label="' + esc(tx("recipes.servingsIncrease")) + '">+</button></div></div>';
  }

  function readPortions(id, fallback) {
    var box = document.querySelector('[data-recipe-portions="' + id + '"]');
    var shown = box && box.querySelector ? box.querySelector("[data-portion-value]") : null;
    if (!shown) return { ok: true, value: fallback };
    return VFND.parseGermanNumber(shown.textContent);
  }

  function renderRecipes() {
    var title = tx("recipes.title");
    var all = catalog.recipes || [];
    var favs = state.recipeFavorites || [];
    var list = all.filter(function (recipe) {
      if (recipeFilter === "gemerkt") return favs.indexOf(recipe.id) >= 0;
      if (recipeFilter && recipeFilter !== "alle") return recipe.category === recipeFilter;
      return true;
    });
    function chip(id, label) {
      var on = recipeFilter === id ? "true" : "false";
      return '<button type="button" class="chip" data-recipe-filter="' + esc(id) + '" aria-pressed="' + on + '">' + esc(label) + "</button>";
    }
    var chips = '<div class="chips" role="group" aria-label="' + esc(tx("recipes.filterLabel")) + '">' + chip("alle", tx("recipes.filterAll")) + chip("gemerkt", tx("recipes.favoritesFilter")) + (catalog.categories || []).map(function (cat) { return chip(cat.id, cat.label); }).join("") + "</div>";
    var countText = list.length === 1 ? tx("recipes.resultCountOne") : tx("recipes.resultCount", { count: String(list.length) });
    var body = list.length ? '<div class="recipe-grid">' + list.map(recipeCard).join("") + "</div>" : '<section class="panel" data-testid="recipes-empty"><h2>' + esc(recipeFilter === "gemerkt" ? tx("recipes.emptyFavoritesTitle") : tx("recipes.emptySearchTitle")) + "</h2><p>" + esc(recipeFilter === "gemerkt" ? tx("recipes.emptyFavoritesText") : tx("recipes.emptySearchText")) + "</p></section>";
    return '<div class="view">' + backToday() + "<header><h1>" + esc(title) + "</h1></header><p>" + esc(tx("recipes.intro")) + "</p>" + chips + '<p class="fine">' + esc(countText) + "</p>" + body + "</div>";
  }

  function recipeCard(recipe) {
    var id = recipe.id;
    var pic = pictureSet("rezepte", "rezept-" + id + ".webp", false);
    var img = mediaSlot(pic, tx("recipes.imageAlt", { title: recipe.title || "" }));
    var kcal = tx("recipes.kcalPerServing", { kcal: VFND.formatInt(recipe.kcalPerServing || 0) });
    var favLabel = (state.recipeFavorites || []).indexOf(id) >= 0 ? tx("recipes.favoriteRemove") : tx("recipes.favoriteAdd");
    return '<article class="panel">' + img + '<h2><button type="button" class="text-link" data-go="rezepte/' + esc(id) + '" data-testid="recipe-open">' + esc(recipe.title || "") + "</button></h2>" +
      '<button type="button" class="btn secondary" data-fav-recipe="' + esc(id) + '">' + esc(favLabel) + "</button>" +
      '<p class="fine">' + esc(tx("recipes.difficulty." + recipe.difficulty)) + " · " + esc(tx("recipes.time", { minutes: String(recipe.timeMinutes || "") })) + "</p><p>" + esc(kcal) + "</p></article>";
  }

  function renderRecipeDetail(id) {
    var recipe = (catalog.recipes || []).filter(function (item) { return item.id === id; })[0];
    if (!recipe) return renderRecipes();
    var pic = pictureSet("rezepte", "rezept-" + recipe.id + ".webp", true);
    var portions = recipe.servings || 1;
    var ingredients = (recipe.ingredients || []).map(function (item) {
      return "<li>" + esc(item.name) + " · " + esc(String(item.amount).replace(".", ",")) + " " + esc(item.unit || "") + "</li>";
    }).join("");
    var steps = (recipe.steps || []).map(function (step, index) {
      return '<li class="step"><span class="step-num" aria-hidden="true">' + (index + 1) + '</span><div><p class="step-label">' + esc(tx("recipes.stepLabel", { number: String(index + 1), total: String(recipe.steps.length) })) + "</p><p>" + esc(step) + "</p></div></li>";
    }).join("");
    return '<div class="view"><button type="button" class="btn secondary back-today" data-go="rezepte" data-testid="back-recipes">‹ ' + esc(tx("recipes.title")) + "</button><header><h1>" + esc(recipe.title || "") + "</h1></header>" +
      mediaSlot(pic, tx("recipes.imageAlt", { title: recipe.title || "" })) +
      "<p>" + esc(tx("recipes.kcalPerServing", { kcal: VFND.formatInt(recipe.kcalPerServing || 0) })) + ' <span class="schaetz">' + esc(tx("common.estimateBadge")) + '</span></p><p class="fine">' + esc(tx("recipes.kcalHint")) + "</p>" +
      "<h2>" + esc(tx("recipes.ingredientsTitle")) + "</h2><ul class=\"plain-list\">" + ingredients + "</ul>" + portionStepper(recipe.id, portions) +
      '<button type="button" class="btn secondary" data-fav-recipe="' + esc(recipe.id) + '">' + esc((state.recipeFavorites || []).indexOf(recipe.id) >= 0 ? tx("recipes.favoriteRemove") : tx("recipes.favoriteAdd")) + "</button>" +
      "<h2>" + esc(tx("recipes.stepsTitle")) + "</h2><ul class=\"steps\">" + steps + "</ul>" +
      '<button type="button" class="btn" data-shop-recipe="' + esc(recipe.id) + '">' + esc(tx("recipes.addToShoppingList")) + '</button><button type="button" class="btn secondary" data-meal-recipe="' + esc(recipe.id) + '">' + esc(tx("recipes.logAsMeal")) + "</button></div>";
  }

  function renderShopping() {
    var lines = buildShoppingLines();
    function lineHtml(line) {
      var checked = state.shopping.checked[line.key] ? " checked" : "";
      var qty = line.packages ? tx("shoppingList.itemPackages", { count: String(line.packages), packageSize: formatQty(line.packageSize), packageUnit: line.packageUnit || "" }) : tx("shoppingList.itemAmount", { amount: formatQty(line.amount), unit: line.unit });
      var from = line.titles && line.titles.length ? tx("shoppingList.fromRecipes", { recipeTitles: line.titles.join(", ") }) : "";
      var shown = line.estimate ? formatPrice(line.estimate.eur) : "";
      var badge = line.ownPrice ? '<span class="schaetz own" data-testid="own-price-badge">' + esc(tx("shoppingList.ownPriceLabel")) + "</span>" : (line.estimate ? '<span class="schaetz">' + esc(tx("common.estimateBadge")) + "</span>" : "");
      var valueLine = line.ownPrice ? '<span class="sr-only">' + esc(tx("shoppingList.ownPriceValue", { price: shown })) + "</span>" : "";
      var reset = line.ownPrice ? '<button type="button" class="btn secondary" data-shop-price-reset="' + esc(line.key) + '">' + esc(tx("common.delete")) + "</button>" : "";
      return '<div class="shop-line' + (line.ownPrice ? " own" : "") + '"><label><input type="checkbox" data-shop-check="' + esc(line.key) + '"' + checked + ' aria-label="' + esc(tx("shoppingList.check")) + " " + esc(line.name) + '"></label><span class="shop-copy"><strong>' + esc(line.name) + "</strong><span>" + esc(qty + (from ? " · " + from : "")) + '</span><span class="price-row"><label class="sr-only" for="price-' + esc(line.key) + '">' + esc(tx("shoppingList.ownPriceLabel")) + '</label><input id="price-' + esc(line.key) + '" class="price-field' + (line.ownPrice ? " own" : "") + '" data-shop-price="' + esc(line.key) + '" inputmode="decimal" placeholder="' + esc(tx("shoppingList.ownPricePlaceholder")) + '" value="' + esc(shown) + '">' + valueLine + badge + reset + "</span></span></div>";
    }
    var rows = "";
    if (!lines.length) {
      rows = '<section class="panel" data-testid="shop-empty"><h2>' + esc(tx("shoppingList.emptyTitle")) + "</h2><p>" + esc(tx("shoppingList.emptyText")) + '</p><button type="button" class="btn" data-go="rezepte">' + esc(tx("shoppingList.emptyButton")) + "</button></section>";
    } else {
      var order = (catalog.priceCategories || []).map(function (cat) { return cat.id; });
      var buckets = {};
      lines.forEach(function (line) {
        var id = line.category || "sonst";
        if (!buckets[id]) buckets[id] = [];
        buckets[id].push(line);
        if (order.indexOf(id) < 0) order.push(id);
      });
      rows = order.filter(function (id) { return buckets[id]; }).map(function (id) {
        var label = ((catalog.priceCategories || []).filter(function (cat) { return cat.id === id; })[0] || {}).label || "";
        return '<section class="panel"><h2>' + esc(label) + '</h2><div class="stack">' + buckets[id].map(lineHtml).join("") + "</div></section>";
      }).join("");
    }
    var openLines = lines.filter(function (line) { return !state.shopping.checked[line.key]; });
    var checkedLines = lines.filter(function (line) { return state.shopping.checked[line.key]; });
    var sum = VFNDShop.sumEstimates(lines);
    var openSum = VFNDShop.sumEstimates(openLines);
    var sumText = sum == null ? "" : tx("shoppingList.total", { total: formatPrice(sum) });
    var openText = openSum == null ? "" : tx("shoppingList.totalOpen", { total: formatPrice(openSum) });
    var checkedBlock = checkedLines.length ? '<section class="panel" data-testid="shop-checked"><h2>' + esc(tx("shoppingList.checkedSection")) + " (" + checkedLines.length + ")</h2><div class=\"stack\">" + checkedLines.map(lineHtml).join("") + "</div></section>" : "";
    if (lines.length) {
      var order = (catalog.priceCategories || []).map(function (cat) { return cat.id; });
      var buckets = {};
      openLines.forEach(function (line) {
        var id = line.category || "sonst";
        if (!buckets[id]) buckets[id] = [];
        buckets[id].push(line);
        if (order.indexOf(id) < 0) order.push(id);
      });
      rows = order.filter(function (id) { return buckets[id]; }).map(function (id) {
        var label = ((catalog.priceCategories || []).filter(function (cat) { return cat.id === id; })[0] || {}).label || "";
        return '<section class="panel"><h2>' + esc(label) + '</h2><div class="stack">' + buckets[id].map(lineHtml).join("") + "</div></section>";
      }).join("") + checkedBlock;
    }
    var note = shopNote ? '<p data-testid="shop-note">' + esc(shopNote) + "</p>" : "";
    var confirmChecked = shopConfirm === "checked" ? '<div class="sheet-scrim" data-testid="clear-checked-dialog"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="clear-checked-title"><h2 id="clear-checked-title">' + esc(tx("shoppingList.clearCheckedConfirmTitle")) + "</h2><p>" + esc(tx("shoppingList.clearCheckedConfirmText")) + '</p><button type="button" class="btn danger" data-shop-confirm="checked">' + esc(tx("shoppingList.clearCheckedConfirmButton")) + '</button><button type="button" class="btn secondary" data-shop-confirm="cancel">' + esc(tx("common.cancel")) + "</button></section></div>" : "";
    return '<div class="view">' + backToday() + "<header><h1>" + esc(tx("shoppingList.title")) + "</h1></header><p>" + esc(tx("shoppingList.intro")) + "</p>" + note + (sumText ? '<section class="panel" data-testid="shop-sum"><p>' + esc(tx("shoppingList.totalLabel")) + ": " + esc(sumText) + "</p>" + (openText ? "<p>" + esc(openText) + "</p>" : "") + '<p class="fine">' + esc(tx("shoppingList.totalHint")) + "</p></section>" : '<p data-testid="shop-sum" class="fine">' + esc(tx("shoppingList.priceUnknown")) + "</p>") + '<p class="fine">' + esc(tx("shoppingList.pantryHint")) + "</p>" + rows + '<div class="stack"><button type="button" class="btn secondary" data-shop-clear="checked">' + esc(tx("shoppingList.clearChecked")) + '</button><button type="button" class="btn danger" data-shop-clear="all">' + esc(tx("shoppingList.clearAll")) + "</button></div>" + confirmChecked +
      '<form data-form="shop-manual" class="stack" method="post" action="#einkauf"><label>' + esc(tx("shoppingList.addItemLabel")) + '<input name="name" maxlength="80" autocomplete="off"></label><label>' + "Menge" + '<input name="amount" inputmode="decimal" autocomplete="off"></label><label>Einheit<input name="unit" maxlength="20" autocomplete="off"></label><button class="btn" type="submit">' + esc(tx("shoppingList.addItemButton")) + "</button></form></div>";
  }

  function currentLevel() {
    var plan = catalog.training || {};
    var id = state.settings.trainingLevel || "einstieg";
    return ((plan.levels || []).filter(function (item) { return item.id === id; })[0]) || (plan.levels || [])[0] || null;
  }

  function safetySheet() {
    var safety = (catalog.training || {}).safety || {};
    if (state.settings.trainingAck && !safetyPeek) return "";
    var points = (safety.points || []).map(function (point) { return "<li>" + esc(point) + "</li>"; }).join("");
    return '<div class="sheet-scrim" data-testid="safety-sheet"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="safety-title"><h2 id="safety-title">' + esc(safety.title || tx("training.safetyTitle")) + "</h2><ul>" + points + '</ul><p class="fine">' + esc(safety.disclaimer || tx("common.noMedicalAdvice")) + '</p><button type="button" class="btn" data-train-ack="1">' + esc(safety.confirmLabel || tx("training.safetyConfirm")) + "</button></section></div>";
  }

  function renderTraining() {
    var plan = catalog.training || {};
    var level = currentLevel();
    var todayPlan = VFND.planForDate(level, new Date());
    var week = level ? '<ol class="week">' + level.days.map(function (day) {
      var on = todayPlan && day.day === todayPlan.day;
      return '<li class="' + (on ? "is-today" : "") + '"><span>' + esc(day.label) + "</span>" + (on ? "<span>" + esc(tx("training.today")) + "</span>" : "") + "</li>";
    }).join("") + "</ol>" : "";
    var todayText = tx("training.dayRest");
    var start = "";
    if (todayPlan && todayPlan.kind === "gehen") todayText = tx("training.dayWalk");
    else if (todayPlan && todayPlan.kind === "training") {
      todayText = tx("training.dayExercises", { count: String((todayPlan.exerciseIds || []).length), minutes: String(level && level.approxMinutesPerSession || "") });
      if ((todayPlan.exerciseIds || []).length) start = '<button type="button" class="btn" data-start-session="1" data-testid="start-session">' + esc(tx("training.startSession")) + "</button>";
    }
    var done = state.trainingDone && state.trainingDone[todayKey()] ? '<p data-testid="session-done">' + esc(tx("training.sessionDoneShort")) + "</p>" : "";
    var levels = '<div class="stack" aria-label="' + esc(tx("training.levelLabel")) + '">' + (plan.levels || []).map(function (item) {
      return '<button type="button" class="btn ' + (level && item.id === level.id ? "" : "secondary") + '" data-train-level="' + esc(item.id) + '">' + esc(item.label) + "</button>";
    }).join("") + "</div>";
    return '<div class="view">' + backToday() + "<header><h1>" + esc(tx("training.title")) + "</h1></header><p>" + esc(tx("training.intro")) + '</p><section class="notice"><h2>' + esc(tx("training.safetyTitle")) + "</h2><p>" + esc(tx("training.safetyShort")) + '</p><button type="button" class="btn secondary" data-safety-open="1">' + esc(tx("training.safetyOpen")) + "</button></section>" + levels + "<h2>" + esc(tx("training.weekTitle")) + "</h2>" + week + "<p>" + esc(todayText) + "</p>" + done + start + '<p class="fine">' + esc(tx("training.missedDayHint")) + "</p>" + safetySheet() + "</div>";
  }

  function renderExercise(indexText) {
    var level = currentLevel();
    var todayPlan = VFND.planForDate(level, new Date());
    var ids = (todayPlan && todayPlan.exerciseIds) || [];
    var index = Math.max(0, parseInt(indexText, 10) || 0);
    if (!ids.length || index >= ids.length) return renderTraining();
    var item = ((catalog.training || {}).exercises || []).filter(function (entry) { return entry.id === ids[index]; })[0];
    if (!item) return renderTraining();
    var dose = (item.dose && level && item.dose[level.id]) || {};
    var pic = pictureSet("training", "uebung-" + item.id + ".webp", true);
    var steps = (item.steps || []).map(function (step, stepIndex) {
      return '<li class="step"><span class="step-num" aria-hidden="true">' + (stepIndex + 1) + '</span><p>' + esc(step) + "</p></li>";
    }).join("");
    if (dose.durationSeconds && timer.forId !== item.id) {
      stopTimer();
      timer.forId = item.id;
      timer.total = dose.durationSeconds;
      timer.left = dose.durationSeconds;
      timer.started = 0;
    }
    var clock = VFND.timerSnapshot(timer.total || dose.durationSeconds || 0, timer.running ? Math.floor((Date.now() - timer.started) / 1000) : (timer.total - timer.left));
    var timerHtml = dose.durationSeconds ? '<div class="timer" data-testid="timer"><p class="remain-num"><span class="num" data-testid="timer-left">' + clock.left + '</span> s</p><p data-testid="timer-done"' + (clock.done ? "" : " hidden") + ">" + esc(tx("training.timerDone")) + '</p><div class="stack"><button type="button" class="btn" data-timer="start">' + esc(tx("training.timerStart")) + '</button><button type="button" class="btn secondary" data-timer="pause">' + esc(tx("training.timerPause")) + '</button><button type="button" class="btn secondary" data-timer="resume">' + esc(tx("training.timerResume")) + "</button></div></div>" : "";
    return '<div class="view"><button type="button" class="btn secondary back-today" data-go="training" data-testid="back-training">‹ ' + esc(tx("nav.training")) + "</button><p>" + esc(tx("training.exerciseCounter", { number: String(index + 1), total: String(ids.length) })) + "</p><header><h1>" + esc(item.name) + "</h1></header>" +
      mediaSlot(pic, tx("training.imageAlt", { name: item.name })) + '<p class="stop-box">' + esc(tx("training.stopHint")) + "</p><p class=\"remain-num\">" + esc(dose.label || "") + "</p><p><strong>" + esc(tx("training.equipmentLabel")) + "</strong> " + esc(item.equipment || "") + "</p>" + timerHtml + '<ul class="steps">' + steps + '</ul><div class="stack"><button type="button" class="btn" data-next-exercise="' + index + '">' + esc(tx("training.nextExercise")) + '</button><button type="button" class="btn secondary" data-skip-exercise="' + index + '">' + esc(tx("training.skipExercise")) + '</button><button type="button" class="btn secondary" data-end-session="1">' + esc(tx("training.endSession")) + "</button></div></div>";
  }

  function scanPortionLine(product, raw) {
    var kcal = product && product.per100 ? product.per100.kcal : null;
    var parsed = VFND.parseGermanNumber(raw);
    if (kcal == null || !parsed.ok || parsed.value <= 0) return "";
    var scaled = VFND.scaleNutrient(kcal, parsed.value);
    return tx("scan.resultTotal", { amount: VFND.formatMacro(parsed.value), kcal: VFND.formatInt(Math.round(scaled)) });
  }

  function scanResultHtml() {
    if (!scanProduct) return "";
    var kcal = scanProduct.per100 ? scanProduct.per100.kcal : null;
    var nameLine = kcal == null ? esc(scanProduct.name) : esc(tx("scan.resultItem", { name: scanProduct.name, kcal: VFND.formatInt(kcal) }));
    var missing = kcal == null ? '<p data-testid="scan-nutrition">' + esc(tx("scan.errors.nutritionMissing")) + "</p>" : "";
    var grams = scanGrams || (scanProduct.servingGrams ? String(scanProduct.servingGrams).replace(".", ",") : "100");
    var meals = VFND.SLOTS.map(function (slot) {
      return '<button type="button" class="btn' + (slot.id === scanSlot ? "" : " secondary") + '" data-scan-slot="' + slot.id + '" aria-pressed="' + (slot.id === scanSlot ? "true" : "false") + '">' + esc(slot.label) + "</button>";
    }).join("");
    var amount = kcal == null ? "" : '<div class="portion-row"><button type="button" class="btn secondary portion-btn" data-gram-delta="-50" aria-label="' + esc(tx("scan.amountLabel")) + '">−</button><label>' + esc(tx("scan.amountLabel")) + '<input id="scan-grams" data-testid="scan-grams" inputmode="decimal" autocomplete="off" value="' + esc(grams) + '"></label><button type="button" class="btn secondary portion-btn" data-gram-delta="50" aria-label="' + esc(tx("scan.amountLabel")) + '">+</button></div><p data-testid="scan-total">' + esc(scanPortionLine(scanProduct, grams)) + "</p>";
    var save = kcal == null ? "" : '<p>' + esc(tx("scan.mealSlotLabel")) + '</p><div class="stack">' + meals + '</div><button type="button" class="btn" id="scan-save" data-testid="scan-save">' + esc(tx("scan.saveButton")) + "</button>";
    return '<div class="sheet-scrim" data-testid="scan-result"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="scan-result-title"><h2 id="scan-result-title">' + esc(tx("scan.resultTitle")) + "</h2><p>" + nameLine + "</p>" + nutriscoreHtml(scanProduct.nutriscore) + missing +
      (kcal == null ? "" : '<p class="fine">' + esc(tx("scan.estimateHint")) + "</p>") + amount + save +
      '<button type="button" class="btn secondary" id="scan-again" data-testid="scan-again">' + esc(tx("scan.scanAgain")) + "</button>" +
      '<p class="fine">' + esc(tx("scan.sourceLabel")) + "</p></section></div>";
  }

  function scanQrHtml() {
    if (!scanQr) return "";
    return '<section class="panel" data-testid="scan-qr"><h2>' + esc(tx("scan.qrTitle")) + "</h2><p>" + esc(tx("scan.qrIntro")) + "</p><p>" + esc(tx("scan.qrContent", { qrText: scanQr })) + "</p><p>" + esc(tx("scan.qrLinkHint")) + "</p><p>" + esc(tx("scan.qrNoFood")) + "</p></section>";
  }

  function renderScanner() {
    var tips = (texts.scan && texts.scan.tips) || [];
    var status = scanMessage ? '<p id="scan-status" data-testid="scan-status" class="panel">' + esc(scanMessage) + "</p>" : '<p id="scan-status" data-testid="scan-status" class="panel" hidden></p>';
    var live = scanLive ? "" : " hidden";
    var idle = scanLive ? " hidden" : "";
    var back = scanOrigin === "mahlzeiten" ? '<button type="button" class="btn secondary back-today" data-go="mahlzeiten" data-testid="back-meals">‹ Mahlzeiten</button>' : backToday();
    return '<div class="view">' + back + "<header><h1>" + esc(tx("scan.title")) + "</h1></header>" +
      "<p>" + esc(tx("scan.intro")) + "</p>" +
      '<div class="camera-stage" data-testid="scan-frame"><p class="camera-hint">' + esc(tx("scan.scanning")) + '</p><span class="scan-line"' + live + '></span><video id="scan-video" data-testid="scan-video" playsinline webkit-playsinline muted autoplay' + live + ' aria-label="' + esc(tx("scan.title")) + '"></video></div>' +
      '<div class="stack"><button type="button" class="btn with-icon" id="scan-start" data-testid="scan-start"' + idle + ">" + svg("camera") + "<span>" + esc(tx("scan.startButton")) + '</span></button><button type="button" class="btn secondary" id="scan-stop" data-testid="scan-stop"' + live + ">" + esc(tx("scan.stopButton")) + "</button></div>" +
      '<section class="panel" data-testid="scan-privacy"><h2>' + esc(tx("scan.privacyTitle")) + "</h2><p>" + esc(tx("scan.privacyShort")) + "</p><p>" + esc(tx("scan.privacyHint")) + "</p></section>" +
      status + scanResultHtml() + scanQrHtml() +
      "<h2>" + esc(tx("scan.tipsTitle")) + "</h2><ul>" + tips.map(function (tip) { return "<li>" + esc(tip) + "</li>"; }).join("") + "</ul>" +
      '<button type="button" class="btn secondary" data-go="mahlzeiten">' + esc(tx("scan.manualEntry")) + "</button></div>";
  }

  function buildShoppingLines() {
    var lines = VFNDShop.planShopping(state.shopping.picks, catalog.recipes, catalog.prices, state.shopping.manual);
    lines = lines.filter(function (line) { return !(state.shopping.hidden && state.shopping.hidden[line.key]); });
    return VFNDShop.applyOverrides(lines, state.shopping.priceOverrides);
  }

  function formatQty(n) {
    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(n);
  }

  function formatPrice(n) {
    return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  function formatEur(n) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
  }

  function render() {
    var current = route();
    var view = document.getElementById("view");
    var html;
    if (!state.settings.onboarded && current.name === "dashboard" && (!location.hash || location.hash === "#" || location.hash === "#/" || location.hash === "#/dashboard")) {
      location.hash = "#/start";
      return;
    }
    if (current.name === "dashboard") html = renderDashboard();
    else if (current.name === "heute") html = renderHeute();
    else if (current.name === "mahlzeiten") html = renderMeals();
    else if (current.name === "fortschritt") html = renderProgress();
    else if (current.name === "wasser") html = renderWater();
    else if (current.name === "profil") html = renderProfile();
    else if (current.name === "hinweise") html = renderHinweise();
    else if (current.name === "lizenzen") html = renderLicenses();
    else if (current.name === "rezepte") html = current.extra ? renderRecipeDetail(current.extra) : renderRecipes();
    else if (current.name === "einkauf") html = renderShopping();
    else if (current.name === "training") html = current.extra === "uebung" ? renderExercise(current.more) : renderTraining();
    else if (current.name === "scanner") html = renderScanner();
    else html = renderStart();
    view.innerHTML = html;
    var map = { dashboard: "tab-dashboard", heute: "tab-dashboard", start: "tab-dashboard", wasser: "tab-dashboard", scanner: scanOrigin === "mahlzeiten" ? "tab-meals" : "tab-dashboard", rezepte: "tab-dashboard", einkauf: "tab-dashboard", training: "tab-dashboard", mahlzeiten: "tab-meals", fortschritt: "tab-progress", profil: "tab-profile", hinweise: "tab-profile", lizenzen: "tab-profile" };
    ["tab-dashboard", "tab-meals", "tab-progress", "tab-profile"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      if (map[current.name] === id) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    var routeKey = current.name + "/" + (current.extra || "");
    if (routeKey !== lastRoute) {
      var heading = view.querySelector("h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
      lastRoute = routeKey;
    }
    if (current.name === "mahlzeiten" && current.extra) {
      var slot = document.getElementById("slot-" + current.extra);
      if (slot) slot.scrollIntoView({ block: "start" });
    }
    animateRings();
    document.querySelectorAll("[data-grams]").forEach(function (input) { updatePreview(input); });
  }

  function animateRings() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll(".ring-value").forEach(function (el) {
      var target = el.getAttribute("stroke-dashoffset");
      var full = el.getAttribute("stroke-dasharray");
      el.setAttribute("stroke-dashoffset", full);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.setAttribute("stroke-dashoffset", target); });
      });
    });
  }

  function portionPreview(product, grams) {
    if (grams == null) return "Gramm eintragen, dann wird die Portion aus den Werten je 100 g berechnet.";
    var labels = { kcal: "Kalorien", protein: "Eiweiß", carbs: "Kohlenhydrate", fat: "Fett" };
    return ["kcal", "protein", "carbs", "fat"].map(function (key) {
      var raw = product.per100[key];
      if (raw == null) return labels[key] + ": nicht angegeben";
      var scaled = VFND.scaleNutrient(raw, grams);
      var shown = key === "kcal" ? VFND.formatInt(Math.round(scaled)) + " kcal" : VFND.formatMacro(Math.round(scaled * 10) / 10) + " g";
      var base = key === "kcal" ? VFND.formatInt(raw) : VFND.formatMacro(raw);
      return labels[key] + ": " + base + " je 100 g × " + VFND.formatMacro(grams) + " ÷ 100 = " + shown;
    }).join(". ");
  }

  function updatePreview(input) {
    var box = input.closest("[data-off-index]");
    if (!box) return;
    var product = offResults[Number(box.getAttribute("data-off-index"))];
    var out = box.querySelector("[data-preview]");
    if (!product || !out) return;
    if (!String(input.value || "").trim()) {
      out.textContent = portionPreview(product, null);
      return;
    }
    var parsed = VFND.parseGermanNumber(input.value);
    out.textContent = parsed.ok && parsed.value > 0 ? portionPreview(product, parsed.value) : "Bitte Gramm als Zahl eingeben.";
  }

  function addOff(index) {
    var product = offResults[index];
    if (!product) return;
    var box = document.querySelector('[data-off-index="' + index + '"]');
    var input = box ? box.querySelector("[data-grams]") : null;
    var parsed = VFND.parseGermanNumber(input ? input.value : "");
    if (!parsed.ok || parsed.value <= 0 || parsed.value > 5000) {
      formError = "Bitte die Portion in Gramm eintragen.";
      render();
      return;
    }
    var portion = VFND.scalePortion(product.per100, parsed.value);
    var current = route();
    var slot = VFND.SLOTS.some(function (s) { return s.id === current.extra; }) ? current.extra : "fruehstueck";
    if (portion.kcal == null) {
      prefill = { slot: slot, name: product.name, kcal: "", protein: portion.protein, carbs: portion.carbs, fat: portion.fat };
      formError = tx("scan.errors.nutritionMissing") || "Kalorien fehlen in den Daten. Bitte selbst eintragen. Fehlende Nährwerte bleiben leer und werden nicht als 0 gespeichert.";
      render();
      return;
    }
    var added = VFND.addMeal(state, selectedDate, slot, {
      name: product.name,
      kcal: portion.kcal,
      protein: portion.protein,
      carbs: portion.carbs,
      fat: portion.fat,
      grams: portion.grams,
      source: "off",
      offCode: product.code
    });
    if (!added.ok) {
      formError = "Der Eintrag konnte nicht gespeichert werden.";
      render();
      return;
    }
    var withRecent = VFND.rememberFood(added.state, product, "recent");
    formError = "";
    prefill = null;
    commit(withRecent.ok ? withRecent.state : added.state, "Gespeichert");
  }

  function stopTimer() {
    timer.running = false;
    if (timer.handle) clearInterval(timer.handle);
    timer.handle = 0;
  }

  function timerLeftNow() {
    if (!timer.running) return timer.left;
    return Math.max(0, timer.left - Math.floor((Date.now() - timer.started) / 1000));
  }

  function paintTimer() {
    var left = timerLeftNow();
    var node = document.querySelector("[data-testid=timer-left]");
    var done = document.querySelector("[data-testid=timer-done]");
    if (node) node.textContent = String(left);
    if (left <= 0 && timer.running) {
      timer.left = 0;
      timer.running = false;
      if (timer.handle) clearInterval(timer.handle);
    }
    if (done) done.hidden = left > 0;
  }

  function finishTraining() {
    stopTimer();
    if (!state.trainingDone) state.trainingDone = {};
    state.trainingDone[todayKey()] = true;
    VFND.saveState(localStorage, state);
    location.hash = "#/training";
  }

  function onClick(event) {
    var go = event.target.closest("[data-go]");
    if (go) {
      if (go.getAttribute("data-go") === "scanner") scanOrigin = go.getAttribute("data-testid") === "meals-scan" ? "mahlzeiten" : "dashboard";
      location.hash = "#/" + go.getAttribute("data-go");
      return;
    }
    var shift = event.target.closest("[data-shift]");
    if (shift) {
      var today = todayKey();
      var next = VFND.addDays(selectedDate, Number(shift.getAttribute("data-shift")));
      if (next <= today) selectedDate = next;
      render();
      return;
    }
    var del = event.target.closest("[data-del]");
    if (del) {
      var removed = VFND.removeMeal(state, selectedDate, del.getAttribute("data-del"));
      if (removed.ok) commit(removed.state, "Gespeichert");
      return;
    }
    var glass = event.target.closest("[data-glass]");
    if (glass) {
      var n = Number(glass.getAttribute("data-glass"));
      var cur = (state.days[selectedDate] && state.days[selectedDate].water) || 0;
      var water = VFND.setWater(state, selectedDate, cur === n ? n - 1 : n);
      if (water.ok) commit(water.state, "Gespeichert");
      return;
    }
    var step = event.target.closest("[data-water-step]");
    if (step) {
      var currentWater = (state.days[selectedDate] && state.days[selectedDate].water) || 0;
      var stepped = VFND.setWater(state, selectedDate, currentWater + Number(step.getAttribute("data-water-step")));
      if (stepped.ok) commit(stepped.state, "Gespeichert");
      return;
    }
    var add = event.target.closest("[data-add-off]");
    if (add) {
      addOff(Number(add.getAttribute("data-add-off")));
      return;
    }
    var fav = event.target.closest("[data-fav]");
    if (fav) {
      var product = offResults[Number(fav.getAttribute("data-fav"))];
      var remembered = VFND.rememberFood(state, product, "favorites");
      if (remembered.ok) commit(remembered.state, "Gespeichert");
      return;
    }
    var use = event.target.closest("[data-use-snap]");
    if (use) {
      var bucket = use.getAttribute("data-bucket") === "favorites" ? state.favorites : state.recent;
      var snap = bucket[Number(use.getAttribute("data-use-snap"))];
      if (!snap) return;
      offResults = [Object.assign({ imageUrl: null }, snap)];
      offError = "";
      var panel = document.getElementById("off-panel");
      render();
      return;
    }
    if (event.target.closest("[data-clear-move]")) {
      var cleared = VFND.setMovement(state, selectedDate, null);
      if (cleared.ok) commit(cleared.state, "Gespeichert");
      return;
    }
    var delW = event.target.closest("[data-del-weight]");
    if (delW) {
      var without = VFND.removeWeight(state, delW.getAttribute("data-del-weight"));
      if (without.ok) commit(without.state, "Gespeichert");
      return;
    }
    var portionDelta = event.target.closest("[data-portion-delta]");
    if (portionDelta) {
      var portionBox = portionDelta.closest("[data-recipe-portions]");
      var shown = portionBox && portionBox.querySelector("[data-portion-value]");
      if (shown) {
        var current = VFND.parseGermanNumber(shown.textContent);
        var next = (current.ok ? current.value : 1) + Number(portionDelta.getAttribute("data-portion-delta"));
        if (next < 1) next = 1;
        if (next > 20) next = 20;
        shown.textContent = String(Math.round(next * 10) / 10).replace(".", ",");
      }
      return;
    }
    var shopRecipe = event.target.closest("[data-shop-recipe]");
    if (shopRecipe) {
      addRecipePick(shopRecipe.getAttribute("data-shop-recipe"));
      return;
    }
    var mealRecipe = event.target.closest("[data-meal-recipe]");
    if (mealRecipe) {
      addRecipeMeal(mealRecipe.getAttribute("data-meal-recipe"));
      return;
    }
    var shopDel = event.target.closest("[data-shop-del]");
    if (shopDel) {
      var nextShop = VFND.clone ? null : null;
      state.shopping.manual = state.shopping.manual.filter(function (item) { return item.id !== shopDel.getAttribute("data-shop-del"); });
      commit(VFND.setShopping(state, state.shopping), "Gespeichert");
      return;
    }
    var trainDel = event.target.closest("[data-train-del]");
    if (trainDel) {
      var removedTrain = VFND.removeTraining(state, todayKey(), trainDel.getAttribute("data-train-del"));
      if (removedTrain.ok) commit(removedTrain.state, "Gespeichert");
      return;
    }
    var filterBtn = event.target.closest("[data-recipe-filter]");
    if (filterBtn) {
      recipeFilter = filterBtn.getAttribute("data-recipe-filter");
      render();
      return;
    }
    var favRecipe = event.target.closest("[data-fav-recipe]");
    if (favRecipe) {
      var favId = favRecipe.getAttribute("data-fav-recipe");
      var favList = state.recipeFavorites || [];
      state.recipeFavorites = favList.indexOf(favId) >= 0 ? favList.filter(function (id) { return id !== favId; }) : favList.concat([favId]);
      VFND.saveState(localStorage, state);
      render();
      return;
    }
    var gramBtn = event.target.closest("[data-gram-delta]");
    if (gramBtn) {
      var parsedGrams = VFND.parseGermanNumber(scanGrams || "100");
      var grams = (parsedGrams.ok ? parsedGrams.value : 100) + Number(gramBtn.getAttribute("data-gram-delta"));
      if (grams < 1) grams = 1;
      if (grams > 5000) grams = 5000;
      scanGrams = String(grams).replace(".", ",");
      render();
      return;
    }
    var mealPick = event.target.closest("[data-scan-slot]");
    if (mealPick) {
      scanSlot = mealPick.getAttribute("data-scan-slot");
      render();
      return;
    }
    var priceReset = event.target.closest("[data-shop-price-reset]");
    if (priceReset) {
      delete state.shopping.priceOverrides[priceReset.getAttribute("data-shop-price-reset")];
      state = VFND.setShopping(state, state.shopping);
      VFND.saveState(localStorage, state);
      render();
      return;
    }
    var shopClear = event.target.closest("[data-shop-clear]");
    if (shopClear) {
      var mode = shopClear.getAttribute("data-shop-clear");
      if (mode === "all") {
        if (!window.confirm(tx("shoppingList.clearAllConfirmTitle") + "\n" + tx("shoppingList.clearAllConfirmText"))) return;
        state.shopping.picks = [];
        state.shopping.manual = [];
        state.shopping.checked = {};
        state.shopping.priceOverrides = {};
        state.shopping.hidden = {};
      } else {
        shopConfirm = "checked";
        render();
        return;
      }
      state = VFND.setShopping(state, state.shopping);
      VFND.saveState(localStorage, state);
      render();
      return;
    }
    var shopConfirmBtn = event.target.closest("[data-shop-confirm]");
    if (shopConfirmBtn) {
      var answer = shopConfirmBtn.getAttribute("data-shop-confirm");
      if (answer === "checked") {
        if (!state.shopping.hidden) state.shopping.hidden = {};
        Object.keys(state.shopping.checked || {}).forEach(function (key) {
          if (state.shopping.checked[key]) state.shopping.hidden[key] = true;
        });
        state.shopping.checked = {};
        shopNote = tx("shoppingList.clearedChecked");
        state = VFND.setShopping(state, state.shopping);
        VFND.saveState(localStorage, state);
        announce(shopNote);
      }
      shopConfirm = "";
      render();
      return;
    }
    if (event.target.closest("[data-safety-open]")) {
      safetyPeek = true;
      render();
      return;
    }
    if (event.target.closest("[data-start-session]")) {
      location.hash = "#/training/uebung/0";
      return;
    }
    var timerBtn = event.target.closest("[data-timer]");
    if (timerBtn) {
      var action = timerBtn.getAttribute("data-timer");
      if (action === "start" || action === "resume") {
        timer.left = timerLeftNow();
        if (timer.left <= 0) timer.left = timer.total;
        timer.started = Date.now();
        timer.running = true;
        if (timer.handle) clearInterval(timer.handle);
        timer.handle = setInterval(paintTimer, 250);
      } else if (action === "pause") {
        timer.left = timerLeftNow();
        timer.running = false;
        if (timer.handle) clearInterval(timer.handle);
      }
      paintTimer();
      return;
    }
    var nextEx = event.target.closest("[data-next-exercise], [data-skip-exercise]");
    if (nextEx) {
      stopTimer();
      var nextIndex = Number(nextEx.getAttribute("data-next-exercise") || nextEx.getAttribute("data-skip-exercise")) + 1;
      var planNow = VFND.planForDate(currentLevel(), new Date());
      var count = planNow && planNow.exerciseIds ? planNow.exerciseIds.length : 0;
      if (nextIndex >= count) finishTraining();
      else location.hash = "#/training/uebung/" + nextIndex;
      return;
    }
    if (event.target.closest("[data-end-session]")) {
      if (!window.confirm(tx("training.endSessionConfirm"))) return;
      finishTraining();
      return;
    }
    if (event.target.closest("[data-train-ack]")) {
      state.settings.trainingAck = true;
      safetyPeek = false;
      VFND.saveState(localStorage, state);
      render();
      return;
    }
    var levelBtn = event.target.closest("[data-train-level]");
    if (levelBtn) {
      state.settings.trainingLevel = levelBtn.getAttribute("data-train-level");
      VFND.saveState(localStorage, state);
      render();
      return;
    }
    if (event.target.closest("#scan-start")) {
      startScan();
      return;
    }
    if (event.target.closest("#scan-stop")) {
      stopScan();
      scanMessage = tx("scan.cameraStopped");
      var status = document.getElementById("scan-status");
      if (status) { status.hidden = false; status.textContent = scanMessage; }
      return;
    }
    if (event.target.closest("#scan-again")) {
      scanProduct = null;
      scanQr = "";
      scanGrams = "";
      scanMessage = "";
      render();
      return;
    }
    if (event.target.closest("#scan-save")) {
      saveScan();
      return;
    }
    if (event.target.closest("#reset-open")) {
      var dialog = document.getElementById("reset-dialog");
      if (dialog && dialog.showModal) dialog.showModal();
      else if (window.confirm("Alle lokalen Einträge löschen?")) {
        commit(VFND.resetKeepingDisplay(state), "Gelöscht");
      }
      return;
    }
    if (event.target.closest("[data-undo]")) {
      if (!undoSnap) return;
      state = undoSnap;
      undoSnap = null;
      VFND.saveState(localStorage, state);
      document.getElementById("toast").hidden = true;
      announce("Rückgängig");
      render();
    }
  }

  function firstError(checks) {
    var i;
    for (i = 0; i < checks.length; i += 1) if (!checks[i].ok) return checks[i].error;
    return "";
  }

  function onSubmit(event) {
    var form = event.target;
    if (!form || !form.getAttribute) return;
    var kind = form.getAttribute("data-form");
    if (!kind) return;
    event.preventDefault();
    var data = new FormData(form);
    if (kind === "manual") {
      var name = VFND.validateName(data.get("title"));
      var kcal = VFND.validateKcal(data.get("kcal"), true);
      var protein = VFND.validateMacro(data.get("protein"));
      var carbs = VFND.validateMacro(data.get("carbs"));
      var fat = VFND.validateMacro(data.get("fat"));
      var problem = firstError([name, kcal, protein, carbs, fat]);
      if (problem) {
        formError = problem;
        prefill = {
          slot: form.getAttribute("data-slot"),
          name: String(data.get("title") || ""),
          kcal: String(data.get("kcal") || ""),
          protein: String(data.get("protein") || ""),
          carbs: String(data.get("carbs") || ""),
          fat: String(data.get("fat") || "")
        };
        render();
        return;
      }
      var added = VFND.addMeal(state, selectedDate, form.getAttribute("data-slot"), {
        name: name.value,
        kcal: kcal.value,
        protein: protein.value,
        carbs: carbs.value,
        fat: fat.value,
        source: "manual"
      });
      if (!added.ok) {
        formError = "Der Eintrag konnte nicht gespeichert werden.";
        render();
        return;
      }
      formError = "";
      prefill = null;
      commit(added.state, "Gespeichert");
      return;
    }
    if (kind === "search") {
      if (offBusy) return;
      var query = VFND.validateSearch(data.get("q"));
      if (!query.ok) {
        offError = query.error;
        offResults = [];
        render();
        return;
      }
      offBusy = true;
      offError = "";
      offResults = [];
      render();
      OFF.searchFoods(query.value).then(function (res) {
        offBusy = false;
        offResults = res.products;
        offError = res.products.length ? "" : "Keine Treffer. Du kannst den Eintrag von Hand anlegen.";
        render();
      }).catch(function (err) {
        offBusy = false;
        offResults = [];
        offError = OFF.messageFor(err);
        render();
      });
      return;
    }
    if (kind === "barcode") {
      if (offBusy) return;
      var code = VFND.validateBarcode(data.get("code"));
      if (!code.ok) {
        offError = code.error;
        render();
        return;
      }
      offBusy = true;
      offError = "";
      render();
      OFF.fetchBarcode(code.value).then(function (res) {
        offBusy = false;
        offResults = res.found ? [res.product] : [];
        offError = res.found ? "" : (tx("scan.errors.productNotFound") || "Kein Eintrag zu diesem Strichcode. Du kannst von Hand eintragen.");
        render();
      }).catch(function (err) {
        offBusy = false;
        offResults = [];
        offError = OFF.messageFor(err);
        render();
      });
      return;
    }
    if (kind === "weight") {
      var kg = VFND.validateWeight(data.get("kg"), false);
      var date = String(data.get("date") || "");
      if (!VFND.isDateKey(date)) {
        formError = "Bitte ein Datum wählen.";
        render();
        return;
      }
      if (date > todayKey()) {
        formError = "Das Datum liegt in der Zukunft.";
        render();
        return;
      }
      if (!kg.ok) {
        formError = kg.error;
        render();
        return;
      }
      var savedWeight = VFND.upsertWeight(state, date, kg.value);
      formError = "";
      commit(savedWeight.state, "Gespeichert");
      return;
    }
    if (kind === "movement") {
      var mode = data.get("move");
      var movement = null;
      if (mode === "steps") {
        var steps = VFND.validateSteps(data.get("steps"));
        if (!steps.ok) {
          formError = steps.error;
          render();
          return;
        }
        movement = { kind: "steps", steps: steps.value };
      } else {
        var note = VFND.validateName(data.get("note"));
        if (!note.ok) {
          formError = "Bitte eine kurze Notiz eingeben oder Schritte wählen.";
          render();
          return;
        }
        movement = { kind: "note", note: note.value };
      }
      formError = "";
      var moved = VFND.setMovement(state, seniorOn() && (route().name === "dashboard" || route().name === "heute") ? todayKey() : selectedDate, movement);
      if (moved.ok) commit(moved.state, "Gespeichert");
      return;
    }
    if (kind === "shop-manual") {
      var shopName = VFND.validateName(data.get("name"));
      var shopAmount = VFND.parseGermanNumber(data.get("amount"));
      var shopUnit = String(data.get("unit") || "").trim();
      if (!shopName.ok || !shopAmount.ok || shopAmount.value <= 0 || !shopUnit) {
        formError = shopName.ok ? "Bitte Menge und Einheit eintragen." : shopName.error;
        render();
        return;
      }
      state.shopping.manual.push({ id: VFND.uid(), name: shopName.value, amount: shopAmount.value, unit: shopUnit });
      commit(VFND.setShopping(state, state.shopping), "Gespeichert");
      return;
    }
    if (kind === "training") {
      var trainName = VFND.validateName(data.get("name"));
      var minutes = VFND.parseGermanNumber(data.get("minutes"));
      if (!trainName.ok || !minutes.ok) {
        formError = trainName.ok ? "Bitte die Minuten als Zahl eintragen." : trainName.error;
        render();
        return;
      }
      var trained = VFND.addTraining(state, todayKey(), { name: trainName.value, minutes: minutes.value, note: data.get("note") });
      if (!trained.ok) {
        formError = "Bitte eine Dauer zwischen 1 und 600 Minuten eintragen.";
        render();
        return;
      }
      formError = "";
      commit(trained.state, "Gespeichert");
      return;
    }
    if (kind === "settings" || kind === "start") {
      var calorie = VFND.validateKcal(data.get("calorieGoal"), false);
      if (calorie.ok && calorie.value === 0) calorie = { ok: false, error: "Bitte eine Zahl ab 1 oder das Feld leer lassen." };
      var proteinGoal = VFND.validateMacro(data.get("proteinGoal"));
      var carbsGoal = VFND.validateMacro(data.get("carbsGoal"));
      var fatGoal = VFND.validateMacro(data.get("fatGoal"));
      var waterRaw = VFND.parseGermanNumber(data.get("waterGoal") || "8");
      var waterOk = waterRaw.ok && waterRaw.value >= 1 && waterRaw.value <= 30 && Math.round(waterRaw.value) === waterRaw.value;
      var startW = VFND.validateWeight(data.get("startWeight"), true);
      var goalW = VFND.validateWeight(data.get("goalWeight"), true);
      var theme = data.get("theme");
      if (kind === "settings") {
        var issue = firstError([calorie, proteinGoal, carbsGoal, fatGoal, startW, goalW]);
        if (!waterOk) issue = issue || "Bitte 1 bis 30 Gläser eintragen.";
        if (issue) {
          formError = issue;
          render();
          return;
        }
        state.settings.displayName = String(data.get("displayName") || "").replace(/[\u0000-\u001F]/g, "").trim().slice(0, 40);
        state.settings.calorieGoal = calorie.value;
        state.settings.proteinGoal = proteinGoal.value;
        state.settings.carbsGoal = carbsGoal.value;
        state.settings.fatGoal = fatGoal.value;
        state.settings.waterGoal = Math.round(waterRaw.value);
        state.settings.startWeight = startW.value;
        state.settings.goalWeight = goalW.value;
      }
      if (theme === "light" || theme === "dark" || theme === "system") state.settings.theme = theme;
      var chosenLook = data.get("look");
      if (chosenLook === "lila" || chosenLook === "gross") {
        state.settings.look = chosenLook;
        state.settings.senior = chosenLook !== "lila";
      }
      if (kind === "start") state.settings.onboarded = true;
      formError = "";
      applyTheme();
      var saved = VFND.saveState(localStorage, state);
      loadInfo.writeError = !saved.ok;
      if (saved.ok) loadInfo.corrupted = false;
      if (kind === "start") location.hash = "#/";
      toast("Gespeichert");
      render();
    }
  }

  function onChange(event) {
    var target = event.target;
    if (!target) return;
    var starting = target.form && target.form.getAttribute("data-form") === "start";
    if (target.name === "theme") {
      state.settings.theme = target.value;
      applyTheme();
      if (!starting) {
        var savedTheme = VFND.saveState(localStorage, state);
        loadInfo.writeError = !savedTheme.ok;
        announce("Darstellung gespeichert");
      }
    }
    if (target.name === "look") {
      state.settings.look = target.value === "lila" ? "lila" : "gross";
      state.settings.senior = state.settings.look !== "lila";
      applyTheme();
      if (!starting) {
        VFND.saveState(localStorage, state);
        render();
      }
    }
  }

  document.querySelectorAll("[data-icon]").forEach(function (el) {
    el.innerHTML = svg(el.getAttribute("data-icon"));
  });
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("change", function (event) {
    var box = event.target.closest("[data-shop-check]");
    if (box) {
      if (box.checked) state.shopping.checked[box.getAttribute("data-shop-check")] = true;
      else delete state.shopping.checked[box.getAttribute("data-shop-check")];
      VFND.saveState(localStorage, state);
      return;
    }
    onChange(event);
  });
  document.addEventListener("change", function (event) {
    var price = event.target.closest("[data-shop-price]");
    if (!price) return;
    var raw = String(price.value || "").trim();
    var key = price.getAttribute("data-shop-price");
    if (!raw) delete state.shopping.priceOverrides[key];
    else {
      var parsed = VFND.parseGermanNumber(raw);
      if (!parsed.ok) return;
      state.shopping.priceOverrides[key] = Math.round(parsed.value * 100) / 100;
    }
    state = VFND.setShopping(state, state.shopping);
    VFND.saveState(localStorage, state);
    var sum = document.querySelector("[data-testid=shop-sum]");
    if (sum) {
      var total = VFNDShop.sumEstimates(buildShoppingLines());
      sum.textContent = total == null ? "Noch keine Schätzung." : "Summe der Schätzungen: " + formatEur(total);
    }
  });
  document.addEventListener("input", function (event) {
    if (event.target && event.target.id === "scan-grams" && scanProduct) {
      scanGrams = event.target.value;
      var total = document.querySelector("[data-testid=scan-total]");
      if (total) total.textContent = scanPortionLine(scanProduct, scanGrams);
      return;
    }
    if (event.target && event.target.hasAttribute("data-grams")) updatePreview(event.target);
  });
  document.addEventListener("error", function (event) {
    var slot = event.target && event.target.closest && event.target.closest(".pic-slot");
    if (slot) { slot.classList.add("pic-missing"); event.target.remove(); }
    else if (event.target && event.target.classList && event.target.classList.contains("food-img")) event.target.remove();
  }, true);
  window.addEventListener("hashchange", function () { stopScan(); stopTimer(); render(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (state.settings.theme === "system") applyTheme();
  });
  document.getElementById("reset-cancel").addEventListener("click", function () {
    document.getElementById("reset-dialog").close();
  });
  document.getElementById("reset-confirm").addEventListener("click", function () {
    document.getElementById("reset-dialog").close();
    formError = "";
    offResults = [];
    commit(VFND.resetKeepingDisplay(state), "Gelöscht");
  });

  var catalog = { recipes: [], prices: [], training: {} };
  var texts = {};
  var scanControls = null;
  var scanBusy = false;
  var scanLive = false;
  var scanOrigin = "dashboard";
  var recipeFilter = "alle";
  var shopConfirm = "";
  var shopNote = "";
  var shopNote = "";
  var safetyPeek = false;
  var timer = { total: 0, started: 0, left: 0, running: false, handle: 0 };
  var licenseText = "";
  var scanProduct = null;
  var scanMessage = "";
  var scanQr = "";
  var scanGrams = "";
  var scanSlot = "mittag";

  function loadCatalog() {
    function read(url) {
      return fetch(url).then(function (res) { return res.json(); }).catch(function () { return null; });
    }
    Promise.all([read("data/recipes.json"), read("data/prices.json"), read("data/training.json"), read("data/ui-texts.json")]).then(function (pair) {
      catalog.recipes = pair[0] && Array.isArray(pair[0].recipes) ? pair[0].recipes : [];
      catalog.categories = pair[0] && Array.isArray(pair[0].categories) ? pair[0].categories : [];
      catalog.prices = pair[1] && Array.isArray(pair[1].items) ? pair[1].items : [];
      catalog.priceCategories = pair[1] && Array.isArray(pair[1].categories) ? pair[1].categories : [];
      catalog.training = pair[2] || {};
      texts = pair[3] || {};
      render();
    });
  }

  function addRecipePick(id) {
    var portions = readPortions(id, (catalog.recipes.filter(function (item) { return item.id === id; })[0] || {}).servings || 1);
    if (!portions.ok || portions.value <= 0) {
      formError = "Bitte die Portionen als Zahl eintragen.";
      render();
      return;
    }
    var picks = state.shopping.picks.filter(function (pick) { return pick.recipeId !== id; });
    picks.push({ recipeId: id, portions: portions.value });
    state.shopping.picks = picks;
    commit(VFND.setShopping(state, state.shopping), "Gespeichert");
    location.hash = "#/einkauf";
  }

  function addRecipeMeal(id) {
    var recipe = catalog.recipes.filter(function (item) { return item.id === id; })[0];
    if (!recipe) return;
    var portions = readPortions(id, recipe.servings || 1);
    var factor = portions.ok && recipe.servings ? portions.value / recipe.servings : 1;
    var kcal = recipe.kcalPerServing == null ? null : Math.round(Number(recipe.kcalPerServing) * (portions.ok ? portions.value : recipe.servings || 1));
    if (kcal == null) {
      prefill = { slot: "mittag", name: recipe.title || "", kcal: "", protein: "", carbs: "", fat: "" };
      formError = "Für dieses Rezept sind keine Kalorien hinterlegt. Bitte trag sie selbst ein.";
      location.hash = "#/mahlzeiten";
      return;
    }
    var slot = "mittag";
    (catalog.categories || []).forEach(function (cat) { if (cat.id === recipe.category && cat.mealSlot) slot = cat.mealSlot; });
    var added = VFND.addMeal(state, todayKey(), slot, {
      name: recipe.title,
      kcal: kcal,
      protein: recipe.proteinPerPortion == null ? null : Math.round(recipe.proteinPerPortion * factor * 10) / 10,
      carbs: recipe.carbsPerPortion == null ? null : Math.round(recipe.carbsPerPortion * factor * 10) / 10,
      fat: recipe.fatPerPortion == null ? null : Math.round(recipe.fatPerPortion * factor * 10) / 10,
      source: "manual"
    });
    if (added.ok) {
      formError = "";
      commit(added.state, "Gespeichert");
      location.hash = "#/mahlzeiten";
    }
  }

  function setScanChrome(live) {
    scanLive = !!live;
    var video = document.getElementById("scan-video");
    var start = document.getElementById("scan-start");
    var stop = document.getElementById("scan-stop");
    if (video) video.hidden = !scanLive;
    if (start) start.hidden = scanLive;
    if (stop) stop.hidden = !scanLive;
    var hint = document.querySelector(".camera-hint");
    if (hint) hint.hidden = scanLive;
    var line = document.querySelector(".scan-line");
    if (line) line.hidden = !scanLive;
  }

  function stopScan() {
    try {
      if (scanControls && typeof scanControls.stop === "function") scanControls.stop();
    } catch (e) {}
    scanControls = null;
    var video = document.getElementById("scan-video");
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(function (track) { track.stop(); });
      video.srcObject = null;
    }
    setScanChrome(false);
  }

  function showScanStatus(text) {
    scanMessage = text || "";
    var status = document.getElementById("scan-status");
    if (!status) return;
    status.hidden = !scanMessage;
    status.textContent = scanMessage;
  }

  function saveScan() {
    if (!scanProduct || !scanProduct.per100 || scanProduct.per100.kcal == null) {
      scanMessage = tx("scan.errors.nutritionMissing");
      render();
      return;
    }
    var input = document.getElementById("scan-grams");
    var select = document.getElementById("scan-slot");
    var parsed = VFND.parseGermanNumber(input ? input.value : scanGrams);
    if (!parsed.ok || parsed.value <= 0 || parsed.value > 5000) {
      scanMessage = "Bitte die Menge in Gramm eintragen.";
      render();
      return;
    }
    var slot = select && VFND.SLOTS.some(function (item) { return item.id === select.value; }) ? select.value : scanSlot;
    var portion = VFND.scalePortion(scanProduct.per100, parsed.value);
    if (portion.kcal == null) {
      scanMessage = tx("scan.errors.nutritionMissing");
      render();
      return;
    }
    var added = VFND.addMeal(state, todayKey(), slot, {
      name: scanProduct.name,
      kcal: portion.kcal,
      protein: portion.protein,
      carbs: portion.carbs,
      fat: portion.fat,
      grams: portion.grams,
      source: "off",
      offCode: scanProduct.code
    });
    if (!added.ok) {
      scanMessage = tx("scan.errors.generic");
      render();
      return;
    }
    var label = (VFND.SLOTS.filter(function (item) { return item.id === slot; })[0] || {}).label || slot;
    scanProduct = null;
    scanGrams = "";
    scanQr = "";
    scanMessage = tx("scan.saved", { meal: label });
    commit(added.state, scanMessage);
  }

  function handleScan(text) {
    if (scanBusy) return;
    scanBusy = true;
    stopScan();
    var kind = VFNDShop.classifyScan(text);
    scanQr = "";
    if (kind.kind === "ean") {
      scanProduct = null;
      scanMessage = tx("scan.searching");
      render();
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        scanMessage = tx("scan.errors.offline");
        render();
        return;
      }
      OFF.fetchBarcode(kind.code).then(function (res) {
        if (!res.found || !res.product) {
          scanProduct = null;
          scanMessage = tx("scan.errors.productNotFound");
        } else {
          scanProduct = res.product;
          scanGrams = res.product.servingGrams ? String(res.product.servingGrams).replace(".", ",") : "";
          scanMessage = res.product.per100 && res.product.per100.kcal == null ? tx("scan.errors.nutritionMissing") : "";
        }
        render();
      }).catch(function () {
        scanProduct = null;
        scanMessage = tx("scan.errors.generic");
        render();
      });
      return;
    }
    scanProduct = null;
    scanQr = kind.text;
    scanMessage = "";
    render();
  }

  function startScan() {
    var video = document.getElementById("scan-video");
    if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showScanStatus(tx("scan.errors.cameraUnavailable"));
      return;
    }
    if (!window.ZXingBrowser || !ZXingBrowser.BrowserMultiFormatReader) {
      showScanStatus(tx("scan.errors.generic"));
      return;
    }
    stopScan();
    scanBusy = false;
    scanProduct = null;
    scanQr = "";
    var reader = new ZXingBrowser.BrowserMultiFormatReader();
    var constraints = { audio: false, video: { facingMode: { ideal: "environment" } } };
    var starter = reader.decodeFromConstraints
      ? reader.decodeFromConstraints(constraints, video, onZxing)
      : reader.decodeFromVideoDevice(undefined, video, onZxing);
    Promise.resolve(starter).then(function (controls) {
      scanControls = controls || null;
      setScanChrome(true);
      showScanStatus(tx("scan.scanning"));
    }).catch(function () {
      stopScan();
      showScanStatus(tx("scan.errors.cameraDeniedTitle") + " " + tx("scan.errors.cameraDeniedText"));
    });
    function onZxing(result, err) {
      if (result && typeof result.getText === "function") {
        handleScan(result.getText());
        return;
      }
      if (err && err.name && err.name !== "NotFoundException") {
        showScanStatus(tx("scan.errors.notRecognizedTitle") + " " + tx("scan.errors.notRecognizedText"));
      }
    }
  }

  loadInfo = VFND.loadState(localStorage);
  state = loadInfo.state;
  if (loadInfo.migrated && !loadInfo.corrupted) VFND.saveState(localStorage, state);
  applyTheme();
  render();
  loadCatalog();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  function tick() {
    var clock = document.getElementById("clock");
    if (clock) clock.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  tick();
  setInterval(tick, 30000);
})();
