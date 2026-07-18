import { browser } from 'wxt/browser';
import { buildDownloadPath, withCopyIndex } from './path-utils';
import { getSettings } from './settings';
import type { CourseTarget, DiscoveredFile, DownloadProgress, DownloadRunState, ScanResponse } from './types';

export const ACTIVE_DOWNLOAD_STORAGE_KEY = 'moodleloader:active';

/** Pause zwischen zwei Kursen bei Mehrfach-Downloads, damit Moodle nicht durch viele schnell
 * aufeinanderfolgende Anfragen (Scan + Downloads) blockiert/gedrosselt wird. */
const DELAY_BETWEEN_COURSES_MS = 1500;

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

async function downloadFile(url: string, filename: string): Promise<void> {
  await browser.downloads.download({ url, filename, conflictAction: 'overwrite' });
}

async function persistState(state: DownloadRunState): Promise<void> {
  try {
    await browser.storage.local.set({ [ACTIVE_DOWNLOAD_STORAGE_KEY]: state });
  } catch {
    // Persistenz ist ein reines Komfort-Feature - Downloads laufen auch ohne sie weiter.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadCourseFiles(
  courseName: string,
  files: DiscoveredFile[],
  fileProgress: DownloadProgress,
  emit: () => Promise<void>,
): Promise<void> {
  const settings = await getSettings();

  for (const file of files) {
    fileProgress.currentFile = file.filename;
    await emit();

    const relativePath = buildDownloadPath(settings.baseFolder, courseName, file.subPath, file.filename);
    try {
      const resolution = await resolveConflict(relativePath, settings.conflictAction);
      if (resolution.action === 'skip') {
        fileProgress.skipped += 1;
      } else {
        await downloadFile(file.url, resolution.path);
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
  const state: DownloadRunState = {
    courseIndex: 0,
    totalCourses: courses.length,
    courseLabel: '',
    fileProgress: { total: 0, done: 0, failed: 0, skipped: 0, finished: false },
    finished: false,
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
    const course = courses[i];
    state.courseIndex = i + 1;
    state.courseLabel = courses.length > 1 ? `(${i + 1}/${courses.length}) ${course.name}` : course.name;
    state.fileProgress = { total: 0, done: 0, failed: 0, skipped: 0, finished: false, currentFile: 'Scanne Kursseite ...' };
    await emit();

    const scan = (await browser.tabs.sendMessage(tabId, {
      type: 'moodleloader:scan',
      saveCourseAsHtml,
      courseUrl: course.url,
    })) as ScanResponse;
    state.warningsByCourse.push([scan.courseName, scan.warnings]);

    state.fileProgress = { total: scan.files.length, done: 0, failed: 0, skipped: 0, finished: false };
    await emit();

    await downloadCourseFiles(scan.courseName, scan.files, state.fileProgress, emit);
    state.totals.done += state.fileProgress.done;
    state.totals.failed += state.fileProgress.failed;
    state.totals.skipped += state.fileProgress.skipped;
    await emit();

    if (i < courses.length - 1) {
      await sleep(DELAY_BETWEEN_COURSES_MS);
    }
  }

  state.finished = true;
  await emit();
}
