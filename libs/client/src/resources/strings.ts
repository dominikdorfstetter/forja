import type { HttpClient } from '../http.js';
import type { UiStringsResponse } from '../types.js';

/**
 * UI string operations.
 *
 * Provides the site-scoped key → string dictionary used for interface
 * chrome (labels, headings, aria texts). Obtain the resolved map via
 * {@link ForjaClient.strings | `forja.strings(locale)`}.
 *
 * All operations require an API key with `Read` permission.
 */
export class StringsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
  ) {}

  /**
   * Fetch the resolved UI strings for one locale as a flat `key → value` map.
   *
   * **Endpoint:** `GET /sites/{siteId}/strings?locale={code}`
   *
   * The server resolves one value per key via its fallback chain
   * (exact locale → site default → first localization matching the code);
   * keys without any localization are omitted. Unknown locale codes fall
   * back silently. The `locale` parameter is required — the API responds
   * with `400 ERR_STRINGS_LOCALE_REQUIRED` without it.
   *
   * @param locale - Locale code to resolve values for (e.g. `"en"`, `"de-AT"`).
   * @returns Flat map of key → resolved value.
   *
   * @example
   * ```ts
   * const strings = await forja.strings('de');
   * const label = strings['blog.min_read'] ?? 'min read';
   * ```
   */
  async get(locale: string): Promise<UiStringsResponse> {
    return this.http.get<UiStringsResponse>(`/sites/${this.siteId}/strings`, {
      locale,
    });
  }
}
