import type { LegalDocumentFullDetailResponse, UpdateLegalDocumentRequest } from '@/types/api';
import type { LegalContentFormData } from './legalDetailSchema';

export function buildLegalUpdates(
  values: LegalContentFormData,
  detail: LegalDocumentFullDetailResponse,
): UpdateLegalDocumentRequest {
  const updates: Record<string, unknown> = {};

  if (values.status !== detail.status) updates.status = values.status;

  return updates as UpdateLegalDocumentRequest;
}

export function buildLocalizationData(values: LegalContentFormData) {
  return {
    body: values.body || undefined,
    meta_title: values.meta_title || undefined,
    meta_description: values.meta_description || undefined,
  };
}
