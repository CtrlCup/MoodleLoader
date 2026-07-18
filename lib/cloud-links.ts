/**
 * Erkennt bekannte Cloud-/Freigabe-Link-Muster und wandelt sie in eine direkt
 * herunterladbare URL um. Abgedeckt sind Nextcloud/ownCloud-basierte Dienste,
 * wie sie an deutschen Hochschulen verbreitet sind (bwSync&Share, Sciebo,
 * LRZ Sync+Share, ...). Für unbekannte Anbieter wird die Original-URL
 * zurückgegeben (bestmöglicher Versuch, siehe README für Grenzen).
 */
export function resolveCloudDownloadUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  // Nextcloud/ownCloud öffentlicher Freigabe-Link: .../s/<token>[/...]
  // Anhängen von "/download" liefert die Datei (bzw. als Zip bei Ordnern) direkt.
  const shareMatch = url.pathname.match(/^(.*\/s\/[^/]+)\/?$/);
  if (shareMatch && !url.pathname.endsWith('/download')) {
    url.pathname = `${shareMatch[1]}/download`;
    return url.toString();
  }

  return rawUrl;
}

/** Grobe Heuristik, ob eine URL überhaupt zu einem bekannten Cloud-Freigabe-Muster passt. */
export function looksLikeCloudShareLink(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return /\/s\/[^/]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}
