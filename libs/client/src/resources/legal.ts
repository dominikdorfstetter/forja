import type { HttpClient, PaginatedResult } from '../http.js';
import { ContentResource } from './content-resource.js';
import type {
  LegalDetailParams,
  LegalDocumentDetailResponse,
  LegalDocumentFullDetailResponse,
  LegalDocumentResponse,
  LegalDocumentWithGroups,
  LegalGroupWithItems,
  LegalItemResponse,
  LegalListParams,
  LegalVersionResponse,
} from '../types.js';

/**
 * Legal document operations.
 *
 * Provides access to legal documents (privacy policy, terms of service, cookie consent, etc.),
 * their consent groups, and individual consent items for building cookie banners and legal pages.
 *
 * All operations require an API key with `Read` permission.
 */
export class LegalResource extends ContentResource<
  LegalDocumentResponse,
  LegalDocumentFullDetailResponse
> {
  constructor(http: HttpClient, siteId: string) {
    super(http, siteId, {
      listPath: `/sites/${siteId}/legal`,
      detailBase: 'legal',
    });
  }

  /**
   * Fetch a paginated list of legal documents for the site.
   *
   * **Endpoint:** `GET /sites/{siteId}/legal?page=&page_size=&search=&sort_by=&sort_dir=&status=&exclude_status=&exclude_document_type=`
   *
   * @param params - Pagination, search, sort, and status/type filter options.
   * @returns A paginated result of legal document summaries.
   *
   * @example
   * ```ts
   * const docs = await forja.legal.list();
   * // Only published documents, without the cookie-consent doc:
   * const published = await forja.legal.list({
   *   status: 'Published',
   *   excludeDocumentType: 'CookieConsent',
   * });
   * ```
   */
  async list(
    params?: LegalListParams,
  ): Promise<PaginatedResult<LegalDocumentResponse>> {
    return this.paginate<LegalDocumentResponse>(
      `/sites/${this.siteId}/legal`,
      params,
    );
  }

  /**
   * Fetch a legal document by its UUID, including localizations.
   *
   * **Endpoint:** `GET /legal/{id}`
   *
   * @param id - The legal document's UUID.
   * @returns The document with all localizations, or `null` if not found.
   */
  async get(id: string): Promise<LegalDocumentDetailResponse | null> {
    return this.http.getOrNull<LegalDocumentDetailResponse>(
      `/legal/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Fetch a legal document by its URL slug.
   *
   * **Endpoint:** `GET /sites/{siteId}/legal/by-slug/{slug}`
   *
   * @param slug - The document slug (e.g. `"privacy-policy"`, `"terms-of-service"`).
   * @returns The document with all localizations, or `null` if not found.
   *
   * @example
   * ```ts
   * const privacy = await forja.legal.getBySlug('privacy-policy');
   * if (privacy) {
   *   const enLocale = privacy.localizations.find(l => l.locale_id === enLocaleId);
   * }
   * ```
   */
  async getBySlug(
    slug: string,
    params?: LegalDetailParams,
  ): Promise<LegalDocumentDetailResponse | null> {
    return this.http.getOrNull<LegalDocumentDetailResponse>(
      `/sites/${this.siteId}/legal/by-slug/${encodeURIComponent(slug)}`,
      { locale: params?.locale },
    );
  }

  /**
   * Fetch the cookie consent document with its consent groups and items.
   *
   * **Endpoint:** `GET /sites/{siteId}/legal/cookie-consent`
   *
   * Returns a structured document with groups (e.g. "Essential", "Analytics", "Marketing")
   * and their items, including `is_required` and `default_enabled` flags for building
   * GDPR-compliant cookie consent banners.
   *
   * @returns The cookie consent document with groups and items, or `null` if not configured.
   *
   * @example
   * ```ts
   * const consent = await forja.legal.getCookieConsent();
   * if (consent) {
   *   consent.groups.forEach(group => {
   *     console.log(group.cookie_name, group.is_required ? '(required)' : '(optional)');
   *   });
   * }
   * ```
   */
  async getCookieConsent(): Promise<LegalDocumentWithGroups | null> {
    return this.http.getOrNull<LegalDocumentWithGroups>(
      `/sites/${this.siteId}/legal/cookie-consent`,
    );
  }

  /**
   * Fetch consent groups (with their items) for a legal document.
   *
   * **Endpoint:** `GET /legal/{documentId}/groups`
   *
   * @param documentId - The legal document's UUID.
   * @returns Array of consent groups, each containing their items.
   */
  async getGroups(documentId: string): Promise<LegalGroupWithItems[]> {
    return this.http.get<LegalGroupWithItems[]>(
      `/legal/${encodeURIComponent(documentId)}/groups`,
    );
  }

  /**
   * Fetch consent items within a specific group.
   *
   * **Endpoint:** `GET /legal/groups/{groupId}/items`
   *
   * @param groupId - The consent group's UUID.
   * @returns Array of consent items (cookie name, required flag, display order).
   */
  async getGroupItems(groupId: string): Promise<LegalItemResponse[]> {
    return this.http.get<LegalItemResponse[]>(
      `/legal/groups/${encodeURIComponent(groupId)}/items`,
    );
  }

  // getDetail(id, { locale }) → GET /legal/{id}/detail, returning the full
  // content-body localizations (vs get()'s lighter doc localizations), is
  // inherited from ContentResource (detailBase: 'legal').

  /**
   * Fetch the version history of a legal document.
   *
   * **Endpoint:** `GET /legal/{id}/versions`
   *
   * Returns all versions of the document, ordered by version number.
   * Each entry includes the version number, content status, and creation date.
   * Use for displaying a "Version history" section on legal pages.
   *
   * @param id - The legal document's UUID.
   * @returns Array of version entries, newest first.
   *
   * @example
   * ```ts
   * const versions = await forja.legal.listVersions('doc-uuid');
   * versions.forEach(v => {
   *   console.log(`v${v.version} — ${v.status} — ${v.created_at}`);
   * });
   * ```
   */
  async listVersions(id: string): Promise<LegalVersionResponse[]> {
    return this.http.get<LegalVersionResponse[]>(
      `/legal/${encodeURIComponent(id)}/versions`,
    );
  }
}
