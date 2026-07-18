import { browser } from 'wxt/browser';
import type { ContentRequest, CourseTarget, ScanResponse } from './types';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tab wird bewusst aktiv (fokussiert) erstellt: Chrome "friert" Hintergrund-Tabs, die nie
 * fokussiert waren, vollständig ein (nicht nur Timer-Drosselung, sondern komplette
 * JS-Ausführungspause) - das würde den Scan (inkl. Kachel-Klick-Simulation) auf unbestimmte Zeit
 * hängen lassen, ganz ohne Fehler. Ein kurz sichtbarer Tab-Wechsel ist der Preis für einen
 * zuverlässigen Scan.
 */
export async function createForegroundTab(url: string): Promise<number> {
  const tab = await browser.tabs.create({ url, active: true });
  if (tab.id == null) {
    throw new Error(`Konnte keinen Tab für "${url}" öffnen.`);
  }
  return tab.id;
}

/** Wartet, bis ein Tab seine Navigation abgeschlossen hat (Status "complete"). */
export function waitForTabComplete(tabId: number, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timeout beim Laden des Kurs-Tabs'));
    }, timeoutMs);

    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    browser.tabs.onUpdated.addListener(listener);
  });
}

async function scanViaExecuteScript(tabId: number, saveCourseAsHtml: boolean): Promise<ScanResponse> {
  const [injection] = await browser.scripting.executeScript({
    target: { tabId },
    func: (saveHtml: boolean) => window.__moodleLoaderHandleScan?.(saveHtml),
    args: [saveCourseAsHtml],
  });
  if (!injection || injection.result == null) {
    throw new Error('Scan im Kurs-Tab lieferte kein Ergebnis.');
  }
  return injection.result as ScanResponse;
}

/**
 * Scannt einen Kurs nach Dateien. Ist `course.url` nicht gesetzt, wird der aktuell aktive Tab
 * verwendet (der Nutzer hat den Kurs bereits offen). Andernfalls wird ein eigener Tab für diesen
 * Kurs geöffnet (kurz sichtbar, siehe createForegroundTab) und danach wieder geschlossen, wobei
 * der zuvor aktive Tab (z.B. das Dashboard) wieder in den Vordergrund geholt wird.
 */
export async function scanCourse(course: CourseTarget, activeTabId: number, saveCourseAsHtml: boolean): Promise<ScanResponse> {
  if (!course.url) {
    const message: ContentRequest = { type: 'moodleloader:scan', saveCourseAsHtml };
    return (await browser.tabs.sendMessage(activeTabId, message)) as ScanResponse;
  }

  const tabId = await createForegroundTab(course.url);
  try {
    await waitForTabComplete(tabId);
    await sleep(200);
    return await scanViaExecuteScript(tabId, saveCourseAsHtml);
  } finally {
    browser.tabs.remove(tabId).catch(() => {});
    browser.tabs.update(activeTabId, { active: true }).catch(() => {});
  }
}
