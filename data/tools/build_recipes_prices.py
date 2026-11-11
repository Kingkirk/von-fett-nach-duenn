# -*- coding: utf-8 -*-
"""Erzeugt recipes.json und prices.json.
kcal je Portion werden aus gängigen Nährwerten (kcal je 100 g/ml) berechnet
und auf 10 kcal gerundet. Alle Werte sind Schätzungen."""
import json, os
OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# id: (Name, Einkaufs-Kategorie, Packungsgröße, Packungseinheit, Richtpreis EUR,
#      kcal je 100 g bzw. ml, Umrechnung Einheit -> g/ml)
I = {
 "haferflocken": ("Haferflocken, zart", "vorrat", 500, "g", 0.89, 370, {}),
 "milch": ("Milch, 1,5 % Fett", "milchprodukte", 1000, "ml", 1.09, 47, {}),
 "magerquark": ("Magerquark", "milchprodukte", 500, "g", 1.39, 67, {}),
 "naturjoghurt": ("Naturjoghurt, 1,5 % Fett", "milchprodukte", 500, "g", 0.99, 47, {"EL": 15}),
 "frischkaese-leicht": ("Frischkäse, leicht", "milchprodukte", 200, "g", 1.29, 120, {}),
 "huettenkaese": ("Hüttenkäse", "milchprodukte", 200, "g", 0.99, 98, {}),
 "mozzarella-leicht": ("Mozzarella, leicht", "milchprodukte", 125, "g", 0.99, 165, {}),
 "feta": ("Feta (Schafskäse)", "milchprodukte", 200, "g", 1.79, 260, {}),
 "eier": ("Eier", "milchprodukte", 10, "Stück", 2.99, None, {"Stück": 80}),  # kcal je Ei
 "apfel": ("Äpfel", "obst-gemuese", 1000, "g", 2.49, 52, {"Stück": 150}),
 "banane": ("Bananen", "obst-gemuese", 1000, "g", 1.69, 89, {"Stück": 120}),
 "zitrone": ("Zitronen", "obst-gemuese", 1, "Stück", 0.49, 0, {"Stück": 0}),
 "tomate": ("Tomaten", "obst-gemuese", 500, "g", 1.99, 18, {"Stück": 100}),
 "gurke": ("Salatgurke", "obst-gemuese", 1, "Stück", 0.79, 12, {"Stück": 400}),
 "paprika": ("Paprika, rot", "obst-gemuese", 500, "g", 2.49, 31, {"Stück": 150}),
 "zwiebel": ("Zwiebeln", "obst-gemuese", 1000, "g", 1.29, 40, {"Stück": 80}),
 "knoblauch": ("Knoblauch", "obst-gemuese", 1, "Stück", 0.49, 150, {"Zehe": 4}),
 "moehren": ("Möhren", "obst-gemuese", 1000, "g", 1.19, 36, {"Stück": 80}),
 "kartoffeln": ("Kartoffeln, festkochend", "obst-gemuese", 1500, "g", 1.99, 75, {}),
 "kuerbis": ("Hokkaido-Kürbis", "obst-gemuese", 1, "Stück", 1.99, 30, {"Stück": 1000}),
 "zucchini": ("Zucchini", "obst-gemuese", 500, "g", 1.79, 19, {}),
 "brokkoli": ("Brokkoli", "obst-gemuese", 500, "g", 1.49, 34, {}),
 "lauch": ("Lauch (Porree)", "obst-gemuese", 1, "Stück", 0.79, 30, {"Stück": 250}),
 "champignons": ("Champignons, braun", "obst-gemuese", 250, "g", 1.49, 22, {}),
 "radieschen": ("Radieschen", "obst-gemuese", 1, "Bund", 0.89, 15, {"Bund": 200}),
 "petersilie": ("Petersilie, glatt", "obst-gemuese", 1, "Bund", 0.99, 0, {"EL": 3}),
 "vollkornbrot": ("Vollkornbrot, geschnitten", "brot-backwaren", 500, "g", 1.99, 220, {"Scheibe": 50}),
 "knaeckebrot": ("Vollkorn-Knäckebrot", "brot-backwaren", 250, "g", 1.29, 350, {"Scheibe": 10}),
 "haehnchenbrust": ("Hähnchenbrustfilet", "fleisch-fisch", 400, "g", 4.99, 110, {}),
 "putenbrust-aufschnitt": ("Putenbrust, Aufschnitt", "fleisch-fisch", 100, "g", 1.49, 105, {}),
 "beeren-tk": ("Beerenmischung, tiefgekühlt", "tiefkuehl", 500, "g", 2.99, 40, {}),
 "seelachs-tk": ("Seelachsfilet, tiefgekühlt", "tiefkuehl", 400, "g", 3.99, 80, {}),
 "erbsen-tk": ("Erbsen, tiefgekühlt", "tiefkuehl", 450, "g", 1.29, 70, {}),
 "spinat-tk": ("Blattspinat, tiefgekühlt", "tiefkuehl", 450, "g", 1.49, 23, {}),
 "kraeuter-tk": ("Kräutermischung, tiefgekühlt", "tiefkuehl", 50, "g", 0.99, 0, {"EL": 3}),
 "vollkornnudeln": ("Vollkornnudeln", "vorrat", 500, "g", 1.29, 350, {}),
 "naturreis": ("Naturreis", "vorrat", 500, "g", 1.49, 350, {}),
 "linsen-rot": ("Rote Linsen", "vorrat", 500, "g", 1.79, 340, {}),
 "kichererbsen-dose": ("Kichererbsen, Dose (240 g abgetropft)", "vorrat", 1, "Dose", 0.99, 120, {"Dose": 240}),
 "thunfisch-dose": ("Thunfisch im eigenen Saft, Dose (115 g abgetropft)", "vorrat", 1, "Dose", 1.79, 110, {"Dose": 115}),
 "tomaten-passiert": ("Passierte Tomaten", "vorrat", 500, "g", 0.79, 30, {}),
 "mandeln": ("Mandeln, ganz", "vorrat", 200, "g", 2.79, 600, {}),
 "honig": ("Honig", "vorrat", 500, "g", 4.99, 304, {"TL": 7}),
 "rapsoel": ("Rapsöl", "vorrat", 1000, "ml", 2.49, 828, {"EL": 10, "TL": 4}),
 "senf": ("Senf, mittelscharf", "vorrat", 200, "ml", 0.69, 90, {"TL": 5}),
 "gemuesebruehe": ("Gemüsebrühe, Pulver", "vorrat", 150, "g", 1.79, 200, {"TL": 5}),
 "salz": ("Salz", "gewuerze", 500, "g", 0.69, 0, {"Prise": 0}),
 "pfeffer": ("Pfeffer, gemahlen", "gewuerze", 50, "g", 1.49, 0, {"Prise": 0}),
 "zimt": ("Zimt, gemahlen", "gewuerze", 40, "g", 1.29, 0, {"Prise": 0}),
 "paprikapulver": ("Paprikapulver, edelsüß", "gewuerze", 50, "g", 1.19, 0, {"TL": 2}),
 "currypulver": ("Currypulver", "gewuerze", 50, "g", 1.29, 0, {"TL": 2}),
}
SHOP_CATS = [
 ("obst-gemuese", "Obst & Gemüse"), ("brot-backwaren", "Brot & Backwaren"),
 ("milchprodukte", "Milchprodukte & Eier"), ("fleisch-fisch", "Fleisch & Fisch"),
 ("tiefkuehl", "Tiefkühl"), ("vorrat", "Vorrat"), ("gewuerze", "Gewürze"),
]
CATS = [
 ("fruehstueck", "Frühstück", "fruehstueck"), ("mittag", "Mittag", "mittag"),
 ("abendbrot", "Abendbrot", "abend"), ("suppen", "Suppen", "mittag"),
 ("snacks", "Snacks", "snacks"),
]
# (id, Titel, Kategorie, Portionen, Minuten, Schwierigkeit, [(ingredientId, Menge, Einheit)], [Schritte])
R = [
 ("haferbrei-mit-apfel", "Haferbrei mit Apfel und Zimt", "fruehstueck", 2, 10, "einfach",
  [("haferflocken", 80, "g"), ("milch", 400, "ml"), ("apfel", 1, "Stück"), ("zimt", 1, "Prise")],
  ["Milch und Haferflocken in einen Topf geben.", "Unter Rühren aufkochen.", "Bei kleiner Hitze 3 Minuten quellen lassen.", "Apfel waschen und klein schneiden.", "Apfel unterrühren. Mit Zimt bestreuen."]),
 ("quark-mit-beeren", "Quark mit Beeren", "fruehstueck", 2, 5, "einfach",
  [("magerquark", 250, "g"), ("milch", 50, "ml"), ("beeren-tk", 200, "g"), ("honig", 1, "TL")],
  ["Beeren am Vorabend im Kühlschrank auftauen lassen.", "Quark und Milch glatt rühren.", "Quark auf zwei Schalen verteilen.", "Beeren darauf geben. Mit Honig beträufeln."]),
 ("ruehrei-mit-tomate", "Rührei mit Tomate und Brot", "fruehstueck", 1, 10, "einfach",
  [("eier", 2, "Stück"), ("tomate", 1, "Stück"), ("rapsoel", 1, "TL"), ("petersilie", 1, "EL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise"), ("vollkornbrot", 1, "Scheibe")],
  ["Tomate waschen und klein schneiden.", "Eier in einer Schüssel verquirlen. Salzen und pfeffern.", "Öl in einer Pfanne erhitzen.", "Eier hineingeben und langsam stocken lassen. Dabei umrühren.", "Tomate und Petersilie darüber geben.", "Mit dem Brot servieren."]),
 ("brot-frischkaese-gurke", "Vollkornbrot mit Frischkäse und Gurke", "fruehstueck", 1, 5, "einfach",
  [("vollkornbrot", 2, "Scheibe"), ("frischkaese-leicht", 30, "g"), ("gurke", 100, "g"), ("pfeffer", 1, "Prise")],
  ["Gurke waschen und in Scheiben schneiden.", "Brot mit Frischkäse bestreichen.", "Gurke darauf legen. Etwas pfeffern."]),
 ("joghurt-banane-hafer", "Joghurt mit Banane und Haferflocken", "fruehstueck", 1, 5, "einfach",
  [("naturjoghurt", 150, "g"), ("banane", 0.5, "Stück"), ("haferflocken", 20, "g"), ("zimt", 1, "Prise")],
  ["Joghurt in eine Schale geben.", "Banane schälen und in Scheiben schneiden.", "Banane und Haferflocken auf den Joghurt geben.", "Mit Zimt bestreuen."]),
 ("haehnchen-reis-brokkoli", "Hähnchen mit Reis und Brokkoli", "mittag", 2, 35, "einfach",
  [("naturreis", 120, "g"), ("haehnchenbrust", 250, "g"), ("brokkoli", 400, "g"), ("rapsoel", 1, "EL"), ("paprikapulver", 1, "TL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Reis nach Packung in Salzwasser garen.", "Brokkoli in kleine Röschen teilen.", "Brokkoli 6 bis 8 Minuten in wenig Wasser garen.", "Hähnchen in Streifen schneiden. Mit Salz, Pfeffer und Paprika würzen.", "Öl erhitzen. Hähnchen darin rundum braten, bis es innen ganz durch ist.", "Alles zusammen anrichten."]),
 ("nudeln-tomatensauce-zucchini", "Vollkornnudeln mit Tomatensoße und Zucchini", "mittag", 2, 25, "einfach",
  [("vollkornnudeln", 160, "g"), ("tomaten-passiert", 400, "g"), ("zucchini", 200, "g"), ("zwiebel", 1, "Stück"), ("knoblauch", 1, "Zehe"), ("rapsoel", 1, "EL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Nudeln nach Packung in Salzwasser kochen.", "Zwiebel und Knoblauch fein schneiden. Zucchini würfeln.", "Öl erhitzen. Zwiebel, Knoblauch und Zucchini 5 Minuten braten.", "Passierte Tomaten dazugeben. 10 Minuten leise köcheln lassen.", "Mit Salz und Pfeffer abschmecken.", "Nudeln abgießen und mit der Soße mischen."]),
 ("ofenkartoffeln-kraeuterquark", "Ofenkartoffeln mit Kräuterquark", "mittag", 2, 45, "einfach",
  [("kartoffeln", 600, "g"), ("rapsoel", 1, "EL"), ("magerquark", 250, "g"), ("milch", 50, "ml"), ("kraeuter-tk", 2, "EL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Ofen auf 200 °C (Umluft 180 °C) vorheizen.", "Kartoffeln waschen und halbieren.", "Kartoffeln mit Öl und Salz mischen. Auf ein Blech mit Backpapier legen.", "Etwa 35 Minuten backen, bis sie weich sind.", "Quark, Milch und Kräuter verrühren. Salzen und pfeffern.", "Kartoffeln mit dem Quark servieren."]),
 ("seelachs-gemuese-kartoffeln", "Seelachs mit Möhren, Erbsen und Kartoffeln", "mittag", 2, 30, "einfach",
  [("kartoffeln", 400, "g"), ("seelachs-tk", 300, "g"), ("moehren", 2, "Stück"), ("erbsen-tk", 100, "g"), ("rapsoel", 1, "EL"), ("zitrone", 0.5, "Stück"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Fisch nach Packung auftauen lassen.", "Kartoffeln schälen und in Salzwasser 20 Minuten kochen.", "Möhren schälen und in Scheiben schneiden. Mit den Erbsen 8 Minuten in wenig Wasser garen.", "Fisch salzen und pfeffern.", "Öl erhitzen. Fisch je Seite 3 bis 4 Minuten braten.", "Mit Zitronensaft beträufeln und anrichten."]),
 ("kartoffeln-spinat-ei", "Kartoffeln mit Spinat und Ei", "mittag", 2, 30, "einfach",
  [("kartoffeln", 500, "g"), ("spinat-tk", 450, "g"), ("eier", 2, "Stück"), ("zwiebel", 1, "Stück"), ("milch", 50, "ml"), ("rapsoel", 1, "TL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Kartoffeln schälen und in Salzwasser 20 Minuten kochen.", "Eier 9 Minuten hart kochen. Kalt abschrecken.", "Zwiebel fein schneiden. In Öl glasig dünsten.", "Spinat und Milch dazugeben. Unter Rühren 10 Minuten erhitzen.", "Spinat salzen und pfeffern.", "Eier schälen, halbieren und mit Kartoffeln und Spinat anrichten."]),
 ("tomate-mozzarella-brot", "Tomate mit Mozzarella und Brot", "abendbrot", 1, 5, "einfach",
  [("tomate", 2, "Stück"), ("mozzarella-leicht", 60, "g"), ("rapsoel", 1, "TL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise"), ("vollkornbrot", 1, "Scheibe")],
  ["Tomaten waschen und in Scheiben schneiden.", "Mozzarella in Scheiben schneiden.", "Beides abwechselnd auf einen Teller legen.", "Mit Öl beträufeln. Salzen und pfeffern.", "Mit dem Brot servieren."]),
 ("bunter-salat-feta", "Bunter Salat mit Feta", "abendbrot", 2, 10, "einfach",
  [("gurke", 1, "Stück"), ("tomate", 3, "Stück"), ("paprika", 1, "Stück"), ("zwiebel", 0.5, "Stück"), ("feta", 100, "g"), ("rapsoel", 1, "EL"), ("zitrone", 0.5, "Stück"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Gurke, Tomaten und Paprika waschen und würfeln.", "Zwiebel fein schneiden.", "Alles in eine Schüssel geben.", "Zitronensaft, Öl, Salz und Pfeffer verrühren. Über den Salat geben.", "Feta mit den Fingern darüber bröseln."]),
 ("knaeckebrot-huettenkaese", "Knäckebrot mit Hüttenkäse und Radieschen", "abendbrot", 1, 5, "einfach",
  [("knaeckebrot", 3, "Scheibe"), ("huettenkaese", 100, "g"), ("radieschen", 0.5, "Bund"), ("petersilie", 1, "EL"), ("pfeffer", 1, "Prise")],
  ["Radieschen waschen und in Scheiben schneiden.", "Hüttenkäse auf das Knäckebrot streichen.", "Radieschen darauf legen.", "Mit Petersilie und Pfeffer bestreuen."]),
 ("thunfisch-kichererbsen-salat", "Thunfisch-Salat mit Kichererbsen", "abendbrot", 2, 10, "einfach",
  [("thunfisch-dose", 1, "Dose"), ("kichererbsen-dose", 1, "Dose"), ("tomate", 2, "Stück"), ("gurke", 0.5, "Stück"), ("zwiebel", 0.5, "Stück"), ("rapsoel", 1, "EL"), ("zitrone", 0.5, "Stück"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Kichererbsen in ein Sieb geben und abspülen.", "Thunfisch abtropfen lassen.", "Tomaten und Gurke würfeln. Zwiebel fein schneiden.", "Alles in einer Schüssel mischen.", "Mit Zitronensaft, Öl, Salz und Pfeffer abschmecken."]),
 ("brot-putenbrust-senf", "Vollkornbrot mit Putenbrust und Gurke", "abendbrot", 1, 5, "einfach",
  [("vollkornbrot", 2, "Scheibe"), ("senf", 1, "TL"), ("putenbrust-aufschnitt", 50, "g"), ("gurke", 80, "g")],
  ["Gurke waschen und in Scheiben schneiden.", "Brot dünn mit Senf bestreichen.", "Putenbrust und Gurke darauf legen."]),
 ("omelett-pilze-paprika", "Omelett mit Pilzen und Paprika", "abendbrot", 1, 15, "mittel",
  [("eier", 2, "Stück"), ("champignons", 100, "g"), ("paprika", 0.5, "Stück"), ("rapsoel", 1, "TL"), ("petersilie", 1, "EL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Pilze und Paprika waschen und klein schneiden.", "Öl in einer Pfanne erhitzen. Gemüse 5 Minuten braten.", "Eier verquirlen. Salzen und pfeffern.", "Eier über das Gemüse gießen.", "Bei kleiner Hitze mit Deckel stocken lassen.", "Mit Petersilie bestreuen und zusammenklappen."]),
 ("kuerbissuppe", "Kürbissuppe", "suppen", 4, 35, "einfach",
  [("kuerbis", 800, "g"), ("kartoffeln", 200, "g"), ("zwiebel", 1, "Stück"), ("rapsoel", 1, "EL"), ("gemuesebruehe", 2, "TL"), ("milch", 100, "ml"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Kürbis waschen, entkernen und würfeln. Die Schale kann dranbleiben.", "Kartoffeln schälen und würfeln. Zwiebel fein schneiden.", "Öl im Topf erhitzen. Zwiebel kurz andünsten.", "Kürbis, Kartoffeln, Brühe und 800 ml Wasser dazugeben. 20 Minuten kochen.", "Mit dem Pürierstab fein pürieren.", "Milch einrühren. Salzen und pfeffern."]),
 ("rote-linsen-suppe", "Rote-Linsen-Suppe", "suppen", 4, 30, "einfach",
  [("linsen-rot", 200, "g"), ("moehren", 2, "Stück"), ("zwiebel", 1, "Stück"), ("tomaten-passiert", 200, "g"), ("rapsoel", 1, "EL"), ("gemuesebruehe", 2, "TL"), ("currypulver", 1, "TL"), ("salz", 1, "Prise")],
  ["Zwiebel fein schneiden. Möhren schälen und klein würfeln.", "Öl im Topf erhitzen. Zwiebel und Möhren 3 Minuten andünsten.", "Curry kurz mitrühren.", "Linsen abspülen. Mit Tomaten, Brühe und 1 Liter Wasser in den Topf geben.", "15 Minuten leise kochen, bis die Linsen weich sind. Ab und zu umrühren.", "Mit Salz abschmecken. Nach Wunsch pürieren."]),
 ("kartoffel-lauch-suppe", "Kartoffel-Lauch-Suppe", "suppen", 4, 35, "einfach",
  [("kartoffeln", 600, "g"), ("lauch", 1, "Stück"), ("zwiebel", 1, "Stück"), ("rapsoel", 1, "EL"), ("gemuesebruehe", 2, "TL"), ("milch", 100, "ml"), ("petersilie", 2, "EL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Kartoffeln schälen und würfeln.", "Lauch längs halbieren, gut waschen und in Ringe schneiden. Zwiebel fein schneiden.", "Öl im Topf erhitzen. Zwiebel und Lauch 5 Minuten andünsten.", "Kartoffeln, Brühe und 1 Liter Wasser dazugeben. 20 Minuten kochen.", "Etwa die Hälfte pürieren. Milch einrühren.", "Salzen, pfeffern und mit Petersilie bestreuen."]),
 ("tomatensuppe", "Tomatensuppe", "suppen", 2, 20, "einfach",
  [("tomaten-passiert", 500, "g"), ("zwiebel", 1, "Stück"), ("knoblauch", 1, "Zehe"), ("rapsoel", 1, "TL"), ("gemuesebruehe", 1, "TL"), ("naturjoghurt", 2, "EL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Zwiebel und Knoblauch fein schneiden.", "Öl im Topf erhitzen. Zwiebel und Knoblauch glasig dünsten.", "Tomaten, Brühe und 200 ml Wasser dazugeben.", "10 Minuten leise köcheln lassen.", "Salzen und pfeffern.", "In Teller füllen. Je einen Löffel Joghurt darauf geben."]),
 ("huehner-gemuese-suppe", "Hühnersuppe mit Gemüse", "suppen", 4, 40, "einfach",
  [("haehnchenbrust", 300, "g"), ("moehren", 3, "Stück"), ("lauch", 1, "Stück"), ("kartoffeln", 300, "g"), ("gemuesebruehe", 3, "TL"), ("petersilie", 2, "EL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Möhren und Kartoffeln schälen und würfeln. Lauch waschen und in Ringe schneiden.", "1,5 Liter Wasser mit der Brühe aufkochen.", "Hähnchen hineinlegen. 15 Minuten leise kochen.", "Hähnchen herausnehmen. Gemüse in den Topf geben und 15 Minuten kochen.", "Hähnchen klein schneiden und zurück in die Suppe geben.", "Salzen, pfeffern und mit Petersilie bestreuen."]),
 ("apfel-mit-mandeln", "Apfel mit Mandeln", "snacks", 1, 3, "einfach",
  [("apfel", 1, "Stück"), ("mandeln", 10, "g")],
  ["Apfel waschen und in Spalten schneiden.", "Mit den Mandeln auf einen Teller legen."]),
 ("gemuesesticks-quarkdip", "Gemüsesticks mit Quark-Dip", "snacks", 2, 10, "einfach",
  [("moehren", 2, "Stück"), ("paprika", 1, "Stück"), ("gurke", 0.5, "Stück"), ("magerquark", 150, "g"), ("naturjoghurt", 50, "g"), ("kraeuter-tk", 2, "EL"), ("salz", 1, "Prise"), ("pfeffer", 1, "Prise")],
  ["Möhren schälen. Paprika und Gurke waschen.", "Gemüse in fingerlange Stifte schneiden.", "Quark, Joghurt und Kräuter verrühren. Salzen und pfeffern.", "Gemüse mit dem Dip servieren."]),
 ("ofenapfel-zimt", "Ofenapfel mit Zimt", "snacks", 1, 30, "einfach",
  [("apfel", 1, "Stück"), ("haferflocken", 10, "g"), ("honig", 1, "TL"), ("zimt", 1, "Prise")],
  ["Ofen auf 180 °C (Umluft 160 °C) vorheizen.", "Apfel waschen. Das Kerngehäuse mit einem Löffel oder Apfelausstecher entfernen.", "Haferflocken, Honig und Zimt mischen. In den Apfel füllen.", "Apfel in eine kleine Form stellen. 20 bis 25 Minuten backen."]),
]

def kcal(iid, amount, unit):
    name, sc, ps, pu, price, k100, conv = I[iid]
    if iid == "eier":
        assert unit == "Stück"; return 80 * amount
    if unit in ("g", "ml"): g = amount
    else: g = amount * conv[unit]
    return g * (k100 or 0) / 100

recipes, used = [], set()
for rid, title, cat, serv, mins, diff, ings, steps in R:
    assert len(steps) <= 6, rid
    total = sum(kcal(*x) for x in ings)
    per = int(round(total / serv / 10.0) * 10)
    recipes.append({
        "id": rid, "title": title, "category": cat, "servings": serv,
        "timeMinutes": mins, "difficulty": diff,
        "kcalPerServing": per, "kcalIsEstimate": True,
        "ingredients": [{"ingredientId": i, "name": I[i][0], "amount": a, "unit": u} for i, a, u in ings],
        "steps": steps, "image": "rezept-%s.webp" % rid,
    })
    used.update(i for i, _, _ in ings)

with open(os.path.join(OUT, "recipes.json"), "w", encoding="utf-8") as f:
    json.dump({
        "version": 1, "language": "de",
        "kcalNote": "Kalorien je Portion sind geschätzt, berechnet aus üblichen Nährwerten und auf 10 kcal gerundet. Je nach Produkt kann der Wert abweichen.",
        "categories": [{"id": c, "label": l, "mealSlot": m} for c, l, m in CATS],
        "recipes": recipes,
    }, f, ensure_ascii=False, indent=2)

# Basis für die Einkaufsliste: baseUnit, Menge je Packung in baseUnit, Umrechnung Rezept-Einheit -> baseUnit
BASE = {
 "eier": ("Stück", 10, {"Stück": 1}),
 "zitrone": ("Stück", 1, {"Stück": 1}),
 "gurke": ("g", 400, {"Stück": 400}),
 "knoblauch": ("g", 40, {"Zehe": 4}),
 "kuerbis": ("g", 1000, {"Stück": 1000}),
 "lauch": ("g", 250, {"Stück": 250}),
 "radieschen": ("g", 200, {"Bund": 200}),
 "petersilie": ("g", 30, {"EL": 3}),
 "kichererbsen-dose": ("g", 240, {"Dose": 240}),
 "thunfisch-dose": ("g", 115, {"Dose": 115}),
 "salz": ("g", 500, {"Prise": 0.5}),
 "pfeffer": ("g", 50, {"Prise": 0.5}),
 "zimt": ("g", 40, {"Prise": 0.5}),
}
items = []
for iid in I:
    if iid not in used: continue
    name, sc, ps, pu, price, k100, conv = I[iid]
    if iid in BASE:
        bu, pba, u2b = BASE[iid]
    else:
        bu, pba = pu, ps
        u2b = {k: v for k, v in conv.items() if v}
    units = {u for r in recipes for x in r["ingredients"] if x["ingredientId"] == iid for u in [x["unit"]]}
    for u in units:
        assert u == bu or u in u2b, (iid, u)
    items.append({"ingredientId": iid, "name": name, "category": sc,
                  "packageSize": ps, "packageUnit": pu,
                  "estimatedPriceEur": price, "isEstimate": True,
                  "baseUnit": bu, "packageBaseAmount": pba, "unitToBase": u2b})
with open(os.path.join(OUT, "prices.json"), "w", encoding="utf-8") as f:
    json.dump({
        "version": 1, "currency": "EUR", "asOf": "2026-11",
        "note": "Richtpreise, geschätzt, Stand 11/2026. Tatsächliche Preise können abweichen.",
        "categories": [{"id": c, "label": l} for c, l in SHOP_CATS],
        "items": items,
    }, f, ensure_ascii=False, indent=2)
print(len(recipes), "Rezepte,", len(items), "Zutaten")
for r in recipes: print(r["kcalPerServing"], r["id"])
