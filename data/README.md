# Inhalte v2 – „von fett nach dünn“

Texte und Daten für die neuen Bereiche **Rezepte, Mahlzeiten-Scan, Einkaufsliste, Training**.
Echte, live-taugliche Inhalte, keine Beispieldaten. Kalorien und Preise sind bewusst als **Schätzung** gekennzeichnet.
Alle Dateien: UTF-8, valides JSON. Der Ordner `/workspace/abnehm-app/live/` wurde nicht verändert.

## Dateien

| Datei | Inhalt |
|---|---|
| `recipes.json` | 24 Rezepte in 5 Kategorien |
| `prices.json` | 51 Zutaten mit Richtpreis, 7 Einkaufs-Kategorien |
| `training.json` | Sicherheitshinweis, 14 Übungen, Wochenplan in 3 Stufen |
| `ui-texts.json` | UI-Texte für die vier neuen Bereiche |
| `tools/build_recipes_prices.py` | Erzeugt `recipes.json` und `prices.json` (inkl. kcal-Berechnung) |
| `tools/build_training.py` | Erzeugt `training.json` |
| `tools/validate.py` | Prüft alle Dateien: `python3 tools/validate.py` |

Änderungen an Rezepten, Preisen oder Übungen bitte in den Build-Skripten machen und neu erzeugen, dann `validate.py` laufen lassen.

## Konventionen

- **Anrede: du.** Die Live-App duzt durchgehend („Ziele setzt du selbst“), deshalb bleibt es beim Du. Falls für die ältere Zielgruppe „Sie“ gewünscht ist, bitte Bescheid geben, dann stelle ich alle Texte um.
- Terminologie wie in der Live-App: „eintragen“, „Mahlzeiten“, Mahlzeiten-Slots `fruehstueck`, `mittag`, `abend`, `snacks`, „Kein medizinischer Rat“, „Pausen sind in Ordnung“.
- ids in kebab-case, ohne Umlaute.
- Platzhalter für Laufzeitwerte stehen in `{geschweiften}` Klammern, z. B. `{kcal}`, `{meal}`, `{total}`.
- Zahlen in JSON mit Punkt (`0.5`). Für die Anzeige bitte deutsch formatieren: `0,5`, `2,49 €`.
- Bildnamen sind Platzhalter für Kate: `rezept-{id}.webp`, `uebung-{id}.webp`.

## recipes.json

- `categories[]`: `id`, `label`, `mealSlot` (in welche Mahlzeit das Rezept beim Eintragen vorausgewählt wird; Suppen → `mittag`, änderbar).
- `recipes[]`: `id`, `title`, `category`, `servings`, `timeMinutes`, `difficulty` (`einfach`/`mittel`, Anzeige über `ui-texts.recipes.difficulty`), `kcalPerServing`, `kcalIsEstimate: true`, `ingredients[]` (`ingredientId`, `name`, `amount`, `unit`), `steps[]` (max. 6), `image`.
- kcal: aus üblichen Nährwerten je 100 g berechnet, auf 10 kcal gerundet. Wasser ist keine Zutat, es steht nur in den Schritten.
- Einheiten: `g`, `ml`, `Stück`, `EL`, `TL`, `Prise`, `Scheibe`, `Zehe`, `Bund`, `Dose`.

## prices.json

- Datei-Ebene: `asOf: "2026-11"`, `note` (Hinweistext), `currency`, `categories[]` (Einkaufs-Kategorien in Ladenreihenfolge).
- `items[]`: `ingredientId`, `name`, `category`, `packageSize`, `packageUnit`, `estimatedPriceEur`, `isEstimate: true`.
- Für die Einkaufsliste zusätzlich: `baseUnit`, `packageBaseAmount` (Menge einer Packung in `baseUnit`), `unitToBase` (Rezept-Einheit → `baseUnit`).
  Rechnung: Bedarf = Σ `amount × unitToBase[unit]` (oder `amount`, wenn `unit == baseUnit`); Packungen = aufrunden(Bedarf / `packageBaseAmount`); Richtpreis = Packungen × `estimatedPriceEur`.
- Grobe deutsche Durchschnittspreise, geschätzt. Keine Ladenketten, keine Preise als echt ausgegeben.

## training.json

- `safety`: Titel, Kurzfassung, Punkte (inkl. Notruf 112), Hinweis „kein medizinischer Rat“, Button-Text. Bitte vor dem ersten Training anzeigen und bestätigen lassen; die Kurzfassung auch bei jeder Einheit.
- `types[]`: `sitzen`, `stehen` (mit Halt), `gleichgewicht`, `gehen`, `dehnen`.
- `exercises[]`: `id`, `name`, `type`, `equipment`, `dose.{einstieg|aufbau|fortgeschritten}` (entweder `repetitions` + `sets` oder `durationSeconds`, jeweils mit `perSide` und fertigem `label`), 3 `steps`, `image`.
- `levels[]`: `id`, `label`, `description`, `approxMinutesPerSession`, `switchHint`, `days[]` (`day` mo–so, `label`, `kind` `training`/`gehen`/`pause`, `title`, `exerciseIds`, bei Pause `note`).

## ui-texts.json

Bereiche: `nav`, `common`, `recipes`, `scan`, `shoppingList`, `training`, `microcopy`. Sprechende Schlüssel, Fehlertexte unter `scan.errors`.
`ui-texts.json` wird von Hand gepflegt (kein Build-Skript). Der Scan ist ein Live-Scan für Strichcode und QR-Code; QR-Inhalte werden nur angezeigt, Links öffnen sich nicht automatisch.

## Offene Punkte

1. ~~Datenschutz beim Scan~~ erledigt (09.11.2026): Live-Scan für Strichcode und QR-Code, lokal auf dem Gerät, kein Foto, nichts gespeichert oder gesendet. Nur die Strichcode-Nummer geht an Open Food Facts (Fakten von Harald bestätigt). Bitte prüfen: `scan.privacyHint` nennt zusätzlich, dass die Verbindung technisch nötige Daten wie die IP-Adresse überträgt. Das entspricht dem bestehenden Hinweis in der Live-App. Wenn sich am Scan technisch etwas ändert (z. B. Fotos oder ein Server), müssen die Scan-Texte neu geprüft werden.
2. **Navigation** (erledigt): Kein Mehr-Menü, die 4 Tabs bleiben. Die neuen Bereiche erreicht man über die Kachelfläche `home.tilesTitle` („Was möchtest du tun?“) mit `home.tileScan`, `home.tileRecipes`, `home.tileShoppingList`, `home.tileTraining`; zurück mit `home.backToToday` („‹ Heute“). Im Tab Mahlzeiten gibt es den Button `meals.scanButton` („Essen scannen“). Anrede „du“ ist bestätigt.
3. **Bilder**: 24 Rezept- und 14 Übungsbilder fehlen noch (Kate).
4. **Fachliche Prüfung**: Die Übungen sind bewusst sanft gewählt. Eine Durchsicht durch eine Physiotherapeutin oder einen Physiotherapeuten wird empfohlen.
5. **Anrede**: „du“ wie in der Live-App. Bitte bestätigen.
6. Richtpreise und kcal sollten etwa halbjährlich überprüft werden.
