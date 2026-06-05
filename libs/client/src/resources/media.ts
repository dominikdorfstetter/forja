import type { HttpClient, PaginatedResult } from '../http.js';
import { createPaginatedResult, toQueryParams } from '../http.js';
import type { MediaListItem, MediaListParams, MediaResponse, Paginated } from '../types.js';

/**
 * Media asset operations.
 *
 * Provides access to media assets (images, videos, documents) stored in the CMS.
 * Each media item includes its public URL, dimensions, file metadata, and
 * responsive variants (thumbnails, different sizes).
 *
 * Requires an API key with `Read` permission.
 */
export class MediaResource {
  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
  ) {}

  /**
   * Fetch a paginated list of media assets for the site.
   *
   * **Endpoint:** `GET /sites/{siteId}/media?page=&page_size=&search=&sort_by=&sort_dir=&mime_category=&folder_id=`
   *
   * Returns a lightweight list without variants. Use {@link get} to fetch full
   * detail with responsive variants for a specific asset.
   *
   * @param params - Pagination, search, sort, and filter options.
   * @param params.search - Search by filename.
   * @param params.mimeCategory - Filter by MIME category: `"image"`, `"video"`, `"document"`, `"audio"`.
   * @param params.folderId - Filter to a specific media folder (UUID).
   * @returns A paginated result of media list items.
   *
   * @example
   * ```ts
   * // Browse all images
   * const images = await forja.media.list({ mimeCategory: 'image', pageSize: 20 });
   *
   * // Search by filename
   * const results = await forja.media.list({ search: 'hero-banner' });
   *
   * // Browse a specific folder
   * const folder = await forja.media.list({ folderId: 'folder-uuid' });
   * ```
   */
  async list(
    params?: MediaListParams,
  ): Promise<PaginatedResult<MediaListItem>> {
    const query = params ? toQueryParams(params) : undefined;
    const fetchPage = async (page: number) => {
      return this.http.get<Paginated<MediaListItem>>(
        `/sites/${this.siteId}/media`,
        { ...query, page: String(page) },
      );
    };
    const result = await fetchPage(params?.page ?? 1);
    return createPaginatedResult(result.data, result.meta, fetchPage);
  }

  /**
   * Fetch a media asset by its UUID.
   *
   * **Endpoint:** `GET /media/{id}`
   *
   * Returns the full media metadata including filename, MIME type, dimensions,
   * public URL, and all responsive variants (thumbnails, different sizes).
   *
   * @param id - The media asset's UUID.
   * @returns The media asset with variants, or `null` if not found.
   *
   * @example
   * ```ts
   * const cover = await forja.media.get(blog.cover_image_id);
   * if (cover) {
   *   console.log(cover.public_url);    // original image URL
   *   console.log(cover.variants);      // [{ variant_name, width, height, public_url }, ...]
   *   console.log(cover.mime_type);     // "image/jpeg"
   * }
   * ```
   */
  async get(id: string): Promise<MediaResponse | null> {
    return this.http.getOrNull<MediaResponse>(
      `/media/${encodeURIComponent(id)}`,
    );
  }
}
