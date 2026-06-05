import type { HttpClient } from '../http.js';
import type {
  NavigationItemResponse,
  NavigationMenuResponse,
  NavigationTree,
} from '../types.js';

/**
 * Navigation menu operations.
 *
 * Provides access to navigation menus, their hierarchical tree structure,
 * and individual menu items. Used to render site headers, footers, and sidebars.
 *
 * All operations require an API key with `Read` permission.
 */
export class NavigationResource {
  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
  ) {}

  /**
   * Fetch all navigation menus for the site.
   *
   * **Endpoint:** `GET /sites/{siteId}/menus`
   *
   * @returns Array of menu metadata (slug, description, depth, item count).
   *
   * @example
   * ```ts
   * const menus = await forja.navigation.listMenus();
   * const primary = menus.find(m => m.slug === 'primary');
   * ```
   */
  async listMenus(): Promise<NavigationMenuResponse[]> {
    return this.http.get<NavigationMenuResponse[]>(
      `/sites/${this.siteId}/menus`,
    );
  }

  /**
   * Fetch a navigation menu by its UUID.
   *
   * **Endpoint:** `GET /menus/{menuId}`
   *
   * @param menuId - The menu's UUID.
   * @returns Menu metadata, or `null` if not found.
   */
  async getMenu(menuId: string): Promise<NavigationMenuResponse | null> {
    return this.http.getOrNull<NavigationMenuResponse>(
      `/menus/${encodeURIComponent(menuId)}`,
    );
  }

  /**
   * Fetch a navigation menu by its slug.
   *
   * **Endpoint:** `GET /sites/{siteId}/menus/slug/{slug}`
   *
   * @param slug - The menu's slug (e.g. `"primary"`, `"footer"`).
   * @returns Menu metadata, or `null` if not found.
   *
   * @example
   * ```ts
   * const primary = await forja.navigation.getMenuBySlug('primary');
   * if (primary) {
   *   const tree = await forja.navigation.getTree(primary.id);
   * }
   * ```
   */
  async getMenuBySlug(slug: string): Promise<NavigationMenuResponse | null> {
    return this.http.getOrNull<NavigationMenuResponse>(
      `/sites/${this.siteId}/menus/slug/${encodeURIComponent(slug)}`,
    );
  }

  /**
   * Fetch the hierarchical navigation tree for a menu.
   *
   * **Endpoint:** `GET /menus/{menuId}/tree?locale=`
   *
   * Returns a recursive tree of navigation items with children, page slugs,
   * external URLs, and icons. Optionally filtered by locale for multi-language sites.
   *
   * @param menuId - The menu's UUID.
   * @param opts.locale - Optional locale code (e.g. `"en"`, `"de"`) to filter localized titles.
   * @returns Array of root-level navigation tree nodes (each may have nested children).
   *
   * @example
   * ```ts
   * const tree = await forja.navigation.getTree('menu-uuid', { locale: 'de' });
   * tree.forEach(node => {
   *   console.log(node.title, node.page_slug, node.children.length);
   * });
   * ```
   */
  async getTree(
    menuId: string,
    opts?: { locale?: string },
  ): Promise<NavigationTree[]> {
    return this.http.get<NavigationTree[]>(
      `/menus/${encodeURIComponent(menuId)}/tree`,
      opts?.locale ? { locale: opts.locale } : undefined,
    );
  }

  /**
   * Fetch all flat (non-hierarchical) items in a menu.
   *
   * **Endpoint:** `GET /menus/{menuId}/items`
   *
   * @param menuId - The menu's UUID.
   * @returns Array of navigation items (use `parent_id` to reconstruct hierarchy if needed).
   */
  async listItems(menuId: string): Promise<NavigationItemResponse[]> {
    return this.http.get<NavigationItemResponse[]>(
      `/menus/${encodeURIComponent(menuId)}/items`,
    );
  }

  /**
   * Fetch a single navigation item by its UUID.
   *
   * **Endpoint:** `GET /navigation/{itemId}`
   *
   * @param itemId - The navigation item's UUID.
   * @returns The navigation item, or `null` if not found.
   */
  async getItem(itemId: string): Promise<NavigationItemResponse | null> {
    return this.http.getOrNull<NavigationItemResponse>(
      `/navigation/${encodeURIComponent(itemId)}`,
    );
  }
}
