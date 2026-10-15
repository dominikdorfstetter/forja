import { describe, it, expect } from 'vitest';
import type { DocumentResponse, Locale } from '@/types/api';
import {
  buildDocumentFormDefaults,
  buildDocumentLocalizations,
  buildDocumentRequest,
  deriveDocumentType,
  type DocumentFormData,
} from '../documentFormModel';

const locales = [
  { id: 'en', code: 'en' },
  { id: 'de', code: 'de' },
] as Locale[];

const formData: DocumentFormData = {
  source_type: 'link',
  url: 'https://example.com/a.pdf',
  document_type: 'pdf',
  folder_id: '',
  localizations: [],
};

describe('deriveDocumentType', () => {
  it('maps known extensions case-insensitively', () => {
    expect(deriveDocumentType('Report.PDF')).toBe('pdf');
    expect(deriveDocumentType('slides.pptx')).toBe('doc');
    expect(deriveDocumentType('data.csv')).toBe('xlsx');
    expect(deriveDocumentType('archive.7z')).toBe('zip');
  });

  it('falls back to the MIME type for unknown extensions', () => {
    expect(deriveDocumentType('blob', 'application/vnd.ms-excel')).toBe('xlsx');
    expect(deriveDocumentType('blob', 'application/x-compressed')).toBe('zip');
  });

  it('defaults to other', () => {
    expect(deriveDocumentType('photo.heic', 'image/heic')).toBe('other');
  });
});

describe('buildDocumentFormDefaults', () => {
  it('starts a new document as an upload in the selected folder with blank localizations', () => {
    expect(buildDocumentFormDefaults(null, locales, 'folder-1')).toEqual({
      source_type: 'upload',
      url: '',
      document_type: 'other',
      folder_id: 'folder-1',
      localizations: [
        { locale_id: 'en', name: '', description: '' },
        { locale_id: 'de', name: '', description: '' },
      ],
    });
  });

  it('mirrors an edited link document and fills only its existing localizations', () => {
    const document = {
      has_file: false,
      url: 'https://x.test/doc',
      document_type: 'doc',
      folder_id: null,
      localizations: [{ locale_id: 'de', name: 'Bericht', description: null }],
    } as unknown as DocumentResponse;

    expect(buildDocumentFormDefaults(document, locales, 'ignored')).toEqual({
      source_type: 'link',
      url: 'https://x.test/doc',
      document_type: 'doc',
      folder_id: '',
      localizations: [
        { locale_id: 'en', name: '', description: '' },
        { locale_id: 'de', name: 'Bericht', description: '' },
      ],
    });
  });
});

describe('buildDocumentRequest', () => {
  const upload = { base64: 'QUJD', name: 'a.pdf', size: 3, type: '' };

  it('sends the URL for link documents', () => {
    expect(buildDocumentRequest(formData, 'link', null)).toEqual({
      url: 'https://example.com/a.pdf',
      document_type: 'pdf',
      folder_id: undefined,
      display_order: 0,
    });
  });

  it('sends the file payload for a new upload, defaulting the MIME type', () => {
    expect(buildDocumentRequest({ ...formData, source_type: 'upload', folder_id: 'f1' }, 'upload', upload)).toEqual({
      document_type: 'pdf',
      folder_id: 'f1',
      display_order: 0,
      file_data: 'QUJD',
      file_name: 'a.pdf',
      file_size: 3,
      mime_type: 'application/octet-stream',
    });
  });

  it('sends metadata only when an edit keeps the stored file', () => {
    expect(buildDocumentRequest({ ...formData, source_type: 'upload' }, 'upload', null)).toEqual({
      document_type: 'pdf',
      folder_id: undefined,
      display_order: 0,
    });
  });
});

describe('buildDocumentLocalizations', () => {
  it('drops blank names and empty descriptions', () => {
    expect(buildDocumentLocalizations([
      { locale_id: 'en', name: 'Report', description: '' },
      { locale_id: 'de', name: '   ', description: 'ignored' },
      { locale_id: 'fr', name: 'Rapport', description: 'Annuel' },
    ])).toEqual([
      { locale_id: 'en', name: 'Report', description: undefined },
      { locale_id: 'fr', name: 'Rapport', description: 'Annuel' },
    ]);
  });
});
