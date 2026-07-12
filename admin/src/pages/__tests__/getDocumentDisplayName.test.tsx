import { describe, it, expect } from 'vitest';
import { getDocumentDisplayName } from '@/pages/DocumentCardGrid';
import type { DocumentListItem, DocumentResponse } from '@/types/api';

const baseDoc: DocumentListItem = {
  id: 'doc-1',
  site_id: 'site-1',
  file_name: 'report.pdf',
  url: 'https://cdn.example.com/report.pdf',
  document_type: 'pdf',
  file_size: 1024,
  folder_id: null,
  has_file: true,
  is_private: false,
  private_failed_attempt_count: 0,
  display_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as DocumentListItem;

const detail = (over: Partial<DocumentResponse>): DocumentResponse =>
  ({ ...baseDoc, localizations: [], ...over }) as unknown as DocumentResponse;

describe('getDocumentDisplayName', () => {
  it('prefers the first localization name when present', () => {
    const map = new Map<string, DocumentResponse>([
      ['doc-1', detail({ localizations: [{ name: 'Annual Report' }] as never })],
    ]);
    expect(getDocumentDisplayName(baseDoc, map)).toBe('Annual Report');
  });

  it('falls back to the file name for an empty localizations array', () => {
    const map = new Map<string, DocumentResponse>([['doc-1', detail({ localizations: [] })]]);
    expect(getDocumentDisplayName(baseDoc, map)).toBe('report.pdf');
  });

  it('does not crash when the detail has no localizations array (contract drift)', () => {
    // A DocumentResponse whose `localizations` is missing must degrade to the
    // file-name fallback, not throw and blank the whole Documents page (#138).
    const map = new Map<string, DocumentResponse>([
      ['doc-1', detail({ localizations: undefined as never })],
    ]);
    expect(() => getDocumentDisplayName(baseDoc, map)).not.toThrow();
    expect(getDocumentDisplayName(baseDoc, map)).toBe('report.pdf');
  });

  it('falls back to the URL filename when there is no file name', () => {
    const doc = { ...baseDoc, has_file: false, file_name: null } as unknown as DocumentListItem;
    const map = new Map<string, DocumentResponse>();
    expect(getDocumentDisplayName(doc, map)).toBe('report.pdf');
  });
});
