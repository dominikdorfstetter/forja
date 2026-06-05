import type {
  BulkContentRequest,
  BulkContentResponse,
  ContentLocalizationResponse,
  CreateLocalizationRequest,
  ListQueryParams,
  Paginated,
  ReviewActionRequest,
  ReviewActionResponse,
  UpdateLocalizationRequest,
} from '@/types/api';
import { apiRequest } from './http';

/**
 * Factory for the uniform content CRUD surface shared by every content
 * type (blogs, pages, cv, projects, legal). It exists because — once the
 * backend routes were normalised (ADR 0003: `/{base}/{id}` lightweight,
 * `/{base}/{id}/detail` full) — the five service files were byte-identical
 * pass-throughs to `apiRequest`, differing only in the `base` path segment
 * and their response types.
 *
 * Each entity file builds one service and re-exports the slice it actually
 * uses as named bindings (`export const getBlogs = svc.list`), so call
 * sites are unchanged. Entity-specific extras (clone, status counts,
 * sections, reorder, legal groups/items, …) and divergent endpoints (legal
 * creates under `/sites/{siteId}/legal`) stay hand-written on top.
 *
 * The localization triple is invariant across content types, so those
 * methods are not generic.
 */
export interface ContentService<
  TListItem,
  TDetail,
  TSingle,
  TCreate,
  TUpdate,
  TListParams = ListQueryParams,
> {
  /** `GET /sites/{siteId}/{base}` — paginated lightweight list. */
  list: (siteId: string, params?: TListParams) => Promise<Paginated<TListItem>>;
  /** `GET /{base}/{id}/detail` — the full relational graph. */
  detail: (id: string) => Promise<TDetail>;
  /** `POST /{base}` — create. */
  create: (data: TCreate) => Promise<TSingle>;
  /** `PUT /{base}/{id}` — update. */
  update: (id: string, data: TUpdate) => Promise<TSingle>;
  /** `DELETE /{base}/{id}` — soft-delete. */
  remove: (id: string) => Promise<void>;
  /** `POST /sites/{siteId}/{base}/bulk` — bulk status action. */
  bulk: (siteId: string, data: BulkContentRequest) => Promise<BulkContentResponse>;
  /** `POST /{base}/{id}/review` — review action. */
  review: (id: string, data: ReviewActionRequest) => Promise<ReviewActionResponse>;
  /** `GET /{base}/{id}/localizations` */
  getLocalizations: (id: string) => Promise<ContentLocalizationResponse[]>;
  /** `POST /{base}/{id}/localizations` */
  createLocalization: (
    id: string,
    data: CreateLocalizationRequest,
  ) => Promise<ContentLocalizationResponse>;
  /** `PUT /{base}/localizations/{locId}` */
  updateLocalization: (
    locId: string,
    data: UpdateLocalizationRequest,
  ) => Promise<ContentLocalizationResponse>;
  /** `DELETE /{base}/localizations/{locId}` */
  deleteLocalization: (locId: string) => Promise<void>;
}

export interface ContentServiceConfig {
  /** Path segment for the content type, e.g. `'blogs'`, `'cv'`, `'legal'`. */
  base: string;
}

export function createContentService<
  TListItem,
  TDetail,
  TSingle,
  TCreate,
  TUpdate,
  TListParams = ListQueryParams,
>({
  base,
}: ContentServiceConfig): ContentService<
  TListItem,
  TDetail,
  TSingle,
  TCreate,
  TUpdate,
  TListParams
> {
  return {
    list: (siteId, params) =>
      apiRequest<Paginated<TListItem>>('GET', `/sites/${siteId}/${base}`, undefined, {
        params,
      }),
    detail: (id) => apiRequest<TDetail>('GET', `/${base}/${id}/detail`),
    create: (data) => apiRequest<TSingle>('POST', `/${base}`, data),
    update: (id, data) => apiRequest<TSingle>('PUT', `/${base}/${id}`, data),
    remove: (id) => apiRequest<void>('DELETE', `/${base}/${id}`),
    bulk: (siteId, data) =>
      apiRequest<BulkContentResponse>('POST', `/sites/${siteId}/${base}/bulk`, data),
    review: (id, data) =>
      apiRequest<ReviewActionResponse>('POST', `/${base}/${id}/review`, data),
    getLocalizations: (id) =>
      apiRequest<ContentLocalizationResponse[]>('GET', `/${base}/${id}/localizations`),
    createLocalization: (id, data) =>
      apiRequest<ContentLocalizationResponse>('POST', `/${base}/${id}/localizations`, data),
    updateLocalization: (locId, data) =>
      apiRequest<ContentLocalizationResponse>('PUT', `/${base}/localizations/${locId}`, data),
    deleteLocalization: (locId) =>
      apiRequest<void>('DELETE', `/${base}/localizations/${locId}`),
  };
}
