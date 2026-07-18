import { browser } from 'wxt/browser';
import { resolveCloudDownloadUrl } from './cloud-links';
import { fetchFileViaTab } from './download-fallback';
import { buildDownloadPath, withCopyIndex } from './path-utils';
import { resolveRedirectTarget } from './redirect-resolver';
import { getSettings } from './settings';
import { scanCourse, sleep } from './tab-scan';
import type { CourseTarget, DiscoveredFile, DownloadProgress, DownloadRunState } from './types';

export const ACTIVE_DOWNLOAD_STORAGE_KEY = 'moodleloader:active';

/** Pause zwischen zwei Kursen bei Mehrfach-Downloads, damit Moodle nicht durch viele schnell
 * aufeinanderfolgende Anfragen (Scan + Downloads) blockiert/gedrosselt wird. */
const DELAY_BETWEEN_COURSES_MS = 1500;

/** Gesetzt, wenn der Nutzer den laufenden Lauf über das X im Popup abbricht. */
let cancelRequested = false;

export function requestCancel(): void {
  cancelRequested = true;
}

/** Prüft anhand des Browser-Download-Verlaufs, ob unter diesem relativen Pfad bereits eine Datei existiert. */
async function existsInDownloadHistory(relativePath: string): Promise<boolean> {
  const baseName = relativePath.split('/').pop();
  if (!baseName) return false;
  const forwardSuffix = relativePath;
  const backslashSuffix = relativePath.replace(/\//g, '\\');
  const results = await browser.downloads.search({
    query: [baseName],
    exists: true,
    limit: 200,
  });
  return results.some((item) => item.filename?.endsWith(forwardSuffix) || item.filename?.endsWith(backslashSuffix));
}

function withCopyIndexPath(relativePath: string, index: number): string {
  const lastSlash = relativePath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? relativePath.slice(0, lastSlash + 1) : '';
  const name = lastSlash >= 0 ? relativePath.slice(lastSlash + 1) : relativePath;
  return dir + withCopyIndex(name, index);
}

interface ConflictResolution {
  path: string;
  action: 'download' | 'skip';
}

async function resolveConflict(
  relativePath: string,
  conflictAction: 'replace' | 'copy' | 'skip',
): Promise<ConflictResolution> {
  if (conflictAction === 'replace') {
    return { path: relativePath, action: 'download' };
  }
  const exists = await existsInDownloadHistory(relativePath);
  if (!exists) {
    return { path: relativePath, action: 'download' };
  }
  if (conflictAction === 'skip') {
    return { path: relativePath, action: 'skip' };
  }
  for (let i = 1; i < 1000; i++) {
    const candidate = withCopyIndexPath(relativePath, i);
    if (!(await existsInDownloadHistory(candidate))) {
      return { path: candidate, action: 'download' };
    }
  }
  return { path: relativePath, action: 'download' };
}

/**
 * Beobachtet einen laufenden Download und erkennt, ob er "hängen bleibt" (Übertragung bricht
 * nach einigen KB ab, ohne dass der Browser einen Fehler meldet - trat bei manchen Abgabedateien
 * auf, siehe fetchFileViaTab). Gilt erst nach fünf aufeinanderfolgenden Messungen ganz ohne neue
 * Bytes (~5s) als hängen geblieben, um langsame aber tatsächlich noch laufende Downloads (z.B.
 * große Dateien über eine langsame Verbindung) nicht fälschlich abzubrechen.
 */
async function waitForDownloadSettled(downloadId: number, timeoutMs = 20000): Promise<'complete' | 'stalled'> {
  const start = Date.now();
  let lastBytes = -1;
  let stableCount = 0;
  while (Date.now() - start < timeoutMs) {
    const [item] = await browser.downloads.search({ id: downloadId });
    if (!item) return 'stalled';
    if (item.state === 'complete') {
      // Manche Server/Proxys schließen die Verbindung vorzeitig, ohne dass Chrome dies als Fehler
      // wertet - Chrome meldet dann "complete", obwohl weniger Bytes ankamen als per
      // Content-Length angekündigt. Das erkennen wir hier zusätzlich zum reinen State-Check.
      if (item.totalBytes > 0 && item.fileSize > 0 && item.fileSize < item.totalBytes) {
        return 'stalled';
      }
      return 'complete';
    }
    if (item.state === 'interrupted') return 'stalled';
    if (item.bytesReceived === lastBytes) {
      stableCount += 1;
      if (stableCount >= 5) return 'stalled';
    } else {
      stableCount = 0;
      lastBytes = item.bytesReceived;
    }
    await sleep(1000);
  }
  return 'stalled';
}

async function downloadFile(url: string, filename: string): Promise<void> {
  const downloadId = await browser.downloads.download({ url, filename, conflictAction: 'overwrite' });
  const outcome = await waitForDownloadSettled(downloadId);
  if (outcome === 'complete') return;

  // Fallback: manche Downloads brechen über die downloads-API ab (z.B. FILE_FAILED oder
  // Verbindungsabbruch), obwohl derselbe Abruf per fetch() aus einem echten Seitenkontext heraus
  // zuverlässig funktioniert. Angebrochenen Download verwerfen und stattdessen über einen Tab neu holen.
  await browser.downloads.cancel(downloadId).catch(() => {});
  await browser.downloads.removeFile(downloadId).catch(() => {});
  const dataUrl = await fetchFileViaTab(url);
  await browser.downloads.download({ url: dataUrl, filename, conflictAction: 'overwrite' });
}

/**
 * Für Links, die per fetch() im Content-Script nicht aufgelöst werden konnten (Redirect auf eine
 * fremde Domain ohne CORS-Freigabe): hier im Hintergrund per webRequest-Beobachtung auflösen -
 * das unterliegt nicht denselben CORS-Beschränkungen wie fetch() im Content-Script.
 */
async function resolveFileUrl(file: DiscoveredFile): Promise<string> {
  if (file.source !== 'needs-redirect-resolution') return file.url;
  const resolved = await resolveRedirectTarget(file.url);
  return resolveCloudDownloadUrl(resolved);
}

async function persistState(state: DownloadRunState): Promise<void> {
  try {
    await browser.storage.local.set({ [ACTIVE_DOWNLOAD_STORAGE_KEY]: state });
  } catch {
    // Persistenz ist ein reines Komfort-Feature - Downloads laufen auch ohne sie weiter.
  }
}

async function downloadCourseFiles(
  courseName: string,
  files: DiscoveredFile[],
  fileProgress: DownloadProgress,
  emit: () => Promise<void>,
): Promise<void> {
  const settings = await getSettings();

  for (const file of files) {
    if (cancelRequested) break;

    fileProgress.currentFile = file.filename;
    await emit();

    const relativePath = buildDownloadPath(settings.baseFolder, courseName, file.subPath, file.filename);
    try {
      const resolution = await resolveConflict(relativePath, settings.conflictAction);
      if (resolution.action === 'skip') {
        fileProgress.skipped += 1;
      } else {
        const url = await resolveFileUrl(file);
        await downloadFile(url, resolution.path);
        fileProgress.done += 1;
      }
    } catch {
      fileProgress.failed += 1;
    }
    await emit();
  }

  fileProgress.finished = true;
  fileProgress.currentFile = undefined;
}

/**
 * Läuft im Hintergrund-Skript und scannt + lädt einen oder mehrere Kurse nacheinander herunter.
 * Läuft unabhängig davon weiter, ob das Popup geöffnet ist - der Fortschritt wird nach jedem
 * Schritt persistiert und per Broadcast gesendet, damit ein (wieder-)geöffnetes Popup jederzeit
 * den aktuellen Stand anzeigen kann.
 */
export async function runBatchDownload(
  tabId: number,
  courses: CourseTarget[],
  saveCourseAsHtml: boolean,
  onUpdate: (state: DownloadRunState) => void,
): Promise<void> {
  cancelRequested = false;
  const state: DownloadRunState = {
    courseIndex: 0,
    totalCourses: courses.length,
    courseLabel: '',
    fileProgress: { total: 0, done: 0, failed: 0, skipped: 0, finished: false },
    finished: false,
    cancelled: false,
    totals: { done: 0, failed: 0, skipped: 0 },
    warningsByCourse: [],
    updatedAt: Date.now(),
  };

  const emit = async () => {
    state.updatedAt = Date.now();
    onUpdate(state);
    await persistState(state);
  };

  for (let i = 0; i < courses.length; i++) {
    if (cancelRequested) break;

    const course = courses[i];
    state.courseIndex = i + 1;
    state.courseLabel = courses.length > 1 ? `(${i + 1}/${courses.length}) ${course.name}` : course.name;
    state.fileProgress = { total: 0, done: 0, failed: 0, skipped: 0, finished: false, currentFile: 'Scanne Kursseite ...' };
    await emit();

    const scan = await scanCourse(course, tabId, saveCourseAsHtml);
    state.warningsByCourse.push([scan.courseName, scan.warnings]);
    if (cancelRequested) break;

    state.fileProgress = { total: scan.files.length, done: 0, failed: 0, skipped: 0, finished: false };
    await emit();

    await downloadCourseFiles(scan.courseName, scan.files, state.fileProgress, emit);
    state.totals.done += state.fileProgress.done;
    state.totals.failed += state.fileProgress.failed;
    state.totals.skipped += state.fileProgress.skipped;
    await emit();

    if (cancelRequested) break;
    if (i < courses.length - 1) {
      await sleep(DELAY_BETWEEN_COURSES_MS);
    }
  }

  state.finished = true;
  state.cancelled = cancelRequested;
  await emit();
}
