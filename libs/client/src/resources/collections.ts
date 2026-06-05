import type { HttpClient, PaginatedResult } from '../http.js';
import { createPaginatedResult } from '../http.js';
import type { Paginated } from '../types.js';

/**
 * A published custom-type ("Collection") entry as served on the public
 * Consumer API. PII fields are stripped server-side; `data` merges the shared
 * and localized values with the title under the designated title field key.
 */
export interface PublicCollectionEntry {
  slug: string | null;
  status: string;
  published_at: string | null;
  locale: string | null;
  data: Record<string, unknown>;
}

/** A single field in a public collection schema (no PII / compliance metadata). */
export interface PublicCollectionField {
  key: string;
  label: string;
  field_type: string;
  localized: boolean;
  /** The designated title field — renderers use it as the heading. */
  is_title: boolean;
  enum_options?: unknown;
}

/** A collection's public field schema, for generic renderers. */
export interface PublicCollectionSchema {
  key: string;
  name: string;
  content_kind: string;
  fields: PublicCollectionField[];
}

export interface PublicCollectionListParams {
  locale?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Read operations for one custom type ("Collection"), parameterised by its
 * key. Obtain via {@link ForjaClient.collections | `forja.collections(key)`}.
 * One generic resource serves every type — no per-type codegen.
 *
 * Only types flagged publicly-readable are served; everything else surfaces
 * as `null` (by-slug / schema) or a 404 (`bySlug`/`schema` return `null`).
 */
export class CollectionsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
    private readonly typeKey: string,
  ) {}

  private base(): string {
    return `/sites/${this.siteId}/collections/${encodeURIComponent(this.typeKey)}`;
  }

  /**
   * Paginated list of published entries.
   *
   * **Endpoint:** `GET /sites/{siteId}/collections/{typeKey}/published`
   */
  async published(
    params?: PublicCollectionListParams,
  ): Promise<PaginatedResult<PublicCollectionEntry>> {
    const fetchPage = async (page: number) =>
      this.http.get<Paginated<PublicCollectionEntry>>(`${this.base()}/published`, {
        ...(params?.locale ? { locale: params.locale } : {}),
        ...(params?.pageSize ? { page_size: String(params.pageSize) } : {}),
        page: String(page),
      });
    const result = await fetchPage(params?.page ?? 1);
    return createPaginatedResult(result.data, result.meta, fetchPage);
  }

  /**
   * A single published entry by slug, or `null` if not found / not public.
   *
   * **Endpoint:** `GET /sites/{siteId}/collections/{typeKey}/by-slug/{slug}`
   */
  async bySlug(
    slug: string,
    params?: { locale?: string },
  ): Promise<PublicCollectionEntry | null> {
    return this.http.getOrNull<PublicCollectionEntry>(
      `${this.base()}/by-slug/${encodeURIComponent(slug)}`,
      { locale: params?.locale },
    );
  }

  /**
   * The collection's public field schema, or `null` if not public.
   *
   * **Endpoint:** `GET /sites/{siteId}/collections/{typeKey}/schema`
   */
  async schema(): Promise<PublicCollectionSchema | null> {
    return this.http.getOrNull<PublicCollectionSchema>(`${this.base()}/schema`);
  }
}
