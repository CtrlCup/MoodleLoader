/** Ersetzt Zeichen, die unter Windows/macOS/Linux in Datei-/Ordnernamen verboten sind. */
export function sanitizeSegment(segment: string): string {
  const cleaned = segment
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, ''); // Windows mag keine Punkte am Ende von Ordnernamen
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'Unbenannt';
}

/**
 * Baut den Zielpfad für chrome.downloads.download().
 * Die downloads-API erwartet immer Forward-Slashes, relativ zum Standard-Downloads-Ordner.
 */
export function buildDownloadPath(
  baseFolder: string,
  courseName: string,
  subPath: string[],
  filename: string,
): string {
  const segments = [baseFolder, courseName, ...subPath].map(sanitizeSegment);
  const safeFilename = sanitizeFilename(filename);
  return [...segments, safeFilename].join('/');
}

export function sanitizeFilename(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  const hasExt = dotIndex > 0 && dotIndex < filename.length - 1;
  const name = hasExt ? filename.slice(0, dotIndex) : filename;
  const ext = hasExt ? filename.slice(dotIndex) : '';
  return sanitizeSegment(name) + ext.replace(/[\\/:*?"<>|]/g, '_');
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
