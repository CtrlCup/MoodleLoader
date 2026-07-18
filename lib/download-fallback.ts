import { browser } from 'wxt/browser';
import { createForegroundTab, sleep, waitForTabComplete } from './tab-scan';

/**
 * Holt eine Datei über einen echten (kurz sichtbaren) Tab per fetch() und liefert sie als
 * data:-URL zurück. Wird nur als Fallback verwendet, wenn der reguläre Download über die
 * downloads-API abbricht/stecken bleibt - manche Moodle-Instanzen scheinen Downloads ohne
 * vollständigen Seitenkontext (Cookies/Header) nach wenigen KB zu kappen, obwohl derselbe
 * Abruf per fetch() aus einer echten Seite heraus zuverlässig funktioniert.
 */
export async function fetchFileViaTab(url: string): Promise<string> {
  const origin = new URL(url).origin;
  const tabId = await createForegroundTab(`${origin}/`);
  try {
    await waitForTabComplete(tabId);
    await sleep(200);
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: (fileUrl: string) => window.__moodleLoaderFetchFile?.(fileUrl),
      args: [url],
    });
    if (!injection || typeof injection.result !== 'string') {
      throw new Error('Fallback-Abruf der Datei lieferte kein Ergebnis.');
    }
    return injection.result;
  } finally {
    browser.tabs.remove(tabId).catch(() => {});
  }
}
