# MoodleLoader

Lädt einen kompletten Moodle-Kurs – Dateien, Ordner, Abgaben/Abgabeordner und (wo möglich) externe
Cloud-Freigabe-Links – mit einem Klick in einen sauber strukturierten lokalen Ordner herunter.
Aufrufbar direkt aus einem Moodle-Kurs oder vom Moodle-Dashboard aus (dort auch für mehrere Kurse
gleichzeitig).

Verfügbar für **Chrome, Firefox und Safari** (eine gemeinsame Codebasis, gebaut mit [WXT](https://wxt.dev)).

![Version](https://img.shields.io/badge/version-0.1.0-blue)

## Funktionen

- **Ein Klick, kompletter Kurs**: Popup-Icon in einem Moodle-Kurs anklicken → "Kurs herunterladen".
- **Vom Dashboard aus**: Mehrere Kurse auf einmal auswählen und nacheinander herunterladen (läuft im
  Hintergrund weiter, auch wenn das Popup geschlossen wird oder man den Tab wechselt).
- Erfasst Ressourcen (PDF, Office-Dateien, Skripte, ...), Ordner-Aktivitäten, Aufgaben-Anhänge
  (Angaben des Dozenten *und* eigene Abgaben), Foren-Anhänge und Textseiten.
- Erkennt externe Cloud-Freigabe-Links (Nextcloud/ownCloud-basiert, z.B. bwSync&Share, Sciebo,
  LRZ Sync+Share) und lädt die Datei direkt statt nur die Verlinkungsseite.
- Optional: kompletter Kurs zusätzlich als HTML-Seite speichern (für späteres Nachschlagen der
  Kursinhalte, auch wenn der Moodle-Zugriff einmal wegfällt).
- Konfigurierbares Verhalten bei bereits vorhandenen Dateien: **Ersetzen**, **Kopie anlegen**
  (`Name (01).endung`, `Name (02).endung`, ...) oder **Überspringen**.
- Modernes UI mit Hell-/Dunkel-/System-Theme.
- Versionierung ab `0.1.0`.

## Installation

### Chrome (und andere Chromium-Browser: Edge, Brave, Opera, Vivaldi, ...)

1. [`moodleloader-0.1.0-chrome.zip`](../../releases/latest) herunterladen und entpacken.
2. `chrome://extensions` öffnen.
3. Oben rechts **Entwicklermodus** aktivieren.
4. **Entpackte Erweiterung laden** klicken und den entpackten Ordner auswählen.
5. Fertig – das MoodleLoader-Icon erscheint in der Symbolleiste.

> Da die Extension nicht im Chrome Web Store veröffentlicht ist, muss dieser Schritt nach jedem
> Chrome-Neustart nicht wiederholt werden – die Erweiterung bleibt installiert, bis sie manuell
> entfernt wird oder der Entwicklermodus deaktiviert wird.

### Firefox

**Temporär (bis zum nächsten Firefox-Neustart):**

1. [`moodleloader-0.1.0-firefox.zip`](../../releases/latest) herunterladen (nicht entpacken).
2. `about:debugging#/runtime/this-firefox` öffnen.
3. **Temporäres Add-on laden** klicken und die `.zip`-Datei auswählen.

**Dauerhaft:** Firefox verlangt für dauerhaft installierte Add-ons eine Signierung durch Mozilla
(auch für private Nutzung, außer bei der Firefox Developer/Nightly-Edition mit deaktivierter
Signaturprüfung `xpinstall.signatures.required = false` in `about:config`). Alternativ die
[`moodleloader-0.1.0-sources.zip`](../../releases/latest) bei
[addons.mozilla.org](https://addons.mozilla.org/developers/) als "Unlisted"-Add-on hochladen und
signieren lassen, dann die signierte `.xpi`-Datei dauerhaft installieren.

### Safari (macOS)

Safari-Web-Extensions müssen von Apple über Xcode gebaut/signiert werden – das ist von Windows aus
nicht möglich. Auf einem Mac:

1. [`moodleloader-0.1.0-safari.zip`](../../releases/latest) herunterladen und entpacken.
2. Im Terminal:
   ```bash
   xcrun safari-web-extension-converter /pfad/zum/entpackten/moodleloader-0.1.0-safari-Ordner
   ```
3. Das dabei erzeugte Xcode-Projekt öffnen und auf **Run** klicken (baut und installiert die
   zugehörige macOS-App samt Extension).
4. In Safari unter **Einstellungen → Erweiterungen** MoodleLoader aktivieren.
5. Ggf. unter **Safari → Einstellungen → Erweiterungen → MoodleLoader** die Berechtigung "Auf allen
   Websites erlauben" setzen, sowie in den Entwickler-Einstellungen "Nicht signierte Erweiterungen
   erlauben" aktivieren, falls Safari die selbstgebaute Erweiterung sonst blockiert.

## Einstellungen

Über das Zahnrad-Symbol im Popup erreichbar:

| Einstellung | Beschreibung |
|---|---|
| **Downloadordner** | Unterordnername relativ zum Standard-Downloads-Ordner des Browsers (Standard: `Moodle`). Browser-Erweiterungen dürfen aus Sicherheitsgründen nur *innerhalb* des Downloads-Ordners speichern, kein beliebiger Pfad auf der Festplatte. |
| **Bei vorhandenen Dateien** | Ersetzen / Kopie anlegen (Standard) / Überspringen. |
| **Kurs als HTML speichern** | Standardmäßig an/aus für neue Downloads. |
| **Erscheinungsbild** | Hell / Dunkel / System. |

Innerhalb des Downloadordners wird für jeden Kurs automatisch ein eigener Unterordner angelegt
(z.B. `Downloads/Moodle/Regelungstechnik 1 (EIB4, SMS4, SET5) Reuter/Übungen/Übung 4/...`).

## Bekannte Einschränkungen

Diese Punkte sind bewusste Sicherheitsgrenzen von Browsern bzw. Chrome selbst, keine Bugs:

- **Kein beliebiger Speicherort**: nur Unterordner innerhalb des Downloads-Ordners möglich (siehe oben).
- **Kachel-Kursformate** (`format_tiles`): Manche Moodle-Kurse laden den Inhalt einer Kachel erst per
  AJAX nach, sobald sie angeklickt wird. MoodleLoader simuliert diesen Klick automatisch, wenn der
  Kurs direkt geöffnet ist – bei sehr langsamen Moodle-Instanzen oder bei Download über die
  Dashboard-Mehrfachauswahl (kein aktiver Tab auf der Kursseite) kann das Nachladen unvollständig
  bleiben. In dem Fall den Kurs einmal direkt öffnen und erneut herunterladen.
- **Externe Links ohne CORS-Freigabe**: Wenn eine Moodle-Verlinkung sofort auf eine fremde Domain
  weiterleitet, kann JavaScript das Linkziel aus Sicherheitsgründen nicht auslesen. MoodleLoader
  übergibt in diesem Fall die Moodle-Linkseite direkt an den Download-Manager des Browsers, der die
  Weiterleitung ausführt – landet man dabei auf einer Webseite statt einer Datei, wird diese Webseite
  gespeichert.
- **Downloads von unbekannten externen Domains** (z.B. erstmaliger Download von einem
  Cloud-Anbieter) können von Chrome selbst mit einer Sicherheits-/Speicherort-Abfrage versehen
  werden – das ist eine Chrome-eigene Schutzfunktion, keine Einstellung von MoodleLoader.
- **Duplikat-Erkennung** basiert auf dem Download-Verlauf des Browsers. Dateien, die außerhalb des
  Browsers manuell in den Ordner gelegt oder aus dem Verlauf gelöscht wurden, werden nicht erkannt.
- Unterstützte Moodle-Aktivitätstypen: Ressourcen, Ordner, Aufgaben (Angaben + eigene Abgaben),
  Foren-Anhänge, Textseiten, externe URLs. Quiz, Lektion, Buch, Chat, Workshop u.ä. werden aktuell
  nicht durchsucht.

## Entwicklung

```bash
npm install
npm run dev            # Chrome, mit Hot-Reload
npm run dev:firefox    # Firefox, mit Hot-Reload
npm run compile        # TypeScript-Typprüfung
npm run build          # Produktions-Build Chrome  -> .output/chrome-mv3
npm run build:firefox  # Produktions-Build Firefox -> .output/firefox-mv2
npm run build:safari   # Produktions-Build Safari  -> .output/safari-mv2
npm run zip            # Chrome-Zip für Verteilung
npm run zip:firefox    # Firefox-Zip für Verteilung
npm run zip:safari     # Safari-Zip für Verteilung
```

Architektur-Details stehen in [`CLAUDE.md`](./CLAUDE.md).

---

Mit ♥ von Alex programmiert.
