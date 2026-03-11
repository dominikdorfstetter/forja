import apiService from '@/services/api';
import type {
  DocumentResponse,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';

export async function createDocumentWithLocalizations(
  siteId: string,
  data: CreateDocumentRequest,
  localizations: CreateDocumentLocalizationRequest[],
) {
  const created = await apiService.createDocument(siteId, data);
  if (localizations.length > 0) {
    await Promise.all(
      localizations.map((loc) => apiService.createDocumentLocalization(created.id, loc)),
    );
  }
  return created;
}

export async function updateDocumentWithLocalizations(
  docId: string,
  data: CreateDocumentRequest,
  localizations: CreateDocumentLocalizationRequest[],
  detailMap: Map<string, DocumentResponse>,
) {
  const updated = await apiService.updateDocument(docId, {
    url: data.url,
    file_data: data.file_data,
    file_name: data.file_name,
    file_size: data.file_size,
    mime_type: data.mime_type,
    document_type: data.document_type,
    folder_id: data.folder_id,
    display_order: data.display_order,
  });

  const existingDetail = detailMap.get(docId);
  const existingLocs = existingDetail?.localizations ?? [];

  for (const loc of localizations) {
    const existing = existingLocs.find((el) => el.locale_id === loc.locale_id);
    if (existing) {
      await apiService.updateDocumentLocalization(existing.id, {
        name: loc.name,
        description: loc.description,
      });
    } else {
      await apiService.createDocumentLocalization(docId, loc);
    }
  }

  const submittedLocaleIds = new Set(localizations.map((l) => l.locale_id));
  for (const existing of existingLocs) {
    if (!submittedLocaleIds.has(existing.locale_id)) {
      await apiService.deleteDocumentLocalization(existing.id);
    }
  }

  return updated;
}
