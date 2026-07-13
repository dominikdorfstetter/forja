import { createHttpClient, type HttpClient } from './http.js';
import { AnalyticsResource } from './resources/analytics.js';
import { BlogsResource } from './resources/blogs.js';
import { CollectionsResource } from './resources/collections.js';
import { CvResource } from './resources/cv.js';
import { FormsResource } from './resources/forms.js';
import { LegalResource } from './resources/legal.js';
import { MediaResource } from './resources/media.js';
import { NavigationResource } from './resources/navigation.js';
import { PagesResource } from './resources/pages.js';
import { ProjectsResource } from './resources/projects.js';
import { RedirectsResource } from './resources/redirects.js';
import { SiteResource } from './resources/site.js';
import { SocialResource } from './resources/social.js';
import { StringsResource } from './resources/strings.js';
import { TaxonomyResource } from './resources/taxonomy.js';
import type { ForjaClientConfig, UiStringsResponse } from './types.js';

/**
 * The main entry point for the Forja CMS content SDK.
 *
 * Create an instance with your API credentials and use the resource
 * properties to interact with the Forja content API.
 *
 * @example
 * ```ts
 * import { ForjaClient } from '@forjacms/client';
 *
 * const forja = new ForjaClient({
 *   baseUrl: 'https://cms.example.com/api/v1',
 *   apiKey: 'your-read-api-key',
 *   siteId: 'your-site-uuid',
 * });
 *
 * const blogs = await forja.blogs.listPublished({ page: 1 });
 * const site = await forja.site.get();
 * const locales = await forja.site.listLocales();
 * ```
 */
export class ForjaClient {
  /** Blog posts — published listings, featured, similar, detail by slug/ID. */
  readonly blogs: BlogsResource;
  /** CMS pages — list, fetch by route, sections and localizations. */
  readonly pages: PagesResource;
  /** Navigation menus — menu metadata, tree structure, items. */
  readonly navigation: NavigationResource;
  /** Tags and categories — listing, lookup by slug, content associations, blog counts. */
  readonly taxonomy: TaxonomyResource;
  /** Privacy-first analytics — pageview tracking and reports. */
  readonly analytics: AnalyticsResource;
  /** CV / resume — skills and work/education entries. */
  readonly cv: CvResource;
  /** Legal documents — privacy policy, cookie consent, terms, version history. */
  readonly legal: LegalResource;
  /** Portfolio projects — published listings, detail, skill/CV associations. */
  readonly projects: ProjectsResource;
  /** URL redirects — path-based lookup for SSR middleware. */
  readonly redirects: RedirectsResource;
  /** Site configuration — name, slug, logo, timezone, locales. */
  readonly site: SiteResource;
  /** Media assets — browse, search, filter by type, full detail with variants. */
  readonly media: MediaResource;
  /** Social media links — GitHub, Twitter, LinkedIn, etc. */
  readonly social: SocialResource;
  /** Forms module — public form rendering, submission, and self-service. */
  readonly forms: FormsResource;

  /** Shared HTTP client + site id, retained so {@link collections} can build
   * a per-type resource on demand. */
  private readonly http: HttpClient;
  private readonly siteId: string;

  /**
   * @param config - API connection settings.
   * @param config.baseUrl - Full URL to the Forja API (e.g. `https://cms.example.com/api/v1`).
   * @param config.apiKey - API key with at least `Read` permission.
   * @param config.siteId - UUID of the site to query.
   * @param config.fetch - Optional custom `fetch` implementation for edge runtimes or testing.
   */
  constructor(config: ForjaClientConfig) {
    const http = createHttpClient(config);
    this.http = http;
    this.siteId = config.siteId;
    this.blogs = new BlogsResource(http, config.siteId);
    this.pages = new PagesResource(http, config.siteId);
    this.navigation = new NavigationResource(http, config.siteId);
    this.taxonomy = new TaxonomyResource(http, config.siteId);
    this.analytics = new AnalyticsResource(http, config.siteId);
    this.cv = new CvResource(http, config.siteId);
    this.legal = new LegalResource(http, config.siteId);
    this.projects = new ProjectsResource(http, config.siteId);
    this.redirects = new RedirectsResource(http, config.siteId);
    this.site = new SiteResource(http, config.siteId);
    this.media = new MediaResource(http, config.siteId);
    this.social = new SocialResource(http, config.siteId);
    this.forms = new FormsResource(http);
  }

  /**
   * Read operations for a custom type ("Collection"), by its key. One generic
   * resource serves every type — no per-type codegen.
   *
   * @example
   * ```ts
   * const recipes = await forja.collections('recipe').published({ page: 1 });
   * const one = await forja.collections('recipe').bySlug('spaghetti');
   * const schema = await forja.collections('recipe').schema();
   * ```
   */
  collections(typeKey: string): CollectionsResource {
    return new CollectionsResource(this.http, this.siteId, typeKey);
  }

  /**
   * Resolved UI strings for one locale as a flat `key → value` map — the
   * site-scoped dictionary for interface chrome (labels, headings, aria
   * texts). The locale code is required; the server resolves one value per
   * key via its fallback chain and omits keys without any localization.
   *
   * @example
   * ```ts
   * const strings = await forja.strings('de');
   * console.log(strings['footer.built_with']);
   * ```
   */
  strings(locale: string): Promise<UiStringsResponse> {
    return new StringsResource(this.http, this.siteId).get(locale);
  }
}
