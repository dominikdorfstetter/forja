export { ForjaClient } from './client.js';
export { renderCodeInjection } from './code-injection.js';
export { validateSubmission } from './resources/forms.js';
export { CollectionsResource } from './resources/collections.js';
export { StringsResource } from './resources/strings.js';
export type {
  PublicCollectionEntry,
  PublicCollectionField,
  PublicCollectionSchema,
  PublicCollectionListParams,
} from './resources/collections.js';
export type {
  FormFieldType,
  FormBotProtection,
  FormFieldValidation,
  FormFieldDefinition,
  PublicFormDefinition,
  FormSubmitData,
  FormSubmitResponse,
  SubmitFormOptions,
  SelfServiceLookup,
  SelfServiceSubmission,
  ValidationErrorMap,
} from './resources/forms.js';

export {
  ForjaError,
  ForjaAuthError,
  ForjaPermissionError,
  ForjaNotFoundError,
  ForjaRateLimitError,
  ForjaValidationError,
  ForjaServerError,
  ForjaNetworkError,
} from './errors.js';

export type {
  // Config
  ForjaClientConfig,
  // Pagination
  PaginationMeta,
  Paginated,
  PaginationParams,
  LocaleFilterParams,
  SearchablePaginationParams,
  // Enums
  ContentStatus,
  TranslationStatus,
  PageType,
  SectionType,
  CvEntryType,
  SkillCategory,
  LegalDocType,
  ProjectLinkType,
  // Content
  LocalizationResponse,
  BlogListItem,
  BlogResponse,
  BlogDetailResponse,
  BlogDocumentResponse,
  DocumentLocalizationResponse,
  // Pages
  PageListItem,
  PageResponse,
  PageDetailResponse,
  PageSectionResponse,
  SectionLocalizationResponse,
  // Navigation
  NavigationMenuResponse,
  MenuLocalizationResponse,
  NavigationItemResponse,
  NavigationTree,
  NavigationItemLocalizationResponse,
  ResolvedNavigationMenu,
  MenuWithTree,
  // Taxonomy
  TagResponse,
  CategoryResponse,
  CategoryTree,
  CategoryWithCountResponse,
  // Analytics
  TopContentItem,
  TrendDataPoint,
  AnalyticsReportResponse,
  ReferrerItem,
  AnalyticsPageDetailResponse,
  TrackPageviewRequest,
  TrackPageviewResponse,
  AnalyticsReportParams,
  AnalyticsPageParams,
  // CV / Portfolio
  SkillResponse,
  CvEntryResponse,
  CvEntryParams,
  // Projects
  ProjectResponse,
  ProjectDetailResponse,
  ProjectLocalizationResponse,
  ProjectLinkResponse,
  ProjectMediaResponse,
  ProjectListParams,
  // Legal
  LegalDocumentResponse,
  LegalDocLocalizationResponse,
  LegalDocumentDetailResponse,
  LegalDocumentFullDetailResponse,
  LegalVersionResponse,
  LegalGroupResponse,
  LegalItemResponse,
  LegalGroupWithItems,
  LegalDocumentWithGroups,
  // Redirects
  RedirectResponse,
  RedirectLookupResponse,
  // Code injection
  CodeInjection,
  // Site
  SiteResponse,
  SiteLocaleResponse,
  SiteContextResponse,
  SiteContextIntegration,
  PublicSiteSettings,
  // Media
  MediaResponse,
  MediaVariantResponse,
  MediaListItem,
  MediaListParams,
  // Social
  SocialLinkResponse,
  // UI strings
  UiStringsResponse,
} from './types.js';

export type { HttpClient, PaginatedResult } from './http.js';
