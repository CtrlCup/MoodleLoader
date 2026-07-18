import { browser } from 'wxt/browser';
import { detectPageKind, isMoodleSite, listDashboardCourses, scanCourse } from '../lib/moodle-scraper';
import type { ContentRequest, DetectResponse, ScanResponse } from '../lib/types';

declare global {
  interface Window {
    /**
     * Für Hintergrund-Tabs (Mehrfach-Kurs-Download vom Dashboard): Chrome kann inaktive
     * Hintergrund-Tabs "einfrieren", wodurch der runtime.onMessage-Kanal dauerhaft geschlossen
     * bleibt ("moved into back/forward cache"-Fehler). scripting.executeScript() funktioniert
     * dagegen auch bei eingefrorenen Tabs zuverlässig, da es nicht auf einen dauerhaften
     * Message-Port angewiesen ist, sondern den Code direkt zum Aufrufzeitpunkt ausführt.
     */
    __moodleLoaderHandleScan?: (saveCourseAsHtml: boolean) => Promise<ScanResponse>;
  }
}

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  main() {
    window.__moodleLoaderHandleScan = handleScan;

    browser.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
      if (message.type === 'moodleloader:detect') {
        handleDetect().then(sendResponse);
        return true;
      }
      if (message.type === 'moodleloader:scan') {
        handleScan(message.saveCourseAsHtml).then(sendResponse);
        return true;
      }
      return false;
    });
  },
});

async function handleDetect(): Promise<DetectResponse> {
  if (!isMoodleSite(document)) {
    return { isMoodle: false, pageKind: 'other' };
  }
  const pageKind = detectPageKind(document, location.href);
  if (pageKind === 'dashboard') {
    return { isMoodle: true, pageKind, dashboardCourses: listDashboardCourses(document) };
  }
  if (pageKind === 'course') {
    const courseName = document.querySelector('h1')?.textContent?.trim() || document.title;
    return { isMoodle: true, pageKind, courseName };
  }
  return { isMoodle: true, pageKind };
}

async function handleScan(saveCourseAsHtml: boolean): Promise<ScanResponse> {
  await expandLazySections(document);
  return scanCourse(document, location.href, { saveCourseAsHtml });
}

/**
 * Manche Kursformate (z.B. das Kachel-Format "format_tiles") laden den Inhalt einzelner
 * Abschnitte erst per AJAX nach, sobald die zugehörige Kachel angeklickt wird - im initialen
 * HTML sind sie leer. Da wir auf der aktiven Seite laufen, simulieren wir den Klick für jede
 * noch nicht geladene Kachel und warten auf das tatsächliche Nachladen (nicht nur die erste
 * DOM-Änderung, z.B. ein Lade-Spinner, sondern auf echte Aktivitäten oder ein großzügiges Timeout).
 */
async function expandLazySections(doc: Document): Promise<void> {
  const tileLinks = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a.tile-link[data-section]'));
  const pendingSections: Element[] = [];

  // Klicks nacheinander mit kurzer Verzögerung auslösen (nicht alle synchron in einem Tick),
  // damit die Kachel-UI jeden Klick sauber verarbeitet. Das Warten auf die Antworten passiert
  // danach parallel, damit die Gesamtwartezeit nicht mit der Kachelanzahl multipliziert wird.
  for (const link of tileLinks) {
    const sectionNum = link.dataset.section;
    if (!sectionNum) continue;
    const section = doc.querySelector(`li.section[data-section="${sectionNum}"], div.section[data-section="${sectionNum}"]`);
    if (!section || section.querySelector('li.activity')) continue;
    link.click();
    pendingSections.push(section);
    await sleep(120);
  }

  await Promise.all(pendingSections.map((section) => waitForActivities(section)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForActivities(section: Element, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (section.querySelector('li.activity') || Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, 250);
    };
    check();
  });
}
