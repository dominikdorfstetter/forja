import type { HttpClient, PaginatedResult } from '../http.js';
import { createPaginatedResult, toQueryParams } from '../http.js';
import type { Paginated } from '../types.js';

/** Minimal shape every content list-params object satisfies. */
export interface PaginationLike {
  /** 1-indexed starting page. */
  page?: number;
}

/** Optional locale resolver for detail lookups (ADR 0002). */
export interface DetailParams {
  locale?: string;
}

/**
 * Per-entity endpoint configuration for {@link ContentResource}.
 */
export interface ContentResourceConfig {
  /** Full path of the primary list endpoint, e.g. `/sites/{siteId}/blogs/published`. */
  listPath: string;
  /** Base segment for detail-by-id: `/{detailBase}/{id}/detail` (e.g. `blogs`). */
  detailBase: string;
}

/**
 * Generic base for the public client SDK's content resources.
 *
 * Owns the CRUD-read + pagination scaffold shared verbatim across the entity
 * resources (`list` / `get` / `getDetail` / `getBySlug`), so each entity class
 * extends this and adds only its extras (`listFeatured`, `listSimilar`,
 * `getSections`, …) while keeping its current public method names. Slug lookups
 * stay per-entity: their paths, step count (blog resolves slug→id→detail), and
 * return shape (list vs detail) genuinely differ, so they aren't on the base.
 *
 * @typeParam TList - The list-item shape returned by the list endpoint.
 * @typeParam TDetail - The detail shape returned by `/{detailBase}/{id}/detail`.
 */
export class ContentResource<TList, TDetail> {
  constructor(
    protected readonly http: HttpClient,
    protected readonly siteId: string,
    protected readonly config: ContentResourceConfig,
  ) {}

  /**
   * The shared pagination scaffold: build a `fetchPage` closure over `path`
   * and wrap the first page in a {@link PaginatedResult}. Subclasses reuse this
   * for their bespoke list endpoints (category/featured/etc.).
   */
  protected async paginate<T, P extends PaginationLike = PaginationLike>(
    path: string,
    params?: P,
    extraQuery?: Record<string, string | undefined>,
  ): Promise<PaginatedResult<T>> {
    const query = params ? toQueryParams(params) : undefined;
    const fetchPage = (page: number) =>
      this.http.get<Paginated<T>>(path, { ...query, ...extraQuery, page: String(page) });
    const result = await fetchPage(params?.page ?? 1);
    return createPaginatedResult(result.data, result.meta, fetchPage);
  }

  /** Fetch the primary paginated list (the configured `listPath`). */
  async list<P extends PaginationLike = PaginationLike>(
    params?: P,
  ): Promise<PaginatedResult<TList>> {
    return this.paginate<TList, P>(this.config.listPath, params);
  }

  /**
   * Fetch an entity's full detail by UUID (`/{detailBase}/{id}/detail`).
   * Returns `null` on 404; every other transport error propagates.
   */
  async getDetail(id: string, params?: DetailParams): Promise<TDetail | null> {
    return this.http.getOrNull<TDetail>(
      `/${this.config.detailBase}/${encodeURIComponent(id)}/detail`,
      { locale: params?.locale },
    );
  }

}
