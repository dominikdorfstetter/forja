import type {
  CvEntryResponse,
  CvEntryDetailResponse,
  CreateCvEntryRequest,
  UpdateCvEntryRequest,
  ReorderItem,
  ListQueryParams,
} from '@/types/api';
import { apiRequest } from './http';
import { createContentService } from './contentService';

const svc = createContentService<
  CvEntryResponse,
  CvEntryDetailResponse,
  CvEntryResponse,
  CreateCvEntryRequest,
  UpdateCvEntryRequest,
  ListQueryParams & { entry_type?: string }
>({ base: 'cv' });

// Shared CRUD surface (ADR 0003 uniform routes). `getCvEntryDetail` now
// targets `/cv/{id}/detail` in lockstep with the backend route split.
export const getCvEntries = svc.list;
export const getCvEntryDetail = svc.detail;
export const createCvEntry = svc.create;
export const updateCvEntry = svc.update;
export const deleteCvEntry = svc.remove;
export const reviewCvEntry = svc.review;
export const bulkCvEntries = svc.bulk;

// Entity-specific extra.
export const reorderCvEntries = (siteId: string, items: ReorderItem[]) =>
  apiRequest<void>('POST', `/sites/${siteId}/cv/reorder`, { items });
