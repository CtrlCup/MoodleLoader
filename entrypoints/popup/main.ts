import { browser } from 'wxt/browser';
import { ACTIVE_DOWNLOAD_STORAGE_KEY } from '../../lib/download-manager';
import { getSettings, saveSettings } from '../../lib/settings';
import type {
  BackgroundRequest,
  ContentRequest,
  CourseTarget,
  DashboardCourseLink,
  DetectResponse,
  DownloadRunState,
  ProgressMessage,
  Settings,
} from '../../lib/types';
import './style.css';

/** Wie lange nach Abschluss eine fertige Zusammenfassung beim erneuten Öffnen noch angezeigt wird. */
const STALE_SUMMARY_MS = 10 * 60 * 1000;

const app = document.querySelector<HTMLDivElement>('#app')!;

let settings: Settings = await getSettings();
applyTheme(settings.theme);

renderShell();

const active = await checkActiveDownload();
if (active) {
  resumeActiveDownload(active);
} else {
  await startNormalFlow();
}

async function startNormalFlow() {
  const activeTab = await getActiveTab();
  const detection = activeTab?.id != null ? await detectPage(activeTab.id) : null;

  if (!activeTab?.id || !detection || !detection.isMoodle) {
    renderNotMoodle();
  } else if (detection.pageKind === 'dashboard') {
    renderDashboard(activeTab.id, detection.dashboardCourses ?? []);
  } else if (detection.pageKind === 'course') {
    renderCourse(activeTab.id, detection.courseName ?? 'Kurs');
  } else {
    renderNotMoodle();
  }
}

async function checkActiveDownload(): Promise<DownloadRunState | null> {
  try {
    const stored = await browser.storage.local.get(ACTIVE_DOWNLOAD_STORAGE_KEY);
    const state = stored[ACTIVE_DOWNLOAD_STORAGE_KEY] as DownloadRunState | undefined;
    if (!state) return null;
    if (state.finished && Date.now() - state.updatedAt > STALE_SUMMARY_MS) return null;
    return state;
  } catch {
    return null;
  }
}

async function clearActiveDownload() {
  try {
    await browser.storage.local.remove(ACTIVE_DOWNLOAD_STORAGE_KEY);
  } catch {
    // egal, wird beim nächsten Lauf ohnehin überschrieben
  }
}

function resumeActiveDownload(state: DownloadRunState) {
  renderProgress(state);
  if (state.finished) {
    renderSummary(state);
  } else {
    listenForProgress();
  }
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function detectPage(tabId: number): Promise<DetectResponse | null> {
  try {
    const message: ContentRequest = { type: 'moodleloader:detect' };
    return (await browser.tabs.sendMessage(tabId, message)) as DetectResponse;
  } catch {
    return null;
  }
}

function applyTheme(theme: Settings['theme']) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function renderShell() {
  app.innerHTML = `
    <div class="header">
      <div class="brand">
        <div class="brand-logo">M</div>
        <span>MoodleLoader</span>
      </div>
      <div style="display:flex; gap:4px;">
        <button class="icon-btn" id="theme-toggle" title="Theme wechseln">◐</button>
        <button class="icon-btn" id="open-options" title="Einstellungen">⚙</button>
      </div>
    </div>
    <div class="content" id="content"></div>
  `;
  document.querySelector<HTMLButtonElement>('#open-options')!.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
  document.querySelector<HTMLButtonElement>('#theme-toggle')!.addEventListener('click', async () => {
    const order: Settings['theme'][] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(settings.theme) + 1) % order.length];
    settings = { ...settings, theme: next };
    applyTheme(next);
    await saveSettings(settings);
  });
}

function getContent(): HTMLDivElement {
  return document.querySelector<HTMLDivElement>('#content')!;
}

function renderNotMoodle() {
  getContent().innerHTML = `
    <div class="empty-state">
      Diese Seite ist keine erkannte Moodle-Instanz.<br />
      Öffne einen Moodle-Kurs oder das Dashboard und öffne die Extension erneut.
    </div>
  `;
}

function renderCourse(tabId: number, courseName: string) {
  getContent().innerHTML = `
    <div class="course-name">${escapeHtml(courseName)}</div>
    <label class="checkbox-row">
      <input type="checkbox" id="save-html" ${settings.saveCourseAsHtml ? 'checked' : ''} />
      Kurs zusätzlich als HTML-Seite speichern
    </label>
    <button class="btn btn-primary" id="start-download">Kurs herunterladen</button>
  `;

  const saveHtmlBox = document.querySelector<HTMLInputElement>('#save-html')!;
  saveHtmlBox.addEventListener('change', async () => {
    settings = { ...settings, saveCourseAsHtml: saveHtmlBox.checked };
    await saveSettings(settings);
  });

  document.querySelector<HTMLButtonElement>('#start-download')!.addEventListener('click', () => {
    startBatchDownload(tabId, [{ name: courseName }], saveHtmlBox.checked);
  });
}

function renderDashboard(tabId: number, courses: DashboardCourseLink[]) {
  if (courses.length === 0) {
    getContent().innerHTML = `<div class="empty-state">Keine Kurse auf dieser Seite gefunden.</div>`;
    return;
  }

  getContent().innerHTML = `
    <label class="checkbox-row">
      <input type="checkbox" id="select-all" />
      <strong>Alle auswählen</strong>
    </label>
    <div class="divider"></div>
    <div class="course-list" id="course-list">
      ${courses
        .map(
          (c, i) => `
        <label class="checkbox-row">
          <input type="checkbox" class="course-checkbox" data-index="${i}" />
          <span>${escapeHtml(c.name)}</span>
        </label>`,
        )
        .join('')}
    </div>
    <label class="checkbox-row">
      <input type="checkbox" id="save-html" ${settings.saveCourseAsHtml ? 'checked' : ''} />
      Kurse zusätzlich als HTML-Seite speichern
    </label>
    <button class="btn btn-primary" id="start-download">Ausgewählte Kurse herunterladen</button>
  `;

  const selectAll = document.querySelector<HTMLInputElement>('#select-all')!;
  const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('.course-checkbox'));
  selectAll.addEventListener('change', () => {
    checkboxes.forEach((cb) => (cb.checked = selectAll.checked));
  });

  const saveHtmlBox = document.querySelector<HTMLInputElement>('#save-html')!;
  saveHtmlBox.addEventListener('change', async () => {
    settings = { ...settings, saveCourseAsHtml: saveHtmlBox.checked };
    await saveSettings(settings);
  });

  document.querySelector<HTMLButtonElement>('#start-download')!.addEventListener('click', () => {
    const selected = checkboxes.filter((cb) => cb.checked).map((cb) => courses[Number(cb.dataset.index)]);
    if (selected.length === 0) return;
    const targets: CourseTarget[] = selected.map((c) => ({ name: c.name, url: c.url }));
    startBatchDownload(tabId, targets, saveHtmlBox.checked);
  });
}

function renderProgress(state: DownloadRunState) {
  getContent().innerHTML = `
    <div class="card">
      <div class="course-name" id="progress-label">${escapeHtml(state.courseLabel)}</div>
      <div style="height:8px;"></div>
      <div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
      <div style="height:8px;"></div>
      <div class="progress-stats">
        <span id="progress-current" class="subtle"></span>
        <span id="progress-count" class="subtle">0 / 0</span>
      </div>
    </div>
    <div class="subtle" style="text-align:center;">Läuft im Hintergrund weiter, auch wenn dieses Fenster geschlossen wird.</div>
  `;
  updateProgressUi(state);
}

function updateProgressUi(state: DownloadRunState) {
  const label = document.querySelector<HTMLDivElement>('#progress-label');
  const fill = document.querySelector<HTMLDivElement>('#progress-fill');
  const count = document.querySelector<HTMLSpanElement>('#progress-count');
  const current = document.querySelector<HTMLSpanElement>('#progress-current');
  if (!fill || !count || !current || !label) return;
  label.textContent = state.courseLabel;
  const { fileProgress } = state;
  const processed = fileProgress.done + fileProgress.failed + fileProgress.skipped;
  const pct = fileProgress.total === 0 ? 0 : Math.round((processed / fileProgress.total) * 100);
  fill.style.width = `${pct}%`;
  count.textContent = `${processed} / ${fileProgress.total}`;
  current.textContent = fileProgress.currentFile ? `Lädt: ${fileProgress.currentFile}` : '';
}

function renderSummary(state: DownloadRunState) {
  const warningsHtml = state.warningsByCourse
    .filter(([, w]) => w.length > 0)
    .map(([name, w]) => `<div><strong>${escapeHtml(name)}:</strong><br/>${w.map(escapeHtml).join('<br/>')}</div>`)
    .join('');

  const title = state.totalCourses > 1 ? `${state.totalCourses} Kurse` : state.courseLabel;

  getContent().innerHTML = `
    <div class="card">
      <div class="course-name status-ok">✓ Fertig: ${escapeHtml(title)}</div>
      <div class="subtle" style="margin-top:6px;">
        ${state.totals.done} heruntergeladen · ${state.totals.skipped} übersprungen
        ${state.totals.failed > 0 ? `· <span class="status-danger">${state.totals.failed} fehlgeschlagen</span>` : ''}
      </div>
      ${warningsHtml ? `<div class="divider" style="margin:10px 0;"></div><div class="warnings">${warningsHtml}</div>` : ''}
    </div>
    <button class="btn btn-secondary" id="back">Zurück</button>
  `;
  document.querySelector<HTMLButtonElement>('#back')!.addEventListener('click', async () => {
    await clearActiveDownload();
    location.reload();
  });
}

function startBatchDownload(tabId: number, courses: CourseTarget[], saveCourseAsHtml: boolean) {
  renderProgress({
    courseIndex: 0,
    totalCourses: courses.length,
    courseLabel: courses.length > 1 ? `(1/${courses.length}) ${courses[0].name}` : courses[0].name,
    fileProgress: { total: 0, done: 0, failed: 0, skipped: 0, finished: false, currentFile: 'Scanne Kursseite ...' },
    finished: false,
    totals: { done: 0, failed: 0, skipped: 0 },
    warningsByCourse: [],
    updatedAt: Date.now(),
  });
  listenForProgress();
  const message: BackgroundRequest = { type: 'moodleloader:download-batch', tabId, courses, saveCourseAsHtml };
  browser.runtime.sendMessage(message);
}

function listenForProgress(): void {
  const listener = (message: ProgressMessage) => {
    if (message?.type !== 'moodleloader:progress') return;
    updateProgressUi(message.state);
    if (message.state.finished) {
      browser.runtime.onMessage.removeListener(listener);
      renderSummary(message.state);
    }
  };
  browser.runtime.onMessage.addListener(listener);
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
