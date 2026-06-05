/**
 * Trigger a browser "save as" for an in-memory blob via a transient
 * object URL and a synthetic anchor click. Used when the bytes can't be
 * reached with a plain link — e.g. an authenticated endpoint where the
 * fetch must carry the Clerk bearer (see `downloadSiteExport`).
 *
 * Note: the same five-line snippet is hand-inlined in several older call
 * sites (FaviconPage, AiUsagePage, Profile, …). They predate this helper
 * and are intentionally left untouched; new code should compose this.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
