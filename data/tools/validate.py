# -*- coding: utf-8 -*-
"""Prüft die Inhaltsdateien. Aufruf: python3 tools/validate.py"""
import json, os, re, sys
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
err = []
def load(n):
    p = os.path.join(D, n)
    if not os.path.exists(p): return None
    with open(p, encoding="utf-8") as f: return json.load(f)
kebab = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
rec, pr, tr, ui = (load(n) for n in ("recipes.json", "prices.json", "training.json", "ui-texts.json"))
if rec and pr:
    pids = [i["ingredientId"] for i in pr["items"]]
    if len(pids) != len(set(pids)): err.append("doppelte ingredientId in prices.json")
    pcats = {c["id"] for c in pr["categories"]}
    for i in pr["items"]:
        if i["category"] not in pcats: err.append("Preis-Kategorie fehlt: " + i["ingredientId"])
        if i.get("isEstimate") is not True: err.append("isEstimate fehlt: " + i["ingredientId"])
    if pr.get("asOf") != "2026-11": err.append("asOf falsch")
    cats = {c["id"] for c in rec["categories"]}
    rs = rec["recipes"]
    if not 20 <= len(rs) <= 24: err.append("Rezeptanzahl %d" % len(rs))
    if not 4 <= len(cats) <= 6: err.append("Kategorienanzahl")
    ids = [r["id"] for r in rs]
    if len(ids) != len(set(ids)): err.append("doppelte Rezept-id")
    used = set()
    for r in rs:
        if not kebab.match(r["id"]): err.append("id nicht kebab-case: " + r["id"])
        if r["category"] not in cats: err.append("Kategorie unbekannt: " + r["id"])
        if len(r["steps"]) > 6: err.append("mehr als 6 Schritte: " + r["id"])
        if r.get("kcalIsEstimate") is not True: err.append("kcalIsEstimate: " + r["id"])
        if r["difficulty"] not in ("einfach", "mittel"): err.append("difficulty: " + r["id"])
        for x in r["ingredients"]:
            used.add(x["ingredientId"])
            if x["ingredientId"] not in pids: err.append("Zutat fehlt in prices.json: %s (%s)" % (x["ingredientId"], r["id"]))
            else:
                p = pr["items"][pids.index(x["ingredientId"])]
                if x["unit"] != p["baseUnit"] and x["unit"] not in p["unitToBase"]:
                    err.append("Einheit nicht umrechenbar: %s %s" % (r["id"], x["ingredientId"]))
            if not isinstance(x["amount"], (int, float)): err.append("amount keine Zahl: " + r["id"])
    unused = set(pids) - used
    if unused: err.append("ungenutzte Zutaten: %s" % sorted(unused))
    print("Rezepte:", len(rs), "| Kategorien:", len(cats), "| Zutaten:", len(pids))
if tr:
    ex = {e["id"] for e in tr["exercises"]}
    for e in tr["exercises"]:
        if len(e["steps"]) != 3: err.append("nicht 3 Schritte: " + e["id"])
        for lv in ("einstieg", "aufbau", "fortgeschritten"):
            if lv not in e["dose"]: err.append("Stufe fehlt: %s %s" % (e["id"], lv))
    for lv in tr["levels"]:
        for d in lv["days"]:
            for i in d["exerciseIds"]:
                if i not in ex: err.append("Übung fehlt: %s (%s %s)" % (i, lv["id"], d["day"]))
    print("Übungen:", len(ex), "| Stufen:", len(tr["levels"]))
if ui:
    n = 0
    def walk(o):
        global n
        if isinstance(o, dict): [walk(v) for v in o.values()]
        elif isinstance(o, list): [walk(v) for v in o]
        elif isinstance(o, str): n += 1
    walk(ui); print("UI-Texte:", n)
print("FEHLER:" if err else "OK, keine Fehler.")
for e in err: print(" -", e)
sys.exit(1 if err else 0)
