import { resolveCloudDownloadUrl, looksLikeCloudShareLink } from './cloud-links';
import type { DiscoveredFile, ScanResult } from './types';

/** Modultypen, deren Dateien/Links gescannt werden. Quiz, Lesson, Chat, ... werden bewusst ausgelassen. */
const SUPPORTED_MODTYPES = new Set([
  'modtype_resource',
  'modtype_folder',
  'modtype_assign',
  'modtype_url',
  'modtype_forum',
  'modtype_page',
]);

/** Domains, die in mod_url-Seiten als Moodle-Eigenwerbung auftauchen und keine echten Ziel-Links sind. */
const NOISE_HOSTS = ['moodle.com', 'moodle.org', 'docs.moodle.org', 'moodle.net'];

export function isMoodleSite(doc: Document = document): boolean {
  const bodyClass = doc.body?.className ?? '';
  return bodyClass.includes('yui3-skin-sam') && (bodyClass.includes('pagelayout-') || !!doc.getElementById('page'));
}

export type PageKind = 'course' | 'dashboard' | 'other';

export function detectPageKind(doc: Document = document, pageUrl: string = location.href): PageKind {
  const bodyClass = doc.body?.className ?? '';
  const url = new URL(pageUrl);
  if (bodyClass.includes('path-course-view') || /\/course\/view\.php/.test(url.pathname)) {
    return 'course';
  }
  if (bodyClass.includes('path-my') || /\/my\//.test(url.pathname)) {
    return 'dashboard';
  }
  return 'other';
}

export interface DashboardCourseLink {
  id: string;
  name: string;
  url: string;
}

export function listDashboardCourses(doc: Document = document): DashboardCourseLink[] {
  const seen = new Set<string>();
  const result: DashboardCourseLink[] = [];
  for (const a of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="/course/view.php"]'))) {
    const href = a.href;
    if (seen.has(href)) continue;
    const name = a.textContent?.trim();
    if (!name) continue;
    seen.add(href);
    const idMatch = href.match(/[?&]id=(\d+)/);
    result.push({ id: idMatch?.[1] ?? href, name, url: href });
  }
  return result;
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? 'datei');
    return last || 'datei';
  } catch {
    return 'datei';
  }
}

function extractLinksFromRegion(root: ParentNode, originHostname: string) {
  const pluginfile = Array.from(
    root.querySelectorAll(
      'a[href*="pluginfile.php"], iframe[src*="pluginfile.php"], object[data*="pluginfile.php"], embed[src*="pluginfile.php"]',
    ),
  )
    .map((el) => el.getAttribute('href') ?? el.getAttribute('src') ?? el.getAttribute('data'))
    .filter((v): v is string => !!v);

  const external = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))
    .map((a) => a.href)
    .filter((href) => {
      try {
        const hostname = new URL(href).hostname;
        return hostname !== originHostname && !NOISE_HOSTS.some((n) => hostname.endsWith(n));
      } catch {
        return false;
      }
    });

  return { pluginfile, external };
}

/** Holt eine Moodle-Unterseite (selbe Origin) und liefert Datei-/externe Links aus dem Hauptinhaltsbereich. */
async function fetchMainRegionLinks(url: string, originHostname: string): Promise<{ pluginfile: string[]; external: string[] }> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    // Viele Moodle-Ressourcen/URL-Aktivitäten (Anzeige "Automatisch"/"Erzwinge Download"/"Neues Fenster")
    // liefern statt einer HTML-Seite direkt einen 302-Redirect auf das eigentliche Ziel - entweder eine
    // pluginfile.php-Datei (gleiche Origin) oder eine externe Seite/Datei. In beiden Fällen ist die
    // aufgelöste res.url bereits das gesuchte Ziel und muss nicht weiter durchsucht werden.
    if (res.redirected) {
      const finalHostname = new URL(res.url).hostname;
      if (finalHostname === originHostname) {
        return { pluginfile: [res.url], external: [] };
      }
      const isNoise = NOISE_HOSTS.some((n) => finalHostname.endsWith(n));
      return { pluginfile: [], external: isNoise ? [] : [res.url] };
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) {
      return { pluginfile: [], external: [] };
    }
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const main = doc.querySelector('[role="main"], #region-main') ?? doc.body;
    if (!main) return { pluginfile: [], external: [] };
    return extractLinksFromRegion(main, originHostname);
  } catch {
    return { pluginfile: [], external: [] };
  }
}

interface ActivityInfo {
  cmid: string;
  modtype: string;
  name: string;
  href: string;
  sectionName: string;
}

/**
 * Ermittelt den Abschnittsnamen. Je nach Kursformat (Topics, Tiles, Grid, ...) unterscheidet sich
 * das Markup. Die Kandidaten müssen einzeln (nicht als kombinierter Selektor) geprüft werden, da
 * querySelector bei einer Selektor-Liste das im Dokument zuerst auftretende Element liefert - das
 * kann z.B. ein umschließender Container mit Bedienelement-Text ("Abschnitt X auswählen,
 * Einklappen, Ausklappen, ...") statt der eigentlichen Überschrift sein.
 */
function getSectionName(section: Element | null): string {
  if (!section) return 'Sonstiges';
  const candidates = ['.sectionname', 'h2', 'h3'];
  for (const selector of candidates) {
    const name = section.querySelector(selector)?.textContent?.trim();
    if (name) return name;
  }
  return 'Sonstiges';
}

function collectActivities(doc: Document): ActivityInfo[] {
  const activities: ActivityInfo[] = [];
  for (const li of Array.from(doc.querySelectorAll<HTMLElement>('li.activity[data-id]'))) {
    const modtypeClass = Array.from(li.classList).find((c) => c.startsWith('modtype_'));
    if (!modtypeClass || !SUPPORTED_MODTYPES.has(modtypeClass)) continue;
    const link = li.querySelector<HTMLAnchorElement>('a[href*="/mod/"]');
    if (!link) continue;
    const nameEl = li.querySelector('[data-activityname]');
    const name = nameEl?.getAttribute('data-activityname')?.trim() || link.textContent?.trim() || 'Aktivität';
    const section = li.closest('li.section, div.section');
    const sectionName = getSectionName(section);
    activities.push({
      cmid: li.getAttribute('data-id') ?? '',
      modtype: modtypeClass.replace('modtype_', ''),
      name,
      href: link.href,
      sectionName,
    });
  }
  return activities;
}

/**
 * Scannt eine Moodle-Kursseite nach herunterladbaren Dateien.
 * `doc` kann entweder das aktive `document` sein, oder ein per fetch() geladenes und
 * mit DOMParser geparstes Dokument (z.B. beim Scan mehrerer Kurse ausgehend vom Dashboard) -
 * daher wird die Basis-URL der Seite explizit übergeben statt auf `location` zuzugreifen.
 */
export async function scanCourse(
  doc: Document,
  pageUrl: string,
  opts: { saveCourseAsHtml: boolean } = { saveCourseAsHtml: true },
): Promise<ScanResult> {
  const warnings: string[] = [];
  const files: DiscoveredFile[] = [];
  const seenUrls = new Set<string>();
  const originHostname = new URL(pageUrl).hostname;

  const courseName = doc.querySelector('h1')?.textContent?.trim() || doc.title || 'Kurs';
  const idMatch = pageUrl.match(/[?&]id=(\d+)/);
  const courseId = idMatch?.[1] ?? null;

  const addFile = (url: string, filename: string, subPath: string[], source: DiscoveredFile['source']) => {
    if (seenUrls.has(url)) return;
    seenUrls.add(url);
    files.push({ url, filename, subPath, source });
  };

  const activities = collectActivities(doc);

  for (const activity of activities) {
    const li = doc.querySelector(`li.activity[data-id="${activity.cmid}"]`);
    const inlinePluginfiles = li ? extractLinksFromRegion(li, originHostname).pluginfile : [];

    let pluginfileLinks = inlinePluginfiles;
    let externalLinks: string[] = [];

    if (activity.modtype === 'url') {
      const remote = await fetchMainRegionLinks(activity.href, originHostname);
      pluginfileLinks = remote.pluginfile;
      externalLinks = remote.external;
    } else if (pluginfileLinks.length === 0) {
      const remote = await fetchMainRegionLinks(activity.href, originHostname);
      pluginfileLinks = remote.pluginfile;
    }

    const nestUnderActivity = activity.modtype === 'folder' || activity.modtype === 'assign';
    const subPath = nestUnderActivity ? [activity.sectionName, activity.name] : [activity.sectionName];

    for (const url of pluginfileLinks) {
      addFile(url, filenameFromUrl(url), subPath, mapSourceFromModtype(activity.modtype));
    }

    for (const url of externalLinks) {
      const resolved = resolveCloudDownloadUrl(url);
      addFile(resolved, activity.name, [activity.sectionName], 'external-cloud');
    }

    if (activity.modtype === 'url' && pluginfileLinks.length === 0 && externalLinks.length === 0) {
      // Der eigentliche Link ließ sich nicht auflösen (typischerweise, weil er auf eine externe
      // Domain ohne CORS-Freigabe umleitet - aus Sicherheitsgründen kann JavaScript das Ziel eines
      // fremden Redirects nicht auslesen). Als letzten Ausweg die Moodle-Linkseite selbst zum
      // Download übergeben: der Download-Manager des Browsers folgt Redirects unabhängig von CORS.
      addFile(activity.href, activity.name, [activity.sectionName], 'external-cloud');
      warnings.push(
        `Hinweis (kein Fehler): "${activity.name}" verlinkt auf eine externe Seite ohne Freigabe für Browser-Erweiterungen. ` +
          'Der Browser lädt automatisch herunter, was am Ende dieses Links liegt (Datei oder ggf. eine Webseite zum manuellen Öffnen).',
      );
    }
  }

  // Zusätzlich: direkt auf der Kursseite eingebettete Cloud-Freigabe-Links (z.B. in Textfeldern/Labels),
  // die nicht innerhalb einer erkannten Aktivität liegen.
  for (const a of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'))) {
    if (!looksLikeCloudShareLink(a.href)) continue;
    const resolved = resolveCloudDownloadUrl(a.href);
    if (seenUrls.has(resolved)) continue;
    const sectionName = getSectionName(a.closest('li.section, div.section'));
    const name = a.textContent?.trim() || filenameFromUrl(resolved);
    addFile(resolved, name, [sectionName], 'external-cloud');
  }

  if (opts.saveCourseAsHtml) {
    const htmlUrl = buildCourseHtmlDataUrl(doc, new URL(pageUrl).origin);
    addFile(htmlUrl, `${courseName}.html`, [], 'course-html');
  }

  const tileCount = doc.querySelectorAll('a.tile-link[data-section]').length;
  if (tileCount > 0 && activities.length === 0) {
    warnings.push(
      'Dieser Kurs verwendet das Moodle-Kachelformat und einige Kacheln konnten nicht rechtzeitig geladen werden. ' +
        'Bitte den Scan erneut starten, falls Dateien fehlen.',
    );
  }

  return { courseId, courseName, files, warnings };
}

function mapSourceFromModtype(modtype: string): DiscoveredFile['source'] {
  if (modtype === 'assign') return 'assign-intro';
  if (modtype === 'folder') return 'folder';
  return 'resource';
}

function buildCourseHtmlDataUrl(doc: Document, origin: string): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  const head = clone.querySelector('head');
  if (head) {
    const base = doc.createElement('base');
    base.setAttribute('href', `${origin}/`);
    head.prepend(base);
    const meta = doc.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    head.prepend(meta);
  }
  const html = `<!doctype html>\n${clone.outerHTML}`;
  const base64 = btoa(unescape(encodeURIComponent(html)));
  return `data:text/html;charset=utf-8;base64,${base64}`;
}
