# Chrome Web Store – Upload-Checkliste

Alle Inhalte dafür liegen in diesem Ordner (`store-assets/`) sowie unter `docs/`.

## 1. Entwicklerkonto
- [ ] Auf https://chrome.google.com/webstore/devconsole registrieren (einmalig 5 $ Gebühr).

## 2. Neuer Eintrag → Paket hochladen
- [ ] ZIP-Datei hochladen: `.output/moodleloader-0.1.1-chrome.zip`
  (bei jeder neuen Version die aktuelle Zip aus `.output/` verwenden, Dateiname enthält die Versionsnummer).

## 3. Tab "Store-Eintrag" (Store listing)
Texte zum Kopieren: [`store-assets/../docs/store-listing.md`](../docs/store-listing.md)
- [ ] Name: `MoodleLoader`
- [ ] Kurzbeschreibung einfügen
- [ ] Ausführliche Beschreibung einfügen
- [ ] Kategorie: Produktivität
- [ ] Sprache: Deutsch
- [ ] Symbol (Icon): `public/icon/128.png`
- [ ] Screenshots hochladen (Reihenfolge wie gewünscht):
  - `store-assets/screenshots/shot1-course.png`
  - `store-assets/screenshots/shot2-progress.png`
  - `store-assets/screenshots/shot3-dashboard.png`
  - `store-assets/screenshots/shot4-options.png`
- [ ] Promo-Kachel (klein, 440×280): `store-assets/screenshots/promo-tile.png`
- [ ] Offizielle Website: `https://github.com/CtrlCup/MoodleLoader`
- [ ] Support-URL: `https://github.com/CtrlCup/MoodleLoader/issues`

## 4. Tab "Datenschutzpraktiken" (Privacy practices)
Texte zum Kopieren: [`docs/permission-justifications.md`](../docs/permission-justifications.md)
- [ ] Single Purpose Description einfügen
- [ ] Für jede Berechtigung (`downloads`, `storage`, `activeTab`/Host-Berechtigung, `scripting`, `tabs`, `webRequest`) die passende Begründung einfügen
- [ ] Datenschutzerklärung-URL: `https://ctrlcup.github.io/MoodleLoader/privacy-policy.html`
- [ ] Bei "Welche Nutzerdaten werden erhoben?" **keine** Kategorie ankreuzen
- [ ] Die drei Zertifizierungs-Checkboxen am Ende bestätigen

## 5. Tab "Vertrieb" (Distribution)
- [ ] Sichtbarkeit wählen: **Öffentlich** (oder erstmal "Nicht gelistet", um vor Veröffentlichung selbst zu testen)
- [ ] Länder: Alle Regionen (oder nach Wunsch einschränken)
- [ ] Preis: Kostenlos

## 6. Einreichen
- [ ] "Zur Prüfung einreichen" klicken
- [ ] Prüfzeit einplanen: bei den verwendeten "powerful permissions" (`host_permissions: *://*/*`, `webRequest`) oft **mehrere Tage bis 2-3 Wochen**, nicht nur Stunden
- [ ] Bei Rückfragen/Ablehnung durch Google: meist wird eine genauere Begründung zu `host_permissions` verlangt - dafür den Text aus `permission-justifications.md` als Grundlage nehmen und ggf. erweitern

## Bei zukünftigen Updates
1. Version in `package.json` erhöhen (einzige Stelle, siehe `CLAUDE.md`)
2. `npm run build && npm run zip`
3. Neue Zip aus `.output/` im Dashboard unter "Paket" hochladen
4. Falls sich Beschreibung/Screenshots geändert haben, im Store-Eintrag aktualisieren
5. Erneut zur Prüfung einreichen (Updates werden i.d.R. schneller geprüft als Erstveröffentlichungen)
