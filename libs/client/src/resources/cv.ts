import type { HttpClient, PaginatedResult } from '../http.js';
import { ContentResource } from './content-resource.js';
import type {
  CvEntryDetailParams,
  CvEntryParams,
  CvEntryResponse,
  SkillDetailParams,
  SkillListParams,
  SkillResponse,
} from '../types.js';

/**
 * CV / resume operations.
 *
 * Provides access to skills (technologies, languages, tools) and CV entries
 * (work experience, education, certifications, projects).
 *
 * All operations require an API key with `Read` permission.
 */
export class CvResource extends ContentResource<CvEntryResponse, CvEntryResponse> {
  constructor(http: HttpClient, siteId: string) {
    // CV entries are the primary content axis; skills are an extra list below.
    super(http, siteId, {
      listPath: `/sites/${siteId}/cv`,
      detailBase: 'cv',
    });
  }

  /**
   * Fetch a paginated list of skills.
   *
   * **Endpoint:** `GET /sites/{siteId}/skills?page=&page_size=&search=&sort_by=&sort_dir=`
   *
   * @param params - Pagination, search, and sort options.
   * @returns A paginated result of skills (name, slug, category, proficiency level).
   *
   * @example
   * ```ts
   * const skills = await forja.cv.listSkills({ page: 1, pageSize: 50 });
   * const programming = skills.data.filter(s => s.category === 'Programming');
   * ```
   */
  async listSkills(
    params?: SkillListParams,
  ): Promise<PaginatedResult<SkillResponse>> {
    return this.paginate<SkillResponse>(`/sites/${this.siteId}/skills`, params);
  }

  /**
   * Fetch a skill by its UUID.
   *
   * **Endpoint:** `GET /skills/{id}`
   *
   * @param id - The skill's UUID.
   * @returns The skill, or `null` if not found.
   */
  async getSkill(
    id: string,
    params?: SkillDetailParams,
  ): Promise<SkillResponse | null> {
    return this.http.getOrNull<SkillResponse>(
      `/skills/${encodeURIComponent(id)}`,
      { locale: params?.locale },
    );
  }

  /**
   * Fetch a skill by its URL slug.
   *
   * **Endpoint:** `GET /skills/by-slug/{slug}`
   *
   * @param slug - The skill's slug (e.g. `"typescript"`, `"rust"`).
   * @returns The skill, or `null` if not found.
   *
   * @example
   * ```ts
   * const ts = await forja.cv.getSkillBySlug('typescript');
   * if (ts) console.log(`${ts.name}: level ${ts.proficiency_level}`);
   * ```
   */
  async getSkillBySlug(
    slug: string,
    params?: SkillDetailParams,
  ): Promise<SkillResponse | null> {
    return this.http.getOrNull<SkillResponse>(
      `/skills/by-slug/${encodeURIComponent(slug)}`,
      { locale: params?.locale },
    );
  }

  /**
   * Fetch a paginated list of CV entries (work, education, certifications, etc.).
   *
   * **Endpoint:** `GET /sites/{siteId}/cv?entry_type=&page=&page_size=&search=&sort_by=&sort_dir=`
   *
   * @param params - Pagination and filter options.
   * @param params.entryType - Filter by entry type: `"Work"`, `"Education"`, `"Volunteer"`, `"Certification"`, or `"Project"`.
   * @returns A paginated result of CV entries.
   *
   * @example
   * ```ts
   * const work = await forja.cv.listEntries({ entryType: 'Work' });
   * const education = await forja.cv.listEntries({ entryType: 'Education' });
   * ```
   */
  async listEntries(
    params?: CvEntryParams,
  ): Promise<PaginatedResult<CvEntryResponse>> {
    return this.paginate<CvEntryResponse>(`/sites/${this.siteId}/cv`, params);
  }

  /**
   * Fetch a CV entry by its UUID.
   *
   * **Endpoint:** `GET /cv/{id}`
   *
   * @param id - The CV entry's UUID.
   * @param params - Optional locale resolver per ADR 0002.
   * @returns The CV entry, or `null` if not found.
   *
   * @example
   * ```ts
   * // All localizations (default)
   * const entry = await forja.cv.getEntry('entry-uuid');
   *
   * // Single-locale collapse
   * const enEntry = await forja.cv.getEntry('entry-uuid', { locale: 'en' });
   * ```
   */
  async getEntry(
    id: string,
    params?: CvEntryDetailParams,
  ): Promise<CvEntryResponse | null> {
    return this.http.getOrNull<CvEntryResponse>(
      `/cv/${encodeURIComponent(id)}`,
      { locale: params?.locale },
    );
  }

  /**
   * Fetch a CV entry's full detail by its UUID.
   *
   * **Endpoint:** `GET /cv/{id}/detail`
   *
   * For CV entries the detail shape is identical to the lightweight
   * {@link getEntry} shape — the relational graph is bounded, so the
   * `/detail` route exists purely for uniformity across content types
   * (ADR 0003).
   *
   * @param id - The CV entry's UUID.
   * @param params - Optional locale resolver per ADR 0002.
   * @returns The CV entry detail, or `null` if not found.
   */
  async getEntryDetail(
    id: string,
    params?: CvEntryDetailParams,
  ): Promise<CvEntryResponse | null> {
    return super.getDetail(id, params);
  }
}
