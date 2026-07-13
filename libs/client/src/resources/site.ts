import type { HttpClient } from '../http.js';
import type {
  CodeInjection,
  PublicSiteSettings,
  SiteContextResponse,
  SiteLocaleResponse,
  SiteResponse,
} from '../types.js';

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
   * Fetch the curated public subset of the site's settings.
   *
   * **Endpoint:** `GET /sites/{siteId}/settings/public`
   *
   * Returns the contact email, web-manifest colors, and SEO defaults.
   * Works with an API key that has `Read` permission — unlike the raw
   * settings endpoint, which is Admin-only.
   *
   * The shape deliberately excludes operational configuration (allowed
   * origins, storage quotas, data retention, module flags, code
   * injection); use {@link getCodeInjection} for injection snippets.
   *
   * Fields that are not configured on the server fall back to the same
   * defaults the backend uses everywhere (empty strings for email and
   * description, `#ffffff` colors, `{{title}} | {{site_name}}`).
   *
   * @returns The public site settings.
   *
   * @example
   * ```ts
   * const settings = await forja.site.getSettings();
   * console.log(settings.contact_email);       // "hello@example.com"
   * console.log(settings.theme_color);         // "#4a90d9"
   * console.log(settings.seo_title_template);  // "{{title}} | {{site_name}}"
   * ```
   */
  async getSettings(): Promise<PublicSiteSettings> {
    return this.http.get<PublicSiteSettings>(
      `/sites/${this.siteId}/settings/public`,
    );
  }

  /**
   * Get code injection scripts configured for this site.
   *
   * **Endpoint:** `GET /sites/{siteId}/context`
   *
   * Returns the custom HTML/JS snippets configured for injection into
   * the site's `<head>` and footer, read from the site context's
   * integration payload. Use these to embed analytics tags, chat
   * widgets, or any custom scripts into your template.
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
    const context = await this.http.get<SiteContextResponse>(
      `/sites/${this.siteId}/context`,
    );
    return {
      code_injection_head: context.integration?.code_injection_head ?? '',
      code_injection_footer: context.integration?.code_injection_footer ?? '',
    };
  }
}
