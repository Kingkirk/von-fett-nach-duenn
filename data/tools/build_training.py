# -*- coding: utf-8 -*-
import json, os
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def reps(n, side=False, sets=1):
    lab = "%d-mal" % n + (" je Seite" if side else "")
    if sets > 1: lab = "%d Runden: %s" % (sets, lab)
    return {"repetitions": n, "perSide": side, "sets": sets, "label": lab}
def dur(sec, side=False):
    lab = ("%d Minuten" % (sec // 60)) if sec >= 60 and sec % 60 == 0 else "%d Sekunden" % sec
    if sec == 60: lab = "1 Minute"
    if side: lab += " je Seite"
    return {"durationSeconds": sec, "perSide": side, "label": lab}

TYPES = [("sitzen", "Im Sitzen"), ("stehen", "Im Stehen mit Halt"),
         ("gleichgewicht", "Gleichgewicht"), ("gehen", "Gehen"), ("dehnen", "Lockern und Dehnen")]
E = [
 ("marschieren-im-sitzen", "Marschieren im Sitzen", "sitzen", "Stuhl ohne Rollen",
  [dur(60), dur(120), dur(180)],
  ["Setz dich aufrecht auf die vordere Hälfte des Stuhls. Die Füße stehen flach auf dem Boden.", "Heb abwechselnd das rechte und das linke Knie etwas an, wie beim Gehen.", "Schwing die Arme locker mit. Atme ruhig weiter."]),
 ("schultern-kreisen", "Schultern kreisen", "sitzen", "Stuhl ohne Rollen",
  [reps(5), reps(8), reps(10)],
  ["Setz dich aufrecht hin. Die Arme hängen locker.", "Zieh die Schultern langsam nach oben, dann nach hinten und wieder nach unten.", "Danach die gleiche Zahl in die andere Richtung."]),
 ("beine-strecken-im-sitzen", "Bein strecken im Sitzen", "sitzen", "Stuhl ohne Rollen",
  [reps(5, True), reps(8, True), reps(10, True, 2)],
  ["Setz dich aufrecht hin und halte dich seitlich am Sitz fest.", "Streck ein Bein langsam nach vorn, bis es fast gerade ist. Kurz halten.", "Stell den Fuß langsam wieder ab. Dann das andere Bein."]),
 ("fersen-und-zehen-heben", "Fersen und Zehen heben", "sitzen", "Stuhl ohne Rollen",
  [reps(8), reps(12), reps(15)],
  ["Setz dich aufrecht hin. Die Füße stehen flach nebeneinander.", "Heb beide Fersen an. Die Zehen bleiben am Boden.", "Stell die Fersen ab und heb nun die Zehen an. Das ist einmal."]),
 ("aufstehen-vom-stuhl", "Aufstehen vom Stuhl", "stehen", "Stabiler Stuhl, mit Rückseite an der Wand",
  [reps(3), reps(6), reps(8, False, 2)],
  ["Setz dich auf die vordere Hälfte des Stuhls. Die Füße stehen etwa hüftbreit.", "Beug den Oberkörper leicht vor und steh langsam auf. Nimm die Hände zur Hilfe, wenn nötig.", "Setz dich langsam und kontrolliert wieder hin."]),
 ("zehenstand-mit-halt", "Zehenstand mit Halt", "stehen", "Stuhllehne oder Arbeitsplatte",
  [reps(5), reps(8), reps(12)],
  ["Stell dich hinter einen Stuhl und halte dich mit beiden Händen an der Lehne fest.", "Heb langsam beide Fersen an und komm auf die Zehenspitzen.", "Senk die Fersen langsam wieder ab."]),
 ("bein-seitlich-heben", "Bein seitlich heben", "stehen", "Stuhllehne oder Arbeitsplatte",
  [reps(5, True), reps(8, True), reps(10, True)],
  ["Stell dich aufrecht hinter einen Stuhl und halte dich an der Lehne fest.", "Heb ein Bein langsam zur Seite an. Der Oberkörper bleibt gerade.", "Stell das Bein langsam ab. Nach allen Wiederholungen die Seite wechseln."]),
 ("ferse-zum-po", "Ferse zum Po", "stehen", "Stuhllehne oder Arbeitsplatte",
  [reps(5, True), reps(8, True), reps(10, True)],
  ["Stell dich aufrecht hinter einen Stuhl und halte dich an der Lehne fest.", "Beug ein Knie und führ die Ferse langsam nach hinten in Richtung Po.", "Stell den Fuß langsam wieder ab. Dann das andere Bein."]),
 ("liegestuetz-an-der-wand", "Liegestütz an der Wand", "stehen", "Freie Wand",
  [reps(5), reps(8), reps(10, False, 2)],
  ["Stell dich eine Armlänge vor eine Wand. Leg die Hände in Schulterhöhe an die Wand.", "Beug die Arme langsam, bis die Nase näher an der Wand ist. Der Körper bleibt gerade.", "Drück dich langsam wieder zurück."]),
 ("auf-einem-bein-stehen", "Auf einem Bein stehen", "gleichgewicht", "Stuhllehne oder Arbeitsplatte",
  [dur(10, True), dur(20, True), dur(30, True)],
  ["Stell dich neben einen Stuhl und halte dich mit einer Hand an der Lehne fest.", "Heb einen Fuß ein wenig vom Boden ab und bleib ruhig stehen.", "Stell den Fuß wieder ab und wechsle die Seite. Wenn es sicher geht, nur noch mit einem Finger halten."]),
 ("fuesse-voreinander", "Füße voreinander stellen", "gleichgewicht", "Stuhllehne oder Arbeitsplatte",
  [dur(10, True), dur(20, True), dur(30, True)],
  ["Stell dich neben einen Stuhl und halte dich an der Lehne fest.", "Stell einen Fuß direkt vor den anderen, die Ferse berührt fast die Zehen.", "Bleib ruhig stehen und schau geradeaus. Dann den anderen Fuß nach vorn."]),
 ("gehen-an-der-arbeitsplatte", "Gehen an der Arbeitsplatte entlang", "gleichgewicht", "Lange Arbeitsplatte oder Flur mit Handlauf",
  [reps(5, False), reps(10, False), reps(10, False, 2)],
  ["Stell dich seitlich an eine Arbeitsplatte und leg eine Hand darauf.", "Geh langsam vorwärts. Setz dabei die Ferse direkt vor die Zehen des anderen Fußes.", "Bleib mit der Hand an der Platte. Am Ende umdrehen und mit der anderen Hand zurück."]),
 ("spaziergang", "Spaziergang", "gehen", "Feste Schuhe, nach Wunsch ein Gehstock",
  [dur(600), dur(1200), dur(1800)],
  ["Zieh feste Schuhe an. Wähle einen ebenen, bekannten Weg.", "Geh in einem ruhigen Tempo, bei dem du dich noch gut unterhalten kannst.", "Mach eine Pause, wann immer du sie brauchst."]),
 ("waden-dehnen", "Waden dehnen", "dehnen", "Stuhllehne oder Wand",
  [dur(15, True), dur(20, True), dur(30, True)],
  ["Stell dich vor einen Stuhl und halte dich an der Lehne fest.", "Stell ein Bein einen Schritt nach hinten. Die Ferse bleibt am Boden.", "Beug das vordere Knie leicht, bis du hinten in der Wade ein leichtes Ziehen spürst. Halten, dann Seite wechseln."]),
]
for e in E:
    for d in e[4]:
        if "repetitions" in d and e[0] == "gehen-an-der-arbeitsplatte":
            d["label"] = d["label"].replace("-mal", " Schritte")
exercises = [{"id": i, "name": n, "type": t, "equipment": q,
              "dose": {"einstieg": d[0], "aufbau": d[1], "fortgeschritten": d[2]},
              "steps": s, "image": "uebung-%s.webp" % i} for i, n, t, q, d, s in E]

DAYS = [("mo", "Montag"), ("di", "Dienstag"), ("mi", "Mittwoch"), ("do", "Donnerstag"),
        ("fr", "Freitag"), ("sa", "Samstag"), ("so", "Sonntag")]
A = ["marschieren-im-sitzen", "schultern-kreisen", "beine-strecken-im-sitzen", "fersen-und-zehen-heben", "auf-einem-bein-stehen", "waden-dehnen"]
B = ["marschieren-im-sitzen", "aufstehen-vom-stuhl", "zehenstand-mit-halt", "liegestuetz-an-der-wand", "fuesse-voreinander", "waden-dehnen"]
C = ["marschieren-im-sitzen", "aufstehen-vom-stuhl", "bein-seitlich-heben", "ferse-zum-po", "liegestuetz-an-der-wand", "auf-einem-bein-stehen", "gehen-an-der-arbeitsplatte", "waden-dehnen"]
W = ["spaziergang"]
def day(t, ids, title):
    return {"kind": t, "title": title, "exerciseIds": ids}
T_TR, T_GE, T_PA = "training", "gehen", "pause"
P = ("pause", [], "Ruhetag")
plans = {
 "einstieg": [(T_TR, A, "Übungen im Sitzen"), P, (T_TR, A, "Übungen im Sitzen"), (T_GE, W, "Spaziergang"), (T_TR, A, "Übungen im Sitzen"), P, P],
 "aufbau": [(T_TR, B, "Kraft mit Halt"), (T_GE, W, "Spaziergang"), (T_TR, A, "Übungen im Sitzen"), P, (T_TR, B, "Kraft mit Halt"), (T_GE, W, "Spaziergang"), P],
 "fortgeschritten": [(T_TR, C, "Kraft und Gleichgewicht"), (T_GE, W, "Spaziergang"), (T_TR, B, "Kraft mit Halt"), (T_GE, W, "Spaziergang"), (T_TR, C, "Kraft und Gleichgewicht"), (T_GE, W, "Spaziergang"), P],
}
LV = [
 ("einstieg", "Einstieg", "Ruhiger Anfang, vor allem im Sitzen. Etwa 10 Minuten je Übungstag.", 10),
 ("aufbau", "Aufbau", "Mehr Übungen im Stehen, immer mit Halt. Etwa 15 Minuten je Übungstag.", 15),
 ("fortgeschritten", "Fortgeschritten", "Kraft und Gleichgewicht an mehr Tagen. Etwa 20 Minuten je Übungstag.", 20),
]
levels = []
for lid, lab, desc, mins in LV:
    days = []
    for (did, dlab), (k, ids, title) in zip(DAYS, plans[lid]):
        d = {"day": did, "label": dlab, "kind": k, "title": title, "exerciseIds": ids}
        if k == "pause": d["note"] = "Heute ist Pause. Erholung gehört dazu."
        days.append(d)
    levels.append({"id": lid, "label": lab, "description": desc, "approxMinutesPerSession": mins,
                   "switchHint": "Wechsle erst zur nächsten Stufe, wenn sich diese Stufe über einige Wochen leicht anfühlt. Du kannst jederzeit zurückgehen.",
                   "days": days})
levels[-1]["switchHint"] = "Bleib so lange auf dieser Stufe, wie es dir guttut. Du kannst jederzeit zurückgehen."

data = {
 "version": 1, "language": "de",
 "safety": {
  "title": "Bitte zuerst lesen",
  "short": "Vor dem Start mit Ärztin oder Arzt sprechen. Bei Schmerzen, Schwindel, Atemnot oder Unwohlsein sofort aufhören.",
  "points": [
   "Sprich vor dem Start mit deiner Ärztin oder deinem Arzt. Besonders wichtig bei Herz-, Kreislauf- oder Gelenkbeschwerden, nach Stürzen oder Operationen.",
   "Hör sofort auf bei Schmerzen, Schwindel, Atemnot, Herzrasen oder wenn dir unwohl wird. Setz dich hin und ruh dich aus.",
   "Bei Schmerzen in der Brust oder Atemnot, die nicht schnell vergeht: Ruf den Notruf 112.",
   "Halte immer einen stabilen Stuhl oder eine feste Ablage in Reichweite. Keine Stühle mit Rollen.",
   "Trag feste Schuhe und sorg für freien Platz ohne Teppichkanten oder Kabel.",
   "Beweg dich langsam und ruhig. Atme dabei weiter, nicht die Luft anhalten.",
   "Trink etwas Wasser und mach Pausen, wann immer du sie brauchst."
  ],
  "disclaimer": "Diese Übungen sind allgemeine Anregungen und kein medizinischer Rat. Sie ersetzen keine ärztliche oder physiotherapeutische Beratung.",
  "confirmLabel": "Gelesen, weiter"
 },
 "types": [{"id": i, "label": l} for i, l in TYPES],
 "exercises": exercises,
 "levels": levels,
}
with open(os.path.join(OUT, "training.json"), "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(len(exercises), "Übungen")
