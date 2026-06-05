import type { HttpClient, PaginatedResult } from '../http.js';
import { ContentResource } from './content-resource.js';
import type {
  PageDetailResponse,
  PageListItem,
  PageSectionResponse,
  SearchablePaginationParams,
  SectionLocalizationResponse,
} from '../types.js';

/**
 * Extended pagination params for page listings.
 * Supports filtering by status, page type, and exclusion.
 */
export interface PageListParams extends SearchablePaginationParams {
  /** Filter by content status (e.g. `"Published"`, `"Draft"`). */
  status?: string;
  /** Filter by page type (e.g. `"Static"`, `"Landing"`, `"Contact"`). */
  pageType?: string;
  /** Exclude pages with this status. */
  excludeStatus?: string;
}

/**
 * Options for page-detail lookups (`getDetail`). The list shape
 * (`PageResponse`) does not carry `localizations[]` today — adding it is
 * tracked as a separate canonicalization gap; until then the resolver
 * applies only to the detail endpoint.
 */
export interface PageDetailParams {
  /**
   * Optional locale code (e.g. `"en"`). When set, `localizations[]`
   * collapses to one resolved entry. See ADR 0002.
   */
  locale?: string;
}

/**
 * CMS page operations.
 *
 * Provides access to page listings, route-based lookup, page sections,
 * and section localizations for multi-language content rendering.
 *
 * All operations require an API key with `Read` permission.
 */
export class PagesResource extends ContentResource<PageListItem, PageDetailResponse> {
  constructor(http: HttpClient, siteId: string) {
    super(http, siteId, {
      listPath: `/sites/${siteId}/pages`,
      detailBase: 'pages',
    });
  }

  /**
   * Fetch a paginated list of CMS pages.
   *
   * **Endpoint:** `GET /sites/{siteId}/pages?page=&page_size=&search=&status=&page_type=&sort_by=&sort_dir=&exclude_status=`
   *
   * @param params - Pagination, search, and filter options.
   * @returns A paginated result of page list items.
   *
   * @example
   * ```ts
   * const pages = await forja.pages.list({ page: 1, pageSize: 100 });
   * const allPages = await pages.fetchAll();
   * ```
   */
  async list(
    params?: PageListParams,
  ): Promise<PaginatedResult<PageListItem>> {
    return this.paginate<PageListItem>(`/sites/${this.siteId}/pages`, params);
  }

  /**
   * Fetch a page by its URL route path.
   *
   * **Endpoint:** `GET /sites/{siteId}/pages/by-route/{route}`
   *
   * Leading slashes are stripped automatically (`"/about"` and `"about"` both work).
   *
   * @param route - The page's route path (e.g. `"/about"` or `"contact"`).
   * @returns The page detail with localizations and OG image, or `null` if not found.
   *
   * @example
   * ```ts
   * const aboutPage = await forja.pages.getByRoute('/about');
   * if (aboutPage) {
   *   console.log(aboutPage.localizations[0]?.title);
   * }
   * ```
   */
  async getByRoute(route: string): Promise<PageDetailResponse | null> {
    const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
    return this.http.getOrNull<PageDetailResponse>(
      `/sites/${this.siteId}/pages/by-route/${encodeURIComponent(cleanRoute)}`,
    );
  }

  // getDetail(id, { locale }) → GET /pages/{id}/detail (content localizations
  // + computed OG image) is inherited from ContentResource (detailBase: 'pages').

  /**
   * Fetch all sections for a page.
   *
   * **Endpoint:** `GET /pages/{pageId}/sections`
   *
   * Sections are returned in display order and include type, settings,
   * cover image reference, and call-to-action route.
   *
   * @param pageId - The page's UUID.
   * @returns Array of page sections.
   */
  async getSections(pageId: string): Promise<PageSectionResponse[]> {
    return this.http.get<PageSectionResponse[]>(
      `/pages/${encodeURIComponent(pageId)}/sections`,
    );
  }

  /**
   * Fetch localizations for a single section.
   *
   * **Endpoint:** `GET /pages/sections/{sectionId}/localizations`
   *
   * @param sectionId - The section's UUID.
   * @returns Array of localized content (title, text, button text) per locale.
   */
  async getSectionLocalizations(
    sectionId: string,
  ): Promise<SectionLocalizationResponse[]> {
    return this.http.get<SectionLocalizationResponse[]>(
      `/pages/sections/${encodeURIComponent(sectionId)}/localizations`,
    );
  }

  /**
   * Fetch localizations for all sections of a page in a single request.
   *
   * **Endpoint:** `GET /pages/{pageId}/sections/localizations`
   *
   * More efficient than calling {@link getSectionLocalizations} per section.
   *
   * @param pageId - The page's UUID.
   * @returns Array of all section localizations for the page.
   */
  async getPageSectionLocalizations(
    pageId: string,
  ): Promise<SectionLocalizationResponse[]> {
    return this.http.get<SectionLocalizationResponse[]>(
      `/pages/${encodeURIComponent(pageId)}/sections/localizations`,
    );
  }
}
