import { browser } from 'wxt/browser';

/**
 * Löst die tatsächliche Ziel-URL einer (ggf. mehrfachen, ggf. domainübergreifenden) Weiterleitung
 * auf. `fetch()` kann das bei Zielen ohne CORS-Freigabe nicht (der Browser verweigert JavaScript
 * aus Sicherheitsgründen den Zugriff auf `response.url` in diesem Fall) - die `webRequest`-API
 * beobachtet die Anfrage jedoch auf Netzwerkebene, unabhängig von CORS, und sieht die reale
 * Ziel-URL trotzdem. Der fetch()-Aufruf hier dient nur dazu, die Anfrage überhaupt auszulösen;
 * sein Ergebnis (bzw. ein möglicher CORS-Fehler) wird bewusst ignoriert.
 */
export function resolveRedirectTarget(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve) => {
    let currentUrl = url;
    let done = false;
    let timeout: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      done = true;
      clearTimeout(timeout);
      browser.webRequest.onBeforeRedirect.removeListener(onBeforeRedirect);
      browser.webRequest.onResponseStarted.removeListener(onResponseStarted);
      browser.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
    };
    const finish = () => {
      if (done) return;
      cleanup();
      resolve(currentUrl);
    };

    const onBeforeRedirect = (details: { url: string; redirectUrl: string }) => {
      if (details.url === currentUrl) {
        currentUrl = details.redirectUrl;
      }
    };
    const onResponseStarted = (details: { url: string }) => {
      if (details.url === currentUrl) finish();
    };
    const onErrorOccurred = (details: { url: string }) => {
      if (details.url === currentUrl) finish();
    };

    const filter = { urls: ['<all_urls>'] };
    browser.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, filter);
    browser.webRequest.onResponseStarted.addListener(onResponseStarted, filter);
    browser.webRequest.onErrorOccurred.addListener(onErrorOccurred, filter);

    timeout = setTimeout(finish, timeoutMs);

    fetch(url, { credentials: 'include' }).catch(() => {
      // Erwartet bei domainübergreifenden Zielen ohne CORS-Freigabe - webRequest hat die
      // tatsächliche Ziel-URL trotzdem schon beobachtet, siehe Kommentar oben.
    });
  });
}
