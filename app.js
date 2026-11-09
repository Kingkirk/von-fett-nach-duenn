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
      back: '<path d="M15 6 9 12l6 6"></path>',
      warn: '<path d="M12 4 3 19h18L12 4z"></path><path d="M12 10v4M12 16.5h.01"></path>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
  }

  function seniorOn() {
    return document.documentElement.getAttribute("data-mode") === "senior";
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
    if (state.settings.senior) root.setAttribute("data-mode", "senior");
    else root.removeAttribute("data-mode");
    root.style.colorScheme = dark ? "dark" : "light";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var color = "#F2F2F7";
      if (state.settings.senior && dark) color = "#121110";
      else if (state.settings.senior) color = "#F3EEE6";
      else if (dark) color = "#000000";
      meta.setAttribute("content", color);
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
    var known = { dashboard: 1, heute: 1, mahlzeiten: 1, fortschritt: 1, wasser: 1, profil: 1, hinweise: 1, start: 1 };
    if (!known[name]) name = "dashboard";
    return { name: name, extra: parts[1] || "" };
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
    return '<div class="stats"><div class="stat"><span>Ziel</span><b class="num" data-testid="goal-kcal">' + esc(goalText) + '</b></div><div class="stat"><span>Gegessen</span><b class="num" data-testid="eaten">' + esc(VFND.formatInt(eaten)) + '</b></div><div class="stat"><span>Übrig</span><b class="num" data-testid="remaining">' + esc(leftText) + "</b></div></div>" + over;
  }

  function card(test, go, icon, tint, title, text) {
    return '<button type="button" class="card" data-go="' + go + '" data-testid="' + test + '"><span class="tile ' + tint + '">' + svg(icon) + '</span><span class="grow"><span class="decor-gradient" aria-hidden="true"></span><h2>' + title + "</h2><p>" + esc(text) + '</p></span><span class="chev" aria-hidden="true">' + svg("back").replace("M15 6 9 12l6 6", "M9 6l6 6-6 6") + "</span></button>";
  }

  function heroBlock(date) {
    return '<section class="hero" data-testid="hero"><div class="hero-inner"><p class="greet">' + esc(greeting()) + '</p><h1>von fett nach dünn</h1>' + banner() + '<p class="fine">Nur auf diesem Gerät. Kein medizinischer Rat.</p>' + ringBlock(date) + statsBlock(date) + '<p class="fine">Das Kalorienziel setzt du selbst. Die App rechnet keine Empfehlung.</p></div></section>';
  }

  function renderDashboard() {
    var today = todayKey();
    var water = (state.days[today] && state.days[today].water) || 0;
    return '<div class="view">' + heroBlock(today) + storageBanner() + seriesBlock(false) + quietBlock(today) + '<div class="cards">' +
      card("card-meals", "mahlzeiten", "meal", "", "Mahlzeiten", "Frühstück, Mittag, Abend, Snacks") +
      card("card-progress", "fortschritt", "chart", "teal", "Fortschritt", progressLine()) +
      card("card-water", "wasser", "drop", "", "Wasser", water + " von " + state.settings.waterGoal + " Gläsern") +
      "</div></div>";
  }

  function renderSeniorHome() {
    var today = todayKey();
    return '<div class="view">' + headerBlock() + '<p class="fine">Größere Ansicht</p>' + banner() + storageBanner() +
      '<div class="callout"><p><strong>Bitte ärztlich klären.</strong> Gewichtsabnahme im Alter vorher mit einer Ärztin oder einem Arzt besprechen. Bei Einschränkungen gilt deren Rat, nicht diese App.</p></div>' +
      '<section class="panel" data-testid="senior-kcal"><h2>' + esc(kcalLine(today)) + "</h2><p class=\"fine\">Gegessen: <span class=\"num\" data-testid=\"eaten\">" + esc(VFND.formatInt(VFND.eatenKcal(state, today))) + "</span> kcal. Ziel: <span class=\"num\" data-testid=\"goal-kcal\">" + esc(state.settings.calorieGoal == null ? "nicht gesetzt" : VFND.formatInt(state.settings.calorieGoal)) + "</span>.</p></section>" +
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
      '<details id="off-panel"' + open + '><summary>Lebensmittel suchen</summary><form data-form="search" data-testid="search-form" class="stack" method="post" action="#suche"><label>Suchbegriff<input id="search-q" name="q" data-testid="search-q" maxlength="80" autocomplete="off"></label><button class="btn" type="submit">Suchen</button></form><form data-form="barcode" data-testid="barcode-form" class="stack" method="post" action="#code"><label>Strichcode<input name="code" data-testid="barcode-code" inputmode="numeric" maxlength="14" autocomplete="off"></label><button class="btn secondary" type="submit">Abrufen</button></form><p class="fine">Suche und Strichcode starten erst mit dem Knopf. Es gehen nur der Suchbegriff oder der Strichcode und die technisch nötigen Verbindungsdaten an Open Food Facts. Tagebuch, Gewicht und Ziele bleiben hier. Produktbilder nur in dieser Trefferliste, ohne Suchbegriff in der Bildadresse und ohne Referrer.</p>' + resultsHtml() + "<h3>Zuletzt</h3>" + snapList(state.recent, "Noch nichts.") + "<h3>Gemerkt</h3>" + snapList(state.favorites, "Noch nichts gemerkt.").replace(/data-bucket="recent"/g, 'data-bucket="favorites"') + "</details>" +
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
    var senior = state.settings.senior ? " checked" : "";
    return "<fieldset><legend>Hell und Dunkel</legend>" + radio("system", "System", "theme-system") + radio("light", "Hell", "theme-light") + radio("dark", "Dunkel", "theme-dark") + '</fieldset><label class="check"><input type="checkbox" id="senior" data-testid="senior-toggle"' + senior + '> Größere Ansicht</label><p class="fine">Der Schalter für Hell und Dunkel gilt überall. Die größere Ansicht wird extra gespeichert und ist warm-monochrom.</p>';
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

  function render() {
    var current = route();
    var view = document.getElementById("view");
    var html;
    if (!state.settings.onboarded && current.name === "dashboard" && (!location.hash || location.hash === "#" || location.hash === "#/" || location.hash === "#/dashboard")) {
      location.hash = "#/start";
      return;
    }
    if (seniorOn() && (current.name === "dashboard" || current.name === "heute")) html = renderSeniorHome();
    else if (current.name === "dashboard") html = renderDashboard();
    else if (current.name === "heute") html = renderHeute();
    else if (current.name === "mahlzeiten") html = renderMeals();
    else if (current.name === "fortschritt") html = renderProgress();
    else if (current.name === "wasser") html = renderWater();
    else if (current.name === "profil") html = renderProfile();
    else if (current.name === "hinweise") html = renderHinweise();
    else html = renderStart();
    view.innerHTML = html;
    var map = { dashboard: "tab-dashboard", heute: "tab-dashboard", start: "tab-dashboard", mahlzeiten: "tab-meals", fortschritt: "tab-progress", profil: "tab-profile", hinweise: "tab-profile", wasser: "tab-dashboard" };
    ["tab-dashboard", "tab-meals", "tab-progress", "tab-profile"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      if (map[current.name] === id && current.name !== "wasser") btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    if (current.name !== lastRoute) {
      var heading = view.querySelector("h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
      lastRoute = current.name;
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
      formError = "Kalorien fehlen in den Daten. Bitte selbst eintragen. Fehlende Nährwerte bleiben leer und werden nicht als 0 gespeichert.";
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

  function onClick(event) {
    var go = event.target.closest("[data-go]");
    if (go) {
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
        offError = res.found ? "" : "Kein Eintrag zu diesem Strichcode. Du kannst von Hand eintragen.";
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
      state.settings.senior = form.querySelector("#senior") ? form.querySelector("#senior").checked : state.settings.senior;
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
    if (target.id === "senior") {
      state.settings.senior = !!target.checked;
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
  document.addEventListener("change", onChange);
  document.addEventListener("input", function (event) {
    if (event.target && event.target.hasAttribute("data-grams")) updatePreview(event.target);
  });
  document.addEventListener("error", function (event) {
    if (event.target && event.target.classList && event.target.classList.contains("food-img")) event.target.remove();
  }, true);
  window.addEventListener("hashchange", render);
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

  loadInfo = VFND.loadState(localStorage);
  state = loadInfo.state;
  applyTheme();
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  function tick() {
    var clock = document.getElementById("clock");
    if (clock) clock.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  tick();
  setInterval(tick, 30000);
})();
