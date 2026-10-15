import { z } from 'zod';
import { urlField } from '@/utils/validation';
import type {
  DocumentResponse,
  Locale,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';

/** Derive document_type from a file extension or MIME type. */
export function deriveDocumentType(fileName: string, mimeType?: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const extMap: Record<string, string> = {
    pdf: 'pdf',
    doc: 'doc', docx: 'doc',
    xls: 'xlsx', xlsx: 'xlsx', csv: 'xlsx',
    ppt: 'doc', pptx: 'doc',
    zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip',
    txt: 'other', md: 'other', json: 'other', xml: 'other',
  };
  if (extMap[ext]) return extMap[ext];
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('word') || mimeType?.includes('document')) return 'doc';
  if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return 'xlsx';
  if (mimeType?.includes('zip') || mimeType?.includes('compressed')) return 'zip';
  return 'other';
}

const localizationSchema = z.object({
  locale_id: z.string().min(1),
  name: z.string().max(255),
  description: z.string().max(2000),
});

const linkSchema = z.object({
  source_type: z.literal('link'),
  url: urlField,
  document_type: z.string().min(1, 'Required'),
  folder_id: z.string(),
  localizations: z.array(localizationSchema),
});

const uploadSchema = z.object({
  source_type: z.literal('upload'),
  url: z.string().optional(),
  document_type: z.string().min(1, 'Required'),
  folder_id: z.string(),
  localizations: z.array(localizationSchema),
});

export const documentFormSchema = z.discriminatedUnion('source_type', [linkSchema, uploadSchema]);

export type DocumentFormData = z.infer<typeof documentFormSchema>;

/** Form defaults: the edited document's values, or an empty upload in the current folder. */
export function buildDocumentFormDefaults(
  document: DocumentResponse | null | undefined,
  activeLocales: Locale[],
  selectedFolderId: string | null | undefined,
): DocumentFormData {
  if (document) {
    return {
      source_type: document.has_file ? 'upload' : 'link',
      url: document.url ?? '',
      document_type: document.document_type,
      folder_id: document.folder_id ?? '',
      localizations: activeLocales.map((locale) => {
        const existing = (document.localizations ?? []).find((l) => l.locale_id === locale.id);
        return {
          locale_id: locale.id,
          name: existing?.name ?? '',
          description: existing?.description ?? '',
        };
      }),
    };
  }
  return {
    source_type: 'upload',
    url: '',
    document_type: 'other',
    folder_id: selectedFolderId ?? '',
    localizations: activeLocales.map((locale) => ({
      locale_id: locale.id,
      name: '',
      description: '',
    })),
  };
}

/** A freshly picked file, already base64-encoded for the JSON API. */
export interface EncodedUpload {
  base64: string;
  name: string;
  size: number;
  type: string;
}

/**
 * The create/update request body. An upload carries the file payload; an
 * edit that keeps the stored file sends metadata only; a link sends its URL.
 */
export function buildDocumentRequest(
  data: DocumentFormData,
  sourceType: 'link' | 'upload',
  upload: EncodedUpload | null,
): CreateDocumentRequest {
  const base = {
    document_type: data.document_type,
    folder_id: data.folder_id || undefined,
    display_order: 0,
  };
  if (sourceType === 'link') return { url: data.url, ...base };
  if (!upload) return base;
  return {
    ...base,
    file_data: upload.base64,
    file_name: upload.name,
    file_size: upload.size,
    mime_type: upload.type || 'application/octet-stream',
  };
}

/** Localizations worth sending: only those with a non-blank name. */
export function buildDocumentLocalizations(
  localizations: DocumentFormData['localizations'],
): CreateDocumentLocalizationRequest[] {
  return localizations
    .filter((loc) => loc.name && loc.name.trim().length > 0)
    .map((loc) => ({
      locale_id: loc.locale_id,
      name: loc.name,
      description: loc.description || undefined,
    }));
}
