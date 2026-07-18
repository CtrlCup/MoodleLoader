# Chrome Web Store – Berechtigungs-Begründungen

Diese Texte gehören in den Tab **"Datenschutzpraktiken" (Privacy practices)** im Developer-Dashboard.
Jede Berechtigung hat dort ein eigenes Freitextfeld "Begründung" (Justification).

## Single Purpose Description
```
MoodleLoader hat genau einen Zweck: das automatische Herunterladen aller Dateien eines
Moodle-Kurses (Ressourcen, Ordner, Aufgaben-Anhänge, verlinkte Cloud-Dateien) in einen lokal
strukturierten Ordner, ausgelöst durch einen expliziten Klick der Nutzerin/des Nutzers.
```

## Permission Justifications

### `downloads`
```
Wird benötigt, um die vom Nutzer ausgewählten Kursdateien über die Downloads-API des
Browsers in einen strukturierten lokalen Ordner zu speichern - die Kernfunktion der
Erweiterung. Ohne diese Berechtigung kann MoodleLoader keine Dateien speichern.
```

### `storage`
```
Speichert lokal die Nutzereinstellungen (Name des Downloadordners, Verhalten bei bereits
vorhandenen Dateien, Hell-/Dunkel-Theme) sowie den Fortschritt eines laufenden
Download-Vorgangs, damit dieser beim erneuten Öffnen des Popups weiter angezeigt werden
kann. Es werden keine Inhalte oder personenbezogenen Daten gespeichert.
```

### `activeTab` und Host-Berechtigung `*://*/*`
```
MoodleLoader muss den Inhalt der aktuell geöffneten Seite auslesen können, um zu erkennen,
ob es sich um eine Moodle-Instanz handelt, und um die darin verlinkten Dateien zu finden.
Da Moodle von Hochschulen und Unternehmen selbst gehostet wird und dadurch auf beliebigen,
nicht vorhersagbaren Domains läuft, kann keine feste Liste von Adressen hinterlegt werden.
Die Erweiterung prüft bei jedem Seitenaufruf zunächst rein lokal anhand typischer
Moodle-Merkmale, ob sie überhaupt aktiv werden soll - auf allen anderen Seiten bleibt sie
inaktiv und liest oder verändert nichts.
```

### `scripting`
```
Wird verwendet, um die Scan-Logik (Erkennung von Kursdateien) gezielt in dem Tab
auszuführen, den die Nutzerin/der Nutzer für den Download eines Kurses ausgewählt hat -
zum Beispiel wenn mehrere Kurse gleichzeitig über die Dashboard-Mehrfachauswahl
heruntergeladen werden.
```

### `tabs`
```
Wird für die Dashboard-Mehrfachauswahl benötigt: Wenn mehrere Kurse auf einmal
heruntergeladen werden, öffnet MoodleLoader jeden ausgewählten Kurs kurz in einem eigenen
Tab, um ihn zu scannen, und schließt diesen Tab danach wieder automatisch. Es werden keine
Tab-Inhalte an Dritte übermittelt.
```

### `webRequest`
```
Wird ausschließlich lesend (nicht blockierend/verändernd) verwendet, um bei externen
Weiterleitungslinks (z.B. verlinkte Aufzeichnungen oder Cloud-Ordner) die tatsächliche
Ziel-URL zu ermitteln, damit die richtige Datei heruntergeladen werden kann. Es werden keine
Netzwerkanfragen verändert, blockiert oder protokolliert.
```

## Datennutzung (Checkboxen im Dashboard)

Bei "What user data do you plan to collect from users now or in the future?" **keine der
Kategorien ankreuzen** (Personally identifiable information, Health info, Financial info,
Authentication info, Personal communications, Location, Web history, User activity,
Website content) - MoodleLoader sammelt/überträgt keine dieser Daten an den Entwickler oder
Dritte, siehe [Datenschutzerklärung](https://ctrlcup.github.io/MoodleLoader/privacy-policy.html).

Die drei Zertifizierungs-Checkboxen am Ende (kein Verkauf an Dritte, keine Nutzung
außerhalb des angegebenen Zwecks, keine Nutzung für Kreditwürdigkeitsprüfung/Kredite)
können alle **bestätigt** werden.

**Datenschutzerklärung-URL:**
```
https://ctrlcup.github.io/MoodleLoader/privacy-policy.html
```
