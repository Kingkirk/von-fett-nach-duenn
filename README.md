# von fett nach dünn

Private, statische Vorbereitung der Version 1. Nicht veröffentlicht, nicht deployt, kein Konto, kein eigenes Backend.

Die Einträge liegen nur im `localStorage` dieses Browsers. Einzige bewusste Ausnahme: eine Lebensmittelsuche oder ein Strichcode, den du selbst absendest, geht an Open Food Facts. Dabei werden der Suchbegriff oder der Strichcode und die technisch nötigen Verbindungsdaten (zum Beispiel die IP-Adresse) übermittelt. Tagebuch, Gewicht, Ziele und Name gehen dabei nicht mit.

## iPhone und Offline

„Zum Home-Bildschirm“ und ein zuverlässiger Offline-Start brauchen eine **per HTTPS erreichbare Adresse** oder `localhost` **auf demselben Gerät**. Ein ZIP oder das Öffnen per `file://` installiert die App nicht und registriert keinen Service Worker. Diese Fassung wird hier nicht gehostet. Hosting klärt du separat.

Lege den Ordner so auf den Server, wie er ist. Alle eigenen Dateien nutzen relative Pfade. `manifest.webmanifest` hat `start_url` und `scope` `./`, der Service Worker liegt daneben. Dadurch funktioniert derselbe Ordner auch unter einem Unterpfad, zum Beispiel `/von-fett-nach-duenn/`.

Der Manifest-Dateityp sollte `application/manifest+json` sein. Manche statischen Server liefern `.webmanifest` sonst als allgemeinen Binärtyp aus.

## Lokal ansehen

Im Ordner dieser Dateien:

```bash
python3 -m http.server 47321 --bind 127.0.0.1
```

Dann im Browser `http://127.0.0.1:47321/` öffnen. Das ist nur eine Vorschau auf demselben Rechner, kein Angebot im Netz. Für den Unterpfad kann der mitgelieferte Prüfserver außerhalb dieses Ordners genutzt werden; er ist kein Hosting.

## Bedienung

Heute zeigt Ziel, Gegessen, Übrig und einen Ring. Mahlzeiten lassen sich für Frühstück, Mittag, Abend und Snacks eintragen und löschen, auch mit Makros. Tage sind das lokale Datum, nicht UTC. Fortschritt speichert Gewicht und zeigt es als Kurve und Tabelle. Wasser zählt Gläser. Im Profil setzt du Ziele selbst. Die App schlägt keine Kalorien vor. Zurücksetzen fragt nach.

Hell, Dunkel oder System gilt überall und startet auf System. Die größere Ansicht ist extra, warm-monochrom, und bleibt beim Wechsel von Hell und Dunkel erhalten.

Die Namenssuche geht an `https://world.openfoodfacts.org/cgi/search.pl` mit `search_terms`, `search_simple=1`, `action=process` und `json=1`. `/api/v2/search?q=` ignoriert den Suchbegriff. `search.openfoodfacts.org` filtert zwar, sendet aber kein `Access-Control-Allow-Origin` und wird nicht aufgerufen. Der Strichcode bleibt `/api/v2/product/{code}`. Suche und Strichcode starten erst mit dem Knopf. Produktbilder erscheinen nur in der Trefferliste, nur von `openfoodfacts.org`, ohne Suchbegriff in der Bildadresse und ohne Referrer. Ein Nutri-Score erscheint nur, wenn er im Datensatz steht. Fehlt ein Nährwert, steht dort „nicht angegeben“ und nicht eine erfundene Null. Ohne Netz bleibt die manuelle Eingabe.

Kein medizinischer Rat. Gewichtsabnahme im Alter bitte vorher ärztlich besprechen.
