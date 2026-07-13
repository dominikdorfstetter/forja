import type { HttpClient } from '../http.js';
import type {
  MenuWithTree,
  NavigationItemResponse,
  NavigationMenuResponse,
  NavigationTree,
  SiteLocaleResponse,
} from '../types.js';
import { SiteResource } from './site.js';

/**
 * Navigation menu operations.
 *
 * Provides access to navigation menus, their hierarchical tree structure,
 * and individual menu items. Used to render site headers, footers, and sidebars.
 *
 * All operations require an API key with `Read` permission.
 */
export class NavigationResource {
  /** Memoized site-locales listing, shared by every `getMenuWithTree` call
   * on this client instance. Cleared on failure so a later call can retry. */
  private localesPromise?: Promise<SiteLocaleResponse[]>;

  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
    private readonly site: SiteResource = new SiteResource(http, siteId),
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
   * Fetch a menu and its navigation tree in one call, with the menu's
   * display name resolved for a locale.
   *
   * Composes `getMenuBySlug` and `getTree`. The menu fetch and the locale
   * lookup run concurrently; the tree request starts once both are known,
   * because `opts.locale` is first resolved against the site's configured
   * locales — a code the site doesn't configure is not forwarded to
   * `getTree` (the tree endpoint rejects unknown codes), so the tree is
   * fetched locale-less instead. The locale code → id mapping comes from the
   * site-locales listing, fetched once per client instance and reused across
   * calls.
   *
   * `menu.resolvedName` is the localization matching `opts.locale`, or `null`
   * when no locale is passed, the code isn't configured for the site, or the
   * menu has no localization for it — fall back to your own default (e.g.
   * `resolvedName ?? menu.slug`).
   *
   * @param slug - The menu's slug (e.g. `"primary"`, `"footer"`).
   * @param opts.locale - Optional locale code (e.g. `"de"`) used to resolve
   *   the menu name and localize item titles.
   * @returns `{ menu, items }`, or `null` if no menu has that slug.
   *
   * @example
   * ```ts
   * const footer = await forja.navigation.getMenuWithTree('footer', { locale: 'de' });
   * if (footer) {
   *   console.log(footer.menu.resolvedName ?? footer.menu.slug);
   *   footer.items.forEach(node => console.log(node.title));
   * }
   * ```
   */
  async getMenuWithTree(
    slug: string,
    opts?: { locale?: string },
  ): Promise<MenuWithTree | null> {
    const [menu, localeId] = await Promise.all([
      this.getMenuBySlug(slug),
      opts?.locale ? this.localeIdForCode(opts.locale) : null,
    ]);
    if (!menu) return null;

    const items = await this.getTree(
      menu.id,
      opts?.locale && localeId ? { locale: opts.locale } : undefined,
    );
    const localization = localeId
      ? menu.localizations?.find((l) => l.locale_id === localeId)
      : undefined;
    return {
      menu: { ...menu, resolvedName: localization?.name ?? null },
      items,
    };
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

  private listLocalesCached(): Promise<SiteLocaleResponse[]> {
    this.localesPromise ??= this.site.listLocales().catch((error) => {
      this.localesPromise = undefined;
      throw error;
    });
    return this.localesPromise;
  }

  private async localeIdForCode(code: string): Promise<string | null> {
    const locales = await this.listLocalesCached();
    return locales.find((l) => l.code === code)?.locale_id ?? null;
  }
}
