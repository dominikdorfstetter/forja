import type { DocumentListItem, DocumentResponse } from '@/types/api';

/**
 * Human-facing name of a document: its first localization name, else the
 * uploaded file name, else the last path segment of its URL, else the raw URL.
 */
export function getDocumentDisplayName(doc: DocumentListItem, detailMap: Map<string, DocumentResponse>): string {
  const detail = detailMap.get(doc.id);
  // Guard against a detail that arrives without a localizations array: the
  // contract declares it non-null, but a non-conforming API response (older
  // backend, legacy row) must degrade to the fallback name — not throw during
  // render and blank the whole page (#138).
  if (detail && detail.localizations && detail.localizations.length > 0) {
    return detail.localizations[0].name;
  }
  if (doc.has_file && doc.file_name) {
    return doc.file_name;
  }
  if (doc.url) {
    try {
      const url = new URL(doc.url);
      const pathname = url.pathname;
      const filename = pathname.split('/').pop();
      if (filename && filename.length > 0) return filename;
    } catch {
      // Not a valid URL, use as-is
    }
    return doc.url;
  }
  return 'Untitled';
}
