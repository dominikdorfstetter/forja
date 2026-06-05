import type { HttpClient } from '../http.js';
import type { RedirectLookupResponse } from '../types.js';

/**
 * URL redirect operations.
 *
 * Provides server-side redirect lookup for SSR frameworks. When a request
 * arrives at a path that has a redirect configured, use {@link lookup} to
 * check if the path should be redirected and to which destination.
 *
 * Requires an API key with `Read` permission.
 */
export class RedirectsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly siteId: string,
  ) {}

  /**
   * Look up a redirect for a given request path.
   *
   * **Endpoint:** `GET /sites/{siteId}/redirects/lookup?path=`
   *
   * Checks if the site has an active redirect configured for the given path.
   * Returns the destination URL and HTTP status code (301 permanent, 302 temporary,
   * 307 temporary preserve method, 308 permanent preserve method).
   *
   * Use this in SSR middleware to handle redirects before rendering the page.
   *
   * @param path - The request path to check (e.g. `"/old-blog-post"`, `"/legacy/page"`).
   * @returns The redirect destination and status code, or `null` if no redirect exists for this path.
   *
   * @example
   * ```ts
   * // In Astro middleware or Next.js middleware:
   * const redirect = await forja.redirects.lookup('/old-url');
   * if (redirect) {
   *   return Response.redirect(redirect.destination_path, redirect.status_code);
   * }
   * ```
   *
   * @example
   * ```ts
   * // In Express:
   * app.use(async (req, res, next) => {
   *   const redirect = await forja.redirects.lookup(req.path);
   *   if (redirect) {
   *     return res.redirect(redirect.status_code, redirect.destination_path);
   *   }
   *   next();
   * });
   * ```
   */
  async lookup(path: string): Promise<RedirectLookupResponse | null> {
    return this.http.getOrNull<RedirectLookupResponse>(
      `/sites/${this.siteId}/redirects/lookup`,
      { path },
    );
  }
}
