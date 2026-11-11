# Inhalte

Maßgeblich sind die JSON-Dateien in diesem Ordner. `tools/validate.py` prüft sie.

- `recipes.json`: Kategorien mit `mealSlot`, Rezepte mit `servings`, `kcalPerServing`, Zutaten (`ingredientId`, `amount`, `unit`) und `image` als Dateiname `rezept-{id}.webp`.
- `prices.json`: Richtpreise je `ingredientId`, `baseUnit`, `packageBaseAmount`, `estimatedPriceEur`, optional `unitToBase`.
- `training.json`: Sicherheitshinweis, Übungen mit `dose` je Stufe, `image` als Dateiname `uebung-{id}.webp`.
- `ui-texts.json`: Oberflächentexte. Die App liest sie, sie werden nicht umformuliert.

Bilder liegen später unter `img/rezepte/` und `img/training/`. Die JSON-Dateien enthalten nur den Dateinamen.
