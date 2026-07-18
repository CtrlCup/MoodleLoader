import { getSettings, saveSettings } from '../../lib/settings';
import type { ConflictAction, Settings, Theme } from '../../lib/types';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
let settings: Settings = await getSettings();
applyTheme(settings.theme);
render();

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function render() {
  app.innerHTML = `
    <div class="header">
      <div class="brand">
        <div class="brand-logo">M</div>
        <span>MoodleLoader – Einstellungen</span>
      </div>
      <span class="saved-indicator" id="saved">Gespeichert ✓</span>
    </div>

    <section class="card">
      <h2>Downloadordner</h2>
      <p class="hint">
        Aus Sicherheitsgründen dürfen Browser-Erweiterungen nur innerhalb des Standard-Downloads-Ordners
        speichern. Hier wird der Unterordnername festgelegt (Standard: <code>Moodle</code>). Innerhalb davon
        wird für jeden Kurs automatisch ein eigener Unterordner angelegt.
      </p>
      <input type="text" id="base-folder" value="${escapeAttr(settings.baseFolder)}" placeholder="Moodle" />
    </section>

    <section class="card">
      <h2>Bei bereits vorhandenen Dateien</h2>
      <p class="hint">Legt fest, was passieren soll, wenn eine Datei mit gleichem Namen bereits heruntergeladen wurde.</p>
      <label class="radio-row">
        <input type="radio" name="conflict" value="replace" ${settings.conflictAction === 'replace' ? 'checked' : ''} />
        <span>
          <div class="radio-label">Ersetzen</div>
          <div class="radio-desc">Vorhandene Datei wird überschrieben.</div>
        </span>
      </label>
      <label class="radio-row">
        <input type="radio" name="conflict" value="copy" ${settings.conflictAction === 'copy' ? 'checked' : ''} />
        <span>
          <div class="radio-label">Kopie anlegen</div>
          <div class="radio-desc">Neue Datei wird als "Name (01).endung", "Name (02).endung", ... gespeichert.</div>
        </span>
      </label>
      <label class="radio-row">
        <input type="radio" name="conflict" value="skip" ${settings.conflictAction === 'skip' ? 'checked' : ''} />
        <span>
          <div class="radio-label">Überspringen</div>
          <div class="radio-desc">Datei wird nicht erneut heruntergeladen.</div>
        </span>
      </label>
      <p class="hint" style="margin-top:10px;">
        Hinweis: Die Erkennung vorhandener Dateien basiert auf dem Download-Verlauf des Browsers. Dateien,
        die außerhalb von Chrome/Firefox manuell in den Ordner gelegt oder aus dem Verlauf gelöscht wurden,
        können nicht erkannt werden.
      </p>
    </section>

    <section class="card">
      <h2>Kursinhalt</h2>
      <label class="checkbox-row">
        <input type="checkbox" id="save-html" ${settings.saveCourseAsHtml ? 'checked' : ''} />
        Kurs standardmäßig zusätzlich als HTML-Seite speichern
      </label>
    </section>

    <section class="card">
      <h2>Erscheinungsbild</h2>
      <select id="theme-select">
        <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>System</option>
        <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Hell</option>
        <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dunkel</option>
      </select>
    </section>

    <footer>Mit ♥ von Alex programmiert<br />MoodleLoader v0.1.0</footer>
  `;

  bind();
}

function bind() {
  const baseFolder = document.querySelector<HTMLInputElement>('#base-folder')!;
  baseFolder.addEventListener('change', () => update({ baseFolder: baseFolder.value.trim() || 'Moodle' }));

  document.querySelectorAll<HTMLInputElement>('input[name="conflict"]').forEach((el) => {
    el.addEventListener('change', () => {
      if (el.checked) update({ conflictAction: el.value as ConflictAction });
    });
  });

  const saveHtml = document.querySelector<HTMLInputElement>('#save-html')!;
  saveHtml.addEventListener('change', () => update({ saveCourseAsHtml: saveHtml.checked }));

  const themeSelect = document.querySelector<HTMLSelectElement>('#theme-select')!;
  themeSelect.addEventListener('change', () => {
    const theme = themeSelect.value as Theme;
    applyTheme(theme);
    update({ theme });
  });
}

async function update(partial: Partial<Settings>) {
  settings = { ...settings, ...partial };
  await saveSettings(settings);
  const indicator = document.querySelector<HTMLSpanElement>('#saved')!;
  indicator.classList.add('visible');
  setTimeout(() => indicator.classList.remove('visible'), 1200);
}

function escapeAttr(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
