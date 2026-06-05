import type { HttpClient, PaginatedResult } from '../http.js';
import { ContentResource } from './content-resource.js';
import type {
  BlogDetailResponse,
  BlogDetailParams,
  BlogListItem,
  LocaleFilterParams,
} from '../types.js';

/**
 * Blog post operations.
 *
 * Provides access to published blog content, featured posts, category filtering,
 * similar post discovery, and individual blog retrieval by ID or slug.
 *
 * All read operations require an API key with `Read` permission.
 */
export class BlogsResource extends ContentResource<BlogListItem, BlogDetailResponse> {
  constructor(http: HttpClient, siteId: string) {
    super(http, siteId, {
      listPath: `/sites/${siteId}/blogs/published`,
      detailBase: 'blogs',
    });
  }

  /**
   * Fetch a paginated list of published blog posts.
   *
   * **Endpoint:** `GET /sites/{siteId}/blogs/published?page=&page_size=&locale_id=`
   *
   * @param params - Pagination and locale filter options.
   * @param params.page - 1-indexed page number (default: 1).
   * @param params.pageSize - Items per page (default: server-side, typically 10).
   * @param params.localeId - Filter to blogs with content in this locale (UUID).
   * @returns A paginated result with {@link PaginatedResult.fetchNext | fetchNext()},
   *   {@link PaginatedResult.fetchAll | fetchAll()}, and async iteration support.
   *
   * @example
   * ```ts
   * // All locales
   * const page1 = await forja.blogs.listPublished({ page: 1, pageSize: 10 });
   *
   * // Filtered to a specific locale
   * const german = await forja.blogs.listPublished({ page: 1, localeId: 'de-locale-uuid' });
   * ```
   */
  async listPublished(
    params?: LocaleFilterParams,
  ): Promise<PaginatedResult<BlogListItem>> {
    return this.paginate<BlogListItem>(
      `/sites/${this.siteId}/blogs/published`,
      params,
      params?.localeId ? { locale_id: params.localeId } : undefined,
    );
  }

  /**
   * Fetch published blog posts filtered by category.
   *
   * **Endpoint:** `GET /sites/{siteId}/blogs/published/category/{categorySlug}?page=&page_size=&locale_id=`
   *
   * @param categorySlug - The category slug to filter by (e.g. `"tech"`, `"travel"`).
   * @param params - Pagination and locale filter options.
   * @returns A paginated result of blogs in the given category.
   *
   * @example
   * ```ts
   * const techBlogs = await forja.blogs.listByCategory('tech', { page: 1, localeId: 'uuid' });
   * ```
   */
  async listByCategory(
    categorySlug: string,
    params?: LocaleFilterParams,
  ): Promise<PaginatedResult<BlogListItem>> {
    return this.paginate<BlogListItem>(
      `/sites/${this.siteId}/blogs/published/category/${encodeURIComponent(categorySlug)}`,
      params,
      params?.localeId ? { locale_id: params.localeId } : undefined,
    );
  }

  /**
   * Fetch featured blog posts.
   *
   * **Endpoint:** `GET /sites/{siteId}/blogs/featured?limit=`
   *
   * @param opts.limit - Maximum number of featured posts to return (default: server-side).
   * @returns Array of blog detail responses (includes localizations, categories, documents).
   *
   * @example
   * ```ts
   * const featured = await forja.blogs.listFeatured({ limit: 3 });
   * ```
   */
  async listFeatured(opts?: { limit?: number }): Promise<BlogDetailResponse[]> {
    return this.http.get<BlogDetailResponse[]>(
      `/sites/${this.siteId}/blogs/featured`,
      opts?.limit !== undefined ? { limit: String(opts.limit) } : undefined,
    );
  }

  /**
   * Fetch blog posts similar to a given blog (by shared categories/tags).
   *
   * **Endpoint:** `GET /sites/{siteId}/blogs/{blogId}/similar?limit=`
   *
   * @param blogId - The UUID of the blog to find similar content for.
   * @param opts.limit - Maximum number of similar posts (default: server-side, typically 3).
   * @returns Array of similar blog list items.
   *
   * @example
   * ```ts
   * const similar = await forja.blogs.listSimilar('blog-uuid', { limit: 3 });
   * ```
   */
  async listSimilar(
    blogId: string,
    opts?: { limit?: number },
  ): Promise<BlogListItem[]> {
    return this.http.get<BlogListItem[]>(
      `/sites/${this.siteId}/blogs/${encodeURIComponent(blogId)}/similar`,
      opts?.limit !== undefined ? { limit: String(opts.limit) } : undefined,
    );
  }

  /**
   * Fetch a blog post's full detail by its URL slug.
   *
   * Performs a two-step lookup:
   * 1. **Endpoint:** `GET /sites/{siteId}/blogs/by-slug/{slug}` — resolves slug to ID.
   * 2. **Endpoint:** `GET /blogs/{id}/detail` — fetches the full detail response.
   *
   * @param slug - The blog's URL slug (e.g. `"my-first-post"`).
   * @returns The full blog detail (with localizations, categories, documents), or `null` if not found.
   *
   * @example
   * ```ts
   * const blog = await forja.blogs.getBySlug('my-first-post');
   * if (blog) {
   *   console.log(blog.localizations[0]?.title);
   * }
   * ```
   */
  async getBySlug(
    slug: string,
    params?: BlogDetailParams,
  ): Promise<BlogDetailResponse | null> {
    const brief = await this.http.getOrNull<{ id: string }>(
      `/sites/${this.siteId}/blogs/by-slug/${encodeURIComponent(slug)}`,
    );
    if (!brief) return null;
    return this.http.getOrNull<BlogDetailResponse>(
      `/blogs/${brief.id}/detail`,
      { locale: params?.locale },
    );
  }

  /**
   * Fetch a blog post's full detail by its UUID.
   *
   * **Endpoint:** `GET /blogs/{id}/detail`
   *
   * @param idOrSlug - The blog's UUID.
   * @returns The full blog detail (with localizations, categories, documents), or `null` if not found.
   *
   * @example
   * ```ts
   * const blog = await forja.blogs.get('550e8400-e29b-41d4-a716-446655440000');
   * ```
   */
  async get(
    idOrSlug: string,
    params?: BlogDetailParams,
  ): Promise<BlogDetailResponse | null> {
    return super.getDetail(idOrSlug, params);
  }

  /**
   * Fetch the site's RSS feed as raw XML.
   *
   * **Endpoint:** `GET /sites/{siteId}/feed.rss`
   *
   * @returns RSS 2.0 XML string.
   */
  async rss(): Promise<string> {
    return this.http.getText(`/sites/${this.siteId}/feed.rss`);
  }
}
