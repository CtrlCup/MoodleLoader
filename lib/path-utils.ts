/**
 * Feste Höchstlänge für JEDEN Ordnernamen-Bestandteil (Basisordner, Kurs, Abschnitt, Aktivität).
 * Bewusst immer gleich und nur vom eigenen Text abhängig - NIE von der jeweiligen Datei oder
 * deren Dateiname -, damit alle Dateien einer Aktivität/eines Kurses zuverlässig im selben
 * Ordner landen. Würde die Kürzung stattdessen z.B. den Dateinamen mit einbeziehen, bekäme
 * dieselbe Aktivität je nach Datei einen leicht anderen Ordnernamen und würde in mehreren
 * verschiedenen Ordnern statt einem einzigen aufgeteilt.
 */
const FOLDER_SEGMENT_LENGTH = 50;

/** Höchstlänge für den Dateinamen selbst (ohne Endung). Darf bei Bedarf zusätzlich gekürzt werden,
 * ohne dass sich dadurch je ein Ordnername ändert. */
const FILENAME_LENGTH = 80;

/**
 * Windows begrenzt den kompletten Pfad standardmäßig auf 260 Zeichen (MAX_PATH) - ein Fehler dort
 * äußert sich in der downloads-API nur als generischer "FILE_FAILED"-Fehler ganz ohne Hinweis auf
 * die eigentliche Ursache. Da wir den Downloads-Pfad-Präfix des Betriebssystems (z.B.
 * "C:\Users\<Name>\Downloads\") nicht kennen, bleibt hier bewusst viel Polster.
 */
const MAX_TOTAL_PATH_LENGTH = 180;

/** Ersetzt Zeichen, die unter Windows/macOS/Linux in Datei-/Ordnernamen verboten sind. */
function sanitizeText(segment: string, maxLength: number): string {
  const cleaned = segment
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, ''); // Windows mag keine Punkte am Ende von Ordnernamen
  const truncated = cleaned.slice(0, maxLength).trim();
  return truncated.length > 0 ? truncated : 'Unbenannt';
}

/** Ordnername-Sanitizing mit der festen, dateiunabhängigen Höchstlänge. */
export function sanitizeSegment(segment: string): string {
  return sanitizeText(segment, FOLDER_SEGMENT_LENGTH);
}

/**
 * Baut den Zielpfad für chrome.downloads.download().
 * Die downloads-API erwartet immer Forward-Slashes, relativ zum Standard-Downloads-Ordner.
 *
 * Ordnernamen (Basisordner, Kurs, Abschnitt, Aktivität) werden ausschließlich anhand ihres
 * eigenen Textes gekürzt - nie anhand der jeweiligen Datei. Reicht der Platz trotzdem nicht
 * (sehr lange/tiefe Verschachtelung), wird als letzter Schritt nur noch der Dateiname selbst
 * zusätzlich gekürzt, nie ein Ordnername - so bleibt jede Aktivität immer in genau einem Ordner.
 */
export function buildDownloadPath(
  baseFolder: string,
  courseName: string,
  subPath: string[],
  filename: string,
): string {
  const folders = [baseFolder, courseName, ...subPath].map((s) => sanitizeSegment(s));
  let safeFilename = sanitizeFilename(filename);

  const folderPath = folders.join('/');
  const budgetForFilename = MAX_TOTAL_PATH_LENGTH - folderPath.length - 1;
  if (budgetForFilename > 10 && safeFilename.length > budgetForFilename) {
    safeFilename = sanitizeFilename(filename, budgetForFilename - 5);
  }

  return [...folders, safeFilename].join('/');
}

export function sanitizeFilename(filename: string, maxLength: number = FILENAME_LENGTH): string {
  const dotIndex = filename.lastIndexOf('.');
  const hasExt = dotIndex > 0 && dotIndex < filename.length - 1;
  const name = hasExt ? filename.slice(0, dotIndex) : filename;
  const ext = hasExt ? filename.slice(dotIndex) : '';
  return sanitizeText(name, maxLength) + ext.replace(/[\\/:*?"<>|]/g, '_');
}

/** Erzeugt "name (01).ext", "name (02).ext", ... aus einem Basisnamen und laufender Nummer. */
export function withCopyIndex(filename: string, index: number): string {
  const dotIndex = filename.lastIndexOf('.');
  const hasExt = dotIndex > 0 && dotIndex < filename.length - 1;
  const name = hasExt ? filename.slice(0, dotIndex) : filename;
  const ext = hasExt ? filename.slice(dotIndex) : '';
  const padded = String(index).padStart(2, '0');
  return `${name} (${padded})${ext}`;
}
