import type { HttpClient } from '../http.js';
import type { CodeInjection, SiteLocaleResponse, SiteResponse } from '../types.js';

/**
 * Site configuration operations.
 *
 * Provides access to the site's metadata (name, slug, timezone, etc.)
 * and configured locales (languages available for content).
 *
 * Requires an API key with `Read` permission.
 */
export class SiteResource {
  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
  ) {}

  /**
   * Fetch the site's configuration.
   *
   * **Endpoint:** `GET /sites/{siteId}`
   *
   * Returns the site's name, slug, description, logo/favicon URLs, timezone,
   * theme settings, and default locale. Useful for rendering site-wide UI
   * elements (header, footer, SEO defaults).
   *
   * @returns The site configuration.
   *
   * @example
   * ```ts
   * const site = await forja.site.get();
   * console.log(site.name);        // "My Website"
   * console.log(site.timezone);    // "Europe/Vienna"
   * console.log(site.favicon_url); // "https://cdn.example.com/favicon.ico"
   * ```
   */
  async get(): Promise<SiteResponse> {
    return this.http.get<SiteResponse>(
      `/sites/${this.siteId}`,
    );
  }

  /**
   * Fetch all locales configured for the site.
   *
   * **Endpoint:** `GET /sites/{siteId}/locales`
   *
   * Returns the languages available for content on this site, including
   * the default locale, locale codes, text direction (LTR/RTL), and
   * active status. Use to build language switchers and determine which
   * locale to pass to other API calls (e.g. blog listing with `localeId`).
   *
   * @returns Array of site locales, with the default locale marked via `is_default`.
   *
   * @example
   * ```ts
   * const locales = await forja.site.listLocales();
   * const defaultLocale = locales.find(l => l.is_default);
   * console.log(defaultLocale?.code); // "en"
   *
   * // Build a language switcher
   * locales
   *   .filter(l => l.is_active)
   *   .forEach(l => console.log(`${l.name} (${l.code})`));
   * ```
   */
  async listLocales(): Promise<SiteLocaleResponse[]> {
    return this.http.get<SiteLocaleResponse[]>(
      `/sites/${this.siteId}/locales`,
    );
  }

  /**
   * Get code injection scripts configured for this site.
   *
   * **Endpoint:** `GET /sites/{siteId}/settings`
   *
   * Returns the custom HTML/JS snippets configured for injection into
   * the site's `<head>` and footer. Use these to embed analytics tags,
   * chat widgets, or any custom scripts into your template.
   *
   * Fields that are not configured on the server default to empty strings.
   *
   * Requires an API key with `Read` permission.
   *
   * @returns The code injection head and footer snippets.
   *
   * @example
   * ```ts
   * const injection = await forja.site.getCodeInjection();
   * // injection.code_injection_head   → "<script>...</script>"
   * // injection.code_injection_footer → "<script>...</script>"
   * ```
   */
  async getCodeInjection(): Promise<CodeInjection> {
    const settings = await this.http.get<Record<string, unknown>>(
      `/sites/${this.siteId}/settings`,
    );
    return {
      code_injection_head: (settings.code_injection_head as string) ?? '',
      code_injection_footer: (settings.code_injection_footer as string) ?? '',
    };
  }
}
