import type { HttpClient, PaginatedResult } from '../http.js';
import { createPaginatedResult, toQueryParams } from '../http.js';
import type {
  CategoryResponse,
  CategoryWithCountResponse,
  Paginated,
  SearchablePaginationParams,
  TagResponse,
} from '../types.js';

/**
 * Taxonomy operations (tags and categories).
 *
 * Tags and categories are used to organize blog posts and other content.
 * Categories support hierarchy (parent/child), while tags are flat labels.
 *
 * All operations require an API key with `Read` permission.
 */
export class TaxonomyResource {
  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
  ) {}

  /**
   * Fetch a paginated list of tags for the site.
   *
   * **Endpoint:** `GET /sites/{siteId}/tags?page=&page_size=&search=&sort_by=&sort_dir=`
   *
   * @param params - Pagination, search, and sort options.
   * @returns A paginated result of tags.
   *
   * @example
   * ```ts
   * const tags = await forja.taxonomy.listTags({ search: 'rust', sortBy: 'slug' });
   * ```
   */
  async listTags(
    params?: SearchablePaginationParams,
  ): Promise<PaginatedResult<TagResponse>> {
    const query = params ? toQueryParams(params) : undefined;
    const fetchPage = async (page: number) => {
      return this.http.get<Paginated<TagResponse>>(
        `/sites/${this.siteId}/tags`,
        { ...query, page: String(page) },
      );
    };
    const result = await fetchPage(params?.page ?? 1);
    return createPaginatedResult(result.data, result.meta, fetchPage);
  }

  /**
   * Fetch a paginated list of categories for the site.
   *
   * **Endpoint:** `GET /sites/{siteId}/categories?page=&page_size=&search=&sort_by=&sort_dir=`
   *
   * @param params - Pagination, search, and sort options.
   * @returns A paginated result of categories.
   *
   * @example
   * ```ts
   * const categories = await forja.taxonomy.listCategories({ page: 1, pageSize: 50 });
   * ```
   */
  async listCategories(
    params?: SearchablePaginationParams,
  ): Promise<PaginatedResult<CategoryResponse>> {
    const query = params ? toQueryParams(params) : undefined;
    const fetchPage = async (page: number) => {
      return this.http.get<Paginated<CategoryResponse>>(
        `/sites/${this.siteId}/categories`,
        { ...query, page: String(page) },
      );
    };
    const result = await fetchPage(params?.page ?? 1);
    return createPaginatedResult(result.data, result.meta, fetchPage);
  }

  /**
   * Fetch all categories with their associated blog post counts.
   *
   * **Endpoint:** `GET /sites/{siteId}/categories/blog-counts`
   *
   * Useful for rendering category sidebars with post counts.
   *
   * @returns Array of categories, each with a `blog_count` field.
   *
   * @example
   * ```ts
   * const categories = await forja.taxonomy.getCategoriesWithBlogCounts();
   * categories.forEach(c => console.log(`${c.slug}: ${c.blog_count} posts`));
   * ```
   */
  async getCategoriesWithBlogCounts(): Promise<CategoryWithCountResponse[]> {
    return this.http.get<CategoryWithCountResponse[]>(
      `/sites/${this.siteId}/categories/blog-counts`,
    );
  }

  /**
   * Fetch all tags associated with a specific content item (blog, page, etc.).
   *
   * **Endpoint:** `GET /content/{contentId}/tags`
   *
   * @param contentId - The content item's UUID (the `content_id` field, not the blog/page ID).
   * @returns Array of tags assigned to the content.
   */
  async getContentTags(contentId: string): Promise<TagResponse[]> {
    return this.http.get<TagResponse[]>(
      `/content/${encodeURIComponent(contentId)}/tags`,
    );
  }

  /**
   * Fetch all categories associated with a specific content item.
   *
   * **Endpoint:** `GET /content/{contentId}/categories`
   *
   * @param contentId - The content item's UUID (the `content_id` field, not the blog/page ID).
   * @returns Array of categories assigned to the content.
   */
  async getContentCategories(contentId: string): Promise<CategoryResponse[]> {
    return this.http.get<CategoryResponse[]>(
      `/content/${encodeURIComponent(contentId)}/categories`,
    );
  }

  /**
   * Fetch a single tag by its UUID.
   *
   * **Endpoint:** `GET /tags/{id}`
   *
   * @param id - The tag's UUID.
   * @returns The tag, or `null` if not found.
   *
   * @example
   * ```ts
   * const tag = await forja.taxonomy.getTag('tag-uuid');
   * ```
   */
  async getTag(id: string): Promise<TagResponse | null> {
    return this.http.getOrNull<TagResponse>(
      `/tags/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Fetch a single tag by its URL slug.
   *
   * **Endpoint:** `GET /tags/by-slug/{slug}`
   *
   * @param slug - The tag's URL slug (e.g. `"typescript"`, `"web-components"`).
   * @returns The tag, or `null` if not found.
   *
   * @example
   * ```ts
   * const tag = await forja.taxonomy.getTagBySlug('typescript');
   * if (tag) {
   *   console.log(tag.name, tag.slug);
   * }
   * ```
   */
  async getTagBySlug(slug: string): Promise<TagResponse | null> {
    return this.http.getOrNull<TagResponse>(
      `/tags/by-slug/${encodeURIComponent(slug)}`,
    );
  }

  /**
   * Fetch a single category by its UUID.
   *
   * **Endpoint:** `GET /categories/{id}`
   *
   * @param id - The category's UUID.
   * @returns The category, or `null` if not found.
   *
   * @example
   * ```ts
   * const category = await forja.taxonomy.getCategory('cat-uuid');
   * ```
   */
  async getCategory(id: string): Promise<CategoryResponse | null> {
    return this.http.getOrNull<CategoryResponse>(
      `/categories/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Fetch child categories of a parent category.
   *
   * **Endpoint:** `GET /categories/{parentId}/children`
   *
   * Use to build hierarchical category trees (e.g. nested navigation menus,
   * category sidebars with subcategories).
   *
   * @param parentId - The parent category's UUID.
   * @returns Array of child categories.
   *
   * @example
   * ```ts
   * const subcategories = await forja.taxonomy.getCategoryChildren('parent-uuid');
   * subcategories.forEach(child => console.log(child.slug));
   * ```
   */
  async getCategoryChildren(parentId: string): Promise<CategoryResponse[]> {
    return this.http.get<CategoryResponse[]>(
      `/categories/${encodeURIComponent(parentId)}/children`,
    );
  }
}
