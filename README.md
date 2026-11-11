# von fett nach dünn

Statische Fassung 2. Seit 11.11.2026 live unter https://kingkirk.github.io/von-fett-nach-duenn/ (GitHub Pages, Branch main).

Einträge bleiben im `localStorage` unter dem Schlüssel `von-fett-nach-duenn.v1`. Eine gespeicherte Fassung 1 wird beim Öffnen nach Fassung 2 übernommen. `settings.theme` und `settings.senior` bleiben dabei unverändert. Ohne gespeicherten Stand startet die App mit Großen Tasten und System.

Große Tasten ist die warme, große Darstellung und der Standard in `tokens.css`. Sie lässt sich mit System, Hell oder Dunkel kombinieren. Ohne Große Tasten setzt die App `data-look="lila"`. Ein gespeicherter Stand mit `senior=false` wird dabei Lila, `senior=true` oder ein leerer Speicher bleibt bei Großen Tasten.

Unten bleiben vier Bereiche: Heute, Mahlzeiten, Fortschritt, Profil. Auf Heute liegen die Kacheln Essen scannen, Rezepte, Einkaufsliste und Training. Diese Seiten führen mit „‹ Heute“ zurück.

Rezepte, Richtpreise, Übungen und Oberflächentexte stehen in `data/`. Die Texte kommen aus `data/ui-texts.json`. Bilder liegen unter `img/rezepte/` und `img/training/`, jeweils als große Datei und als `-400.webp`. Der Service Worker speichert sie erst beim Abruf im Cache `vfnd-img-v1`. Fehlt ein Bild, bleibt ein leerer Rahmen.

Der Scanner liegt lokal unter `vendor/` (Apache-2.0, ZXing). Die Kamera startet erst mit „Kamera starten“, das Bild wird nicht gespeichert und nicht gesendet. Nur eine erkannte Strichcode-Nummer geht an Open Food Facts. Ein QR-Code wird angezeigt und nicht geöffnet.

„Zum Home-Bildschirm“ braucht HTTPS oder localhost auf demselben Gerät. `file://` registriert keinen Service Worker. Diese Fassung hostet das nicht.

Lokal ansehen, im Ordner dieser Dateien:

```bash
python3 -m http.server 47331 --bind 127.0.0.1
```

Dann im Browser `http://127.0.0.1:47331/` öffnen. Für den Unterpfad `/von-fett-nach-duenn/` den Ordner eine Ebene höher ablegen und von dort aus starten.
