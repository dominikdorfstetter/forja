/**
 * Central TanStack Query key factory (issue #18).
 *
 * Every query key in the admin app is created here — inline `queryKey: [...]`
 * arrays are forbidden by lint. The factory guarantees that multi-site
 * resources always embed their `siteId`, so a mutation on site A can never
 * invalidate site B's cache.
 *
 * Conventions:
 * - Key string prefixes are frozen: they must match the historical inline
 *   keys verbatim so cached behavior is unchanged.
 * - SITE-SCOPED methods take `siteId` first; trailing variadic `filters`
 *   carry pagination/search/sort. Invalidate with the base call
 *   (e.g. `queryKeys.blogs(siteId)`) — TanStack matches by key prefix.
 * - ENTITY-SCOPED methods are keyed by a UUID of a parent entity that is
 *   itself site-scoped (form, page, menu, document, ...). Optional ids allow
 *   prefix invalidation of all variants where the historical code did so.
 * - GLOBAL methods are genuinely cross-site resources and take no scope.
 *
 * `siteId`/ids accept `undefined` because callers key disabled queries with
 * a not-yet-loaded id (`enabled: !!id`), mirroring the historical inline keys.
 */

type SiteId = string | null | undefined;
type Id = string | null | undefined;
type Filters = readonly unknown[];

export const queryKeys = {
  // ── GLOBAL — genuinely cross-site resources ────────────────────────────────
  sites: () => ['sites'] as const,
  sitesDeleted: () => ['sites', 'deleted'] as const,
  sitesOverview: () => ['sites-overview'] as const,
  systemStorageOverview: () => ['system-storage-overview'] as const,
  locales: () => ['locales'] as const,
  localesAll: () => ['locales', 'all'] as const,
  profile: () => ['profile'] as const,
  userPreferences: () => ['userPreferences'] as const,
  helpState: () => ['helpState'] as const,
  auth: () => ['auth'] as const,
  health: () => ['health'] as const,
  imprint: () => ['imprint'] as const,
  onboarding: () => ['onboarding'] as const,
  globalCache: () => ['global-cache'] as const,
  /** Display-name lookup for all Clerk users (legacy 'clerkUsers' key). */
  clerkUserNames: () => ['clerkUsers'] as const,
  clerkUsers: (...filters: Filters) => ['clerk-users', ...filters] as const,
  apiKeys: (...filters: Filters) => ['apiKeys', ...filters] as const,

  // ── SITE-SCOPED — always pass the siteId, even for invalidation ───────────
  site: (siteId: SiteId) => ['site', siteId] as const,
  siteMembers: (siteId: SiteId) => ['site', siteId, 'members'] as const,
  siteStorage: (siteId: SiteId) => ['site', siteId, 'storage'] as const,
  siteDetailSettings: (siteId: SiteId) => ['site', siteId, 'settings'] as const,
  siteSettings: (siteId: SiteId) => ['site-settings', siteId] as const,
  siteContext: (siteId: SiteId) => ['siteContext', siteId] as const,
  siteLocales: (siteId: SiteId) => ['site-locales', siteId] as const,
  /** Dashboard locale summary (legacy 'siteLocales' key, distinct cache). */
  siteLocalesOverview: (siteId: SiteId) => ['siteLocales', siteId] as const,
  siteCache: (siteId: SiteId) => ['site-cache', siteId] as const,
  siteTags: (siteId: SiteId) => ['site-tags', siteId] as const,
  siteExport: (siteId: SiteId, jobId?: unknown) => ['site-export', siteId, jobId] as const,
  storageUsage: (siteId: SiteId) => ['storage-usage', siteId] as const,
  favicon: (siteId: SiteId) => ['favicon', siteId] as const,
  members: (siteId: SiteId) => ['members', siteId] as const,
  notifications: (siteId: SiteId, ...filters: Filters) =>
    ['notifications', siteId, ...filters] as const,
  notificationsUnread: (siteId: SiteId) => ['notifications-unread', siteId] as const,
  notificationsStatusCounts: (siteId: SiteId) => ['notifications-status-counts', siteId] as const,
  blogs: (siteId: SiteId, ...filters: Filters) => ['blogs', siteId, ...filters] as const,
  blogsStatusCounts: (siteId: SiteId) => ['blogs-status-counts', siteId] as const,
  blogsPicker: (siteId: SiteId, ...filters: Filters) =>
    ['blogs-picker', siteId, ...filters] as const,
  dashboardBlogs: (siteId: SiteId) => ['dashboard-blogs', siteId] as const,
  dashboardPages: (siteId: SiteId) => ['dashboard-pages', siteId] as const,
  pages: (siteId: SiteId, ...filters: Filters) => ['pages', siteId, ...filters] as const,
  pagesStatusCounts: (siteId: SiteId) => ['pages-status-counts', siteId] as const,
  pagesPicker: (siteId: SiteId, ...filters: Filters) =>
    ['pages-picker', siteId, ...filters] as const,
  pagesForNav: (siteId: SiteId) => ['pages-for-nav', siteId] as const,
  legal: (siteId: SiteId, ...filters: Filters) => ['legal', siteId, ...filters] as const,
  legalPicker: (siteId: SiteId, ...filters: Filters) =>
    ['legal-picker', siteId, ...filters] as const,
  legalCookieConsent: (siteId: SiteId) => ['legal-cookie-consent', siteId] as const,
  documents: (siteId: SiteId, ...filters: Filters) => ['documents', siteId, ...filters] as const,
  documentFolders: (siteId: SiteId) => ['document-folders', siteId] as const,
  media: (siteId: SiteId, ...filters: Filters) => ['media', siteId, ...filters] as const,
  mediaFolders: (siteId: SiteId) => ['media-folders', siteId] as const,
  mediaCategoryCounts: (siteId: SiteId) => ['media-category-counts', siteId] as const,
  mediaPicker: (siteId: SiteId) => ['media-picker', siteId] as const,
  forms: (siteId: SiteId, ...filters: Filters) => ['forms', siteId, ...filters] as const,
  formTemplates: (siteId: SiteId) => ['form-templates', siteId] as const,
  tags: (siteId: SiteId, ...filters: Filters) => ['tags', siteId, ...filters] as const,
  categories: (siteId: SiteId, ...filters: Filters) => ['categories', siteId, ...filters] as const,
  projects: (siteId: SiteId, ...filters: Filters) => ['projects', siteId, ...filters] as const,
  cvEntries: (siteId: SiteId, ...filters: Filters) => ['cv-entries', siteId, ...filters] as const,
  skills: (siteId: SiteId, ...filters: Filters) => ['skills', siteId, ...filters] as const,
  trash: (siteId: SiteId, ...filters: Filters) => ['trash', siteId, ...filters] as const,
  trashCount: (siteId: SiteId) => ['trash-count', siteId] as const,
  socialLinks: (siteId: SiteId) => ['social-links', siteId] as const,
  navigationMenus: (siteId: SiteId) => ['navigation-menus', siteId] as const,
  /** Dashboard menu summary (legacy 'navigationMenus' key, distinct cache). */
  navigationMenusOverview: (siteId: SiteId) => ['navigationMenus', siteId] as const,
  webhooks: (siteId: SiteId, ...filters: Filters) => ['webhooks', siteId, ...filters] as const,
  redirects: (siteId: SiteId, ...filters: Filters) => ['redirects', siteId, ...filters] as const,
  contentTemplates: (siteId: SiteId, ...filters: Filters) =>
    ['content-templates', siteId, ...filters] as const,
  onboardingProgress: (siteId: SiteId) => ['onboardingProgress', siteId] as const,
  aiConfig: (siteId: SiteId) => ['ai-config', siteId] as const,
  aiUsage: (siteId: SiteId, ...filters: Filters) => ['ai-usage', siteId, ...filters] as const,
  auditAiUsage: (siteId: SiteId) => ['audit-ai-usage', siteId] as const,
  auditLogs: (siteId: SiteId, ...filters: Filters) => ['audit-logs', siteId, ...filters] as const,
  analyticsReport: (siteId: SiteId, ...filters: Filters) =>
    ['analytics-report', siteId, ...filters] as const,
  analyticsPageDetail: (siteId: SiteId, ...filters: Filters) =>
    ['analytics-page-detail', siteId, ...filters] as const,
  cmdSearchBlogs: (siteId: SiteId, query: unknown) => ['cmd-search-blogs', siteId, query] as const,
  cmdSearchPages: (siteId: SiteId, query: unknown) => ['cmd-search-pages', siteId, query] as const,
  cmdSearchMedia: (siteId: SiteId, query: unknown) => ['cmd-search-media', siteId, query] as const,
  ropa: (siteId: SiteId) => ['ropa', siteId] as const,
  customTypes: (siteId: SiteId) => ['custom-types', siteId] as const,
  customType: (siteId: SiteId, key: Id) => ['custom-type', siteId, key] as const,
  customEntries: (siteId: SiteId, key: Id, ...filters: Filters) =>
    ['custom-entries', siteId, key, ...filters] as const,
  customEntry: (siteId: SiteId, key: Id, entryId: Id) =>
    ['custom-entry', siteId, key, entryId] as const,
  /**
   * Site-scoped root for generic entity-list pages (EntityListPage adapters).
   * `root` is the adapter's queryKeyRoot; reads are `[root, siteId, ...params]`,
   * so `[root, siteId]` is the correct scoped invalidation prefix.
   */
  entityList: (root: string, siteId: SiteId) => [root, siteId] as const,
  /** Inert placeholder key for adapters without status counts. */
  entityListNoCounts: (entityKey: string) => [`__no-counts-${entityKey}`] as const,

  // ── ENTITY-SCOPED — keyed by the UUID of a (site-scoped) parent entity ────
  clerkUser: (userId: Id) => ['clerk-user', userId] as const,
  userAudit: (userId: Id, ...filters: Filters) => ['user-audit', userId, ...filters] as const,
  form: (formId: Id) => ['form', formId] as const,
  submissions: (formId: Id, ...filters: Filters) => ['submissions', formId, ...filters] as const,
  submission: (submissionId: Id) => ['submission', submissionId] as const,
  submissionStatusCounts: (formId: Id) => ['submission-status-counts', formId] as const,
  apiKeyUsageSummary: (keyId: Id, ...filters: Filters) =>
    ['apiKeyUsageSummary', keyId, ...filters] as const,
  blogDetail: (blogId?: Id) =>
    blogId === undefined ? (['blog-detail'] as const) : (['blog-detail', blogId] as const),
  legalDetail: (documentId: Id) => ['legal-detail', documentId] as const,
  pageWithLocalizations: (pageId: Id) => ['page-with-localizations', pageId] as const,
  page: (pageId: Id) => ['page', pageId] as const,
  pageSections: (pageId: Id) => ['page-sections', pageId] as const,
  pageLocalizations: (pageId: Id) => ['page-localizations', pageId] as const,
  pageSectionLocalizations: (pageId?: Id) =>
    pageId === undefined
      ? (['page-section-localizations'] as const)
      : (['page-section-localizations', pageId] as const),
  sectionLocalizations: (sectionId: Id) => ['section-localizations', sectionId] as const,
  navigationItems: (menuId?: Id) =>
    menuId === undefined ? (['navigation-items'] as const) : (['navigation-items', menuId] as const),
  navigationLocalizations: (itemId: Id) => ['navigation-localizations', itemId] as const,
  legalItems: (groupId: Id) => ['legalItems', groupId] as const,
  legalGroups: (documentId: Id) => ['legalGroups', documentId] as const,
  legalVersions: (documentId: Id) => ['legal-versions', documentId] as const,
  documentDetails: (documentIds?: unknown) =>
    documentIds === undefined
      ? (['document-details'] as const)
      : (['document-details', documentIds] as const),
  /** Blob URL for a single media item (legacy `['media', mediaId]` key). */
  mediaUrl: (mediaId: Id) => ['media', mediaId] as const,
  mediaDetail: (mediaId: Id) => ['media-detail', mediaId] as const,
  mediaMetadata: (mediaId: Id) => ['media-metadata', mediaId] as const,
  mediaTags: (mediaId: Id) => ['media-tags', mediaId] as const,
  mediaUsage: (mediaId: Id) => ['media-usage', mediaId] as const,
  projectDetail: (projectId: Id) => ['project-detail', projectId] as const,
  cvEntryDetail: (entryId: Id) => ['cv-entry-detail', entryId] as const,
  webhookStats: (webhookId: Id, ...filters: Filters) =>
    ['webhook-stats', webhookId, ...filters] as const,
  webhookDeliveries: (webhookId: Id, ...filters: Filters) =>
    ['webhook-deliveries', webhookId, ...filters] as const,
  entityHistory: (entityType: string, entityId: Id) =>
    ['entity-history', entityType, entityId] as const,
  entityAudit: (entityType: string, entityId: Id) =>
    ['entity-audit', entityType, entityId] as const,
};
