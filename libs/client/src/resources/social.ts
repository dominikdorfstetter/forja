import type { HttpClient } from '../http.js';
import type { SocialLinkResponse } from '../types.js';

/**
 * Social media link operations.
 *
 * Provides access to the site's configured social media links
 * (GitHub, Twitter/X, LinkedIn, etc.) for rendering in headers, footers,
 * and about pages.
 *
 * Requires an API key with `Read` permission.
 */
export class SocialResource {
  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
  ) {}

  /**
   * Fetch all social media links for the site.
   *
   * **Endpoint:** `GET /sites/{siteId}/social`
   *
   * Returns links sorted by `display_order`. Each link includes a title,
   * URL, icon identifier, and optional alt text for accessibility.
   *
   * @returns Array of social links.
   *
   * @example
   * ```ts
   * const links = await forja.social.list();
   * links.forEach(link => {
   *   console.log(`${link.title}: ${link.url} (icon: ${link.icon})`);
   * });
   * ```
   */
  async list(): Promise<SocialLinkResponse[]> {
    return this.http.get<SocialLinkResponse[]>(
      `/sites/${this.siteId}/social`,
    );
  }
}
