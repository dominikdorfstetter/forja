import type { HttpClient, PaginatedResult } from '../http.js';
import { ContentResource } from './content-resource.js';
import type {
  ProjectDetailParams,
  ProjectDetailResponse,
  ProjectListParams,
  ProjectResponse,
} from '../types.js';

/**
 * Portfolio project operations.
 *
 * Provides access to published projects with localizations, links, media
 * attachments, and skill/CV associations. Use for portfolio pages, project
 * showcases, and case studies.
 *
 * All read operations require an API key with `Read` permission.
 */
export class ProjectsResource extends ContentResource<
  ProjectResponse,
  ProjectDetailResponse
> {
  constructor(http: HttpClient, siteId: string) {
    super(http, siteId, {
      listPath: `/sites/${siteId}/projects/public`,
      detailBase: 'projects',
    });
  }

  /**
   * Fetch a paginated list of published projects.
   *
   * **Endpoint:** `GET /sites/{siteId}/projects/public?page=&page_size=&sort_by=&sort_dir=&is_featured=`
   *
   * Returns projects with `published` or `scheduled` status that are within
   * their publish window. Results can be sorted and filtered to featured only.
   *
   * @param params - Pagination, sort, and filter options.
   * @param params.page - 1-indexed page number (default: 1).
   * @param params.pageSize - Items per page, 1–100 (default: 10).
   * @param params.sortBy - Sort field (e.g. `"display_order"`, `"start_date"`, `"created_at"`).
   * @param params.sortDir - Sort direction: `"asc"` or `"desc"`.
   * @param params.isFeatured - When `true`, returns only featured projects.
   * @returns A paginated result with {@link PaginatedResult.fetchNext | fetchNext()},
   *   {@link PaginatedResult.fetchAll | fetchAll()}, and async iteration support.
   *
   * @example
   * ```ts
   * // All published projects
   * const projects = await forja.projects.listPublished({ page: 1, pageSize: 12 });
   *
   * // Featured projects only, sorted by display order
   * const featured = await forja.projects.listPublished({
   *   isFeatured: true,
   *   sortBy: 'display_order',
   *   sortDir: 'asc',
   * });
   * ```
   */
  async listPublished(
    params?: ProjectListParams,
  ): Promise<PaginatedResult<ProjectResponse>> {
    return this.paginate<ProjectResponse>(
      `/sites/${this.siteId}/projects/public`,
      params,
    );
  }

  /**
   * Fetch a project (lightweight list shape) by its UUID.
   *
   * **Endpoint:** `GET /projects/{id}`
   *
   * Returns the list-shape project: scalar fields, `skill_ids`, and
   * `localizations` (title, description per locale). The relational graph
   * held off the list — `links`, `media`, `cv_entry_ids` — is available
   * via {@link getDetail} (ADR 0001 / ADR 0003).
   *
   * @param id - The project's UUID.
   * @param params - Optional locale resolver per ADR 0002.
   * @returns The project (lightweight), or `null` if not found.
   *
   * @example
   * ```ts
   * const project = await forja.projects.get('project-uuid');
   * if (project) {
   *   const loc = project.localizations.find(l => l.locale_id === localeId);
   *   console.log(loc?.title, loc?.short_description);
   * }
   * ```
   */
  async get(
    id: string,
    params?: ProjectDetailParams,
  ): Promise<ProjectResponse | null> {
    return this.http.getOrNull<ProjectResponse>(
      `/projects/${encodeURIComponent(id)}`,
      { locale: params?.locale },
    );
  }

  // getDetail(id, { locale }) → GET /projects/{id}/detail, with the full
  // relational graph (links / media / cv_entry_ids), is inherited from
  // ContentResource (detailBase: 'projects').

  /**
   * Fetch a project by its URL slug.
   *
   * **Endpoint:** `GET /sites/{siteId}/projects/by-slug/{slug}`
   *
   * @param slug - The project's URL slug (e.g. `"forja-cms"`, `"my-portfolio"`).
   * @returns The project summary, or `null` if not found.
   *
   * @example
   * ```ts
   * const project = await forja.projects.getBySlug('forja-cms');
   * ```
   */
  async getBySlug(
    slug: string,
    params?: ProjectDetailParams,
  ): Promise<ProjectResponse | null> {
    return this.http.getOrNull<ProjectResponse>(
      `/sites/${this.siteId}/projects/by-slug/${encodeURIComponent(slug)}`,
      { locale: params?.locale },
    );
  }
}
