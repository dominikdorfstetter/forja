import axios, { AxiosRequestConfig } from 'axios';
import type {
  AuthInfo,
  ProfileResponse,
  UserDataExportResponse,
  Site,
  ApiKeyListItem,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  CreateSiteRequest,
  UpdateSiteRequest,
  ApiKeyUsageRecord,
  Environment,
  Locale,
  CreateLocaleRequest,
  UpdateLocaleRequest,
  BlogListItem,
  BlogDetailResponse,
  ContentLocalizationResponse,
  CreateLocalizationRequest,
  UpdateLocalizationRequest,
  MediaListItem,
  Tag,
  Category,
  CreateTagRequest,
  UpdateTagRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  AssignCategoryRequest,
  CategoryWithCount,
  Paginated,
  SocialLink,
  CreateSocialLinkRequest,
  UpdateSocialLinkRequest,
  ReorderItem,
  NavigationMenu,
  CreateNavigationMenuRequest,
  UpdateNavigationMenuRequest,
  NavigationItem,
  CreateNavigationItemRequest,
  UpdateNavigationItemRequest,
  NavigationItemLocalizationInput,
  NavigationItemLocalizationResponse,
  NavigationTreeNode,
  ReorderTreeItem,
  BlogResponse,
  CreateBlogRequest,
  UpdateBlogRequest,
  UploadMediaRequest,
  UpdateMediaRequest,
  MediaResponse,
  PageListItem,
  PageResponse,
  CreatePageRequest,
  UpdatePageRequest,
  PageSectionResponse,
  CreatePageSectionRequest,
  UpdatePageSectionRequest,
  SectionLocalizationResponse,
  UpsertSectionLocalizationRequest,
  LegalDocumentResponse,
  CreateLegalDocumentRequest,
  UpdateLegalDocumentRequest,
  LegalGroupResponse,
  CreateLegalGroupRequest,
  UpdateLegalGroupRequest,
  LegalItemResponse,
  CreateLegalItemRequest,
  UpdateLegalItemRequest,
  SkillResponse,
  CreateSkillRequest,
  UpdateSkillRequest,
  CvEntryResponse,
  CreateCvEntryRequest,
  UpdateCvEntryRequest,
  HealthResponse,
  DocumentFolder,
  CreateDocumentFolderRequest,
  UpdateDocumentFolderRequest,
  DocumentListItem,
  DocumentResponse,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  DocumentLocalizationResponse,
  CreateDocumentLocalizationRequest,
  UpdateDocumentLocalizationRequest,
  BlogDocumentResponse,
  AssignBlogDocumentRequest,
  MediaFolder,
  CreateMediaFolderRequest,
  UpdateMediaFolderRequest,
  MediaMetadataResponse,
  AddMediaMetadataRequest,
  UpdateMediaMetadataRequest,
  SiteSettingsResponse,
  UpdateSiteSettingsRequest,
  ClerkUser,
  ClerkUserListResponse,
  SiteLocaleResponse,
  AddSiteLocaleRequest,
  UpdateSiteLocaleRequest,
  SiteMembership,
  AddSiteMemberRequest,
  UpdateMemberRoleRequest,
  TransferOwnershipRequest,
  MembershipSummary,
  AuditLogEntry,
  ChangeHistoryEntry,
  RevertChangesResponse,
  Webhook,
  WebhookDelivery,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  ReviewActionRequest,
  ReviewActionResponse,
  NotificationResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
  Redirect,
  CreateRedirectRequest,
  UpdateRedirectRequest,
  ContentTemplate,
  CreateContentTemplateRequest,
  UpdateContentTemplateRequest,
  BulkContentRequest,
  BulkContentResponse,
} from '@/types/api';

const API_BASE_URL = '/api/v1';

// Type for Clerk's getToken function
type ClerkTokenGetter = ((options?: { template?: string }) => Promise<string | null>) | null;

// Module-level reference to the Clerk token getter
let clerkTokenGetter: ClerkTokenGetter = null;

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests to add auth header (Clerk Bearer token or API key fallback)
apiClient.interceptors.request.use(async (config) => {
  // Try Clerk JWT first
  if (clerkTokenGetter) {
    try {
      const token = await clerkTokenGetter();
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
      }
    } catch {
      // Fall through to API key
    }
  }

  // Fallback to API key from localStorage (for backward compatibility)
  const apiKey = localStorage.getItem('api_key');
  if (apiKey && config.headers) {
    config.headers['X-API-Key'] = apiKey;
  }

  return config;
});

// Intercept responses to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't force redirect on 401 — Clerk handles session expiry
    return Promise.reject(error);
  }
);

// Generic API request — backend returns T directly (no wrapper)
async function apiRequest<T>(
  method: string,
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  try {
    const response = await apiClient.request<T>({
      method,
      url,
      data,
      ...config,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      throw error.response.data;
    }
    throw error;
  }
}

export class ApiService {
  // Clerk token getter management
  setClerkTokenGetter(getter: ClerkTokenGetter): void {
    clerkTokenGetter = getter;
  }

  // Authentication
  async getAuthMe(): Promise<AuthInfo> {
    return apiRequest<AuthInfo>('GET', '/auth/me');
  }

  // Profile & Data Export
  async getProfile(): Promise<ProfileResponse> {
    return apiRequest<ProfileResponse>('GET', '/auth/profile');
  }

  async exportUserData(): Promise<UserDataExportResponse> {
    return apiRequest<UserDataExportResponse>('GET', '/auth/export');
  }

  async deleteAccount(): Promise<void> {
    return apiRequest<void>('DELETE', '/auth/account');
  }

  // Health (mounted at root, not under /api/v1)
  async getHealth(): Promise<HealthResponse> {
    const response = await axios.get<HealthResponse>('/health');
    return response.data;
  }

  // Sites
  async getSites(): Promise<Site[]> {
    return apiRequest<Site[]>('GET', '/sites');
  }

  async getSite(id: string): Promise<Site> {
    return apiRequest<Site>('GET', `/sites/${id}`);
  }

  async createSite(data: CreateSiteRequest): Promise<Site> {
    return apiRequest<Site>('POST', '/sites', data);
  }

  async updateSite(id: string, data: UpdateSiteRequest): Promise<Site> {
    return apiRequest<Site>('PUT', `/sites/${id}`, data);
  }

  async deleteSite(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/sites/${id}`);
  }

  // API Keys
  async getApiKeys(params?: {
    status?: string;
    permission?: string;
    site_id?: string;
    page?: number;
    per_page?: number;
  }): Promise<Paginated<ApiKeyListItem>> {
    return apiRequest<Paginated<ApiKeyListItem>>('GET', '/api-keys', undefined, { params });
  }

  async getApiKey(id: string): Promise<ApiKey> {
    return apiRequest<ApiKey>('GET', `/api-keys/${id}`);
  }

  async createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    return apiRequest<CreateApiKeyResponse>('POST', '/api-keys', data);
  }

  async updateApiKey(id: string, data: Partial<CreateApiKeyRequest>): Promise<ApiKey> {
    return apiRequest<ApiKey>('PUT', `/api-keys/${id}`, data);
  }

  async deleteApiKey(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/api-keys/${id}`);
  }

  async blockApiKey(id: string, reason: string): Promise<ApiKey> {
    return apiRequest<ApiKey>('POST', `/api-keys/${id}/block`, { reason });
  }

  async unblockApiKey(id: string): Promise<ApiKey> {
    return apiRequest<ApiKey>('POST', `/api-keys/${id}/unblock`);
  }

  async revokeApiKey(id: string): Promise<ApiKey> {
    return apiRequest<ApiKey>('POST', `/api-keys/${id}/revoke`);
  }

  async getApiKeyUsage(id: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiKeyUsageRecord[]> {
    return apiRequest<ApiKeyUsageRecord[]>('GET', `/api-keys/${id}/usage`, undefined, { params });
  }

  // Environments
  async getEnvironments(): Promise<Environment[]> {
    return apiRequest<Environment[]>('GET', '/environments');
  }

  // Locales
  async getLocales(includeInactive?: boolean): Promise<Locale[]> {
    const params = includeInactive ? { include_inactive: true } : undefined;
    return apiRequest<Locale[]>('GET', '/locales', undefined, { params });
  }

  async createLocale(data: CreateLocaleRequest): Promise<Locale> {
    return apiRequest<Locale>('POST', '/locales', data);
  }

  async updateLocale(id: string, data: UpdateLocaleRequest): Promise<Locale> {
    return apiRequest<Locale>('PUT', `/locales/${id}`, data);
  }

  async deleteLocale(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/locales/${id}`);
  }

  // Blogs (paginated)
  async getBlogs(siteId: string, params?: {
    page?: number;
    per_page?: number;
  }): Promise<Paginated<BlogListItem>> {
    return apiRequest<Paginated<BlogListItem>>('GET', `/sites/${siteId}/blogs`, undefined, { params });
  }

  // Media (paginated, with optional search & filters)
  async getMedia(siteId: string, params?: {
    page?: number;
    per_page?: number;
    search?: string;
    mime_category?: string;
    folder_id?: string;
  }): Promise<Paginated<MediaListItem>> {
    return apiRequest<Paginated<MediaListItem>>('GET', `/sites/${siteId}/media`, undefined, { params });
  }

  // Blog Localizations
  async getBlogDetail(id: string): Promise<BlogDetailResponse> {
    return apiRequest<BlogDetailResponse>('GET', `/blogs/${id}/detail`);
  }

  async getBlogLocalizations(id: string): Promise<ContentLocalizationResponse[]> {
    return apiRequest<ContentLocalizationResponse[]>('GET', `/blogs/${id}/localizations`);
  }

  async createBlogLocalization(blogId: string, data: CreateLocalizationRequest): Promise<ContentLocalizationResponse> {
    return apiRequest<ContentLocalizationResponse>('POST', `/blogs/${blogId}/localizations`, data);
  }

  async updateBlogLocalization(locId: string, data: UpdateLocalizationRequest): Promise<ContentLocalizationResponse> {
    return apiRequest<ContentLocalizationResponse>('PUT', `/blogs/localizations/${locId}`, data);
  }

  async deleteBlogLocalization(locId: string): Promise<void> {
    return apiRequest<void>('DELETE', `/blogs/localizations/${locId}`);
  }

  // Taxonomy
  async getTags(siteId: string, params?: { page?: number; per_page?: number }): Promise<Paginated<Tag>> {
    return apiRequest<Paginated<Tag>>('GET', `/sites/${siteId}/tags`, undefined, { params });
  }

  async getCategories(siteId: string, params?: { page?: number; per_page?: number }): Promise<Paginated<Category>> {
    return apiRequest<Paginated<Category>>('GET', `/sites/${siteId}/categories`, undefined, { params });
  }

  async createTag(data: CreateTagRequest): Promise<Tag> {
    return apiRequest<Tag>('POST', '/tags', data);
  }

  async updateTag(id: string, data: UpdateTagRequest): Promise<Tag> {
    return apiRequest<Tag>('PUT', `/tags/${id}`, data);
  }

  async deleteTag(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/tags/${id}`);
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    return apiRequest<Category>('POST', '/categories', data);
  }

  async updateCategory(id: string, data: UpdateCategoryRequest): Promise<Category> {
    return apiRequest<Category>('PUT', `/categories/${id}`, data);
  }

  async deleteCategory(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/categories/${id}`);
  }

  async assignCategoryToContent(contentId: string, data: AssignCategoryRequest): Promise<void> {
    return apiRequest<void>('POST', `/content/${contentId}/categories`, data);
  }

  async removeCategoryFromContent(contentId: string, categoryId: string): Promise<void> {
    return apiRequest<void>('DELETE', `/content/${contentId}/categories/${categoryId}`);
  }

  async getCategoriesWithBlogCount(siteId: string): Promise<CategoryWithCount[]> {
    return apiRequest<CategoryWithCount[]>('GET', `/sites/${siteId}/categories/blog-counts`);
  }

  // Social Links
  async getSocialLinks(siteId: string): Promise<SocialLink[]> {
    return apiRequest<SocialLink[]>('GET', `/sites/${siteId}/social`);
  }

  async createSocialLink(siteId: string, data: CreateSocialLinkRequest): Promise<SocialLink> {
    return apiRequest<SocialLink>('POST', `/sites/${siteId}/social`, data);
  }

  async updateSocialLink(id: string, data: UpdateSocialLinkRequest): Promise<SocialLink> {
    return apiRequest<SocialLink>('PUT', `/social/${id}`, data);
  }

  async deleteSocialLink(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/social/${id}`);
  }

  async reorderSocialLinks(siteId: string, items: ReorderItem[]): Promise<void> {
    return apiRequest<void>('POST', `/sites/${siteId}/social/reorder`, { items });
  }

  // Navigation Menus
  async getNavigationMenus(siteId: string): Promise<NavigationMenu[]> {
    return apiRequest<NavigationMenu[]>('GET', `/sites/${siteId}/menus`);
  }

  async createNavigationMenu(siteId: string, data: CreateNavigationMenuRequest): Promise<NavigationMenu> {
    return apiRequest<NavigationMenu>('POST', `/sites/${siteId}/menus`, data);
  }

  async updateNavigationMenu(id: string, data: UpdateNavigationMenuRequest): Promise<NavigationMenu> {
    return apiRequest<NavigationMenu>('PUT', `/menus/${id}`, data);
  }

  async deleteNavigationMenu(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/menus/${id}`);
  }

  async getNavigationTree(menuId: string, locale?: string): Promise<NavigationTreeNode[]> {
    const params = locale ? `?locale=${locale}` : '';
    return apiRequest<NavigationTreeNode[]>('GET', `/menus/${menuId}/tree${params}`);
  }

  // Navigation Items
  async getNavigationItems(siteId: string): Promise<NavigationItem[]> {
    return apiRequest<NavigationItem[]>('GET', `/sites/${siteId}/navigation`);
  }

  async getMenuItems(menuId: string): Promise<NavigationItem[]> {
    return apiRequest<NavigationItem[]>('GET', `/menus/${menuId}/items`);
  }

  async createNavigationItem(siteId: string, data: CreateNavigationItemRequest): Promise<NavigationItem> {
    return apiRequest<NavigationItem>('POST', `/sites/${siteId}/navigation`, data);
  }

  async createMenuItem(menuId: string, data: CreateNavigationItemRequest): Promise<NavigationItem> {
    return apiRequest<NavigationItem>('POST', `/menus/${menuId}/items`, data);
  }

  async updateNavigationItem(id: string, data: UpdateNavigationItemRequest): Promise<NavigationItem> {
    return apiRequest<NavigationItem>('PUT', `/navigation/${id}`, data);
  }

  async deleteNavigationItem(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/navigation/${id}`);
  }

  async reorderNavigationItems(siteId: string, items: ReorderItem[]): Promise<void> {
    return apiRequest<void>('POST', `/sites/${siteId}/navigation/reorder`, { items });
  }

  async reorderMenuItems(menuId: string, items: ReorderTreeItem[]): Promise<void> {
    return apiRequest<void>('POST', `/menus/${menuId}/items/reorder`, { items });
  }

  async getNavigationItemLocalizations(id: string): Promise<NavigationItemLocalizationResponse[]> {
    return apiRequest<NavigationItemLocalizationResponse[]>('GET', `/navigation/${id}/localizations`);
  }

  async upsertNavigationItemLocalizations(id: string, data: NavigationItemLocalizationInput[]): Promise<NavigationItemLocalizationResponse[]> {
    return apiRequest<NavigationItemLocalizationResponse[]>('PUT', `/navigation/${id}/localizations`, data);
  }

  // Blogs (mutations)
  async createBlog(data: CreateBlogRequest): Promise<BlogResponse> {
    return apiRequest<BlogResponse>('POST', '/blogs', data);
  }

  async updateBlog(id: string, data: UpdateBlogRequest): Promise<BlogResponse> {
    return apiRequest<BlogResponse>('PUT', `/blogs/${id}`, data);
  }

  async deleteBlog(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/blogs/${id}`);
  }

  async cloneBlog(id: string): Promise<BlogResponse> {
    return apiRequest<BlogResponse>('POST', `/blogs/${id}/clone`);
  }

  // Media (mutations)
  async uploadMedia(data: UploadMediaRequest): Promise<MediaListItem> {
    return apiRequest<MediaListItem>('POST', '/media', data);
  }

  async uploadMediaFile(
    file: File,
    siteIds: string[],
    folderId?: string,
    isGlobal?: boolean,
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void,
  ): Promise<MediaResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('site_ids', JSON.stringify(siteIds));
    if (folderId) formData.append('folder_id', folderId);
    if (isGlobal) formData.append('is_global', 'true');

    const response = await apiClient.post<MediaResponse>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
    return response.data;
  }

  async updateMedia(id: string, data: UpdateMediaRequest): Promise<MediaListItem> {
    return apiRequest<MediaListItem>('PUT', `/media/${id}`, data);
  }

  async deleteMedia(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/media/${id}`);
  }

  // Pages
  async getPages(siteId: string, params?: { page?: number; per_page?: number }): Promise<Paginated<PageListItem>> {
    return apiRequest<Paginated<PageListItem>>('GET', `/sites/${siteId}/pages`, undefined, { params });
  }

  async getPage(id: string): Promise<PageResponse> {
    return apiRequest<PageResponse>('GET', `/pages/${id}`);
  }

  async createPage(data: CreatePageRequest): Promise<PageResponse> {
    return apiRequest<PageResponse>('POST', '/pages', data);
  }

  async updatePage(id: string, data: UpdatePageRequest): Promise<PageResponse> {
    return apiRequest<PageResponse>('PUT', `/pages/${id}`, data);
  }

  async deletePage(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/pages/${id}`);
  }

  async clonePage(id: string): Promise<PageResponse> {
    return apiRequest<PageResponse>('POST', `/pages/${id}/clone`);
  }

  async getPageSections(pageId: string): Promise<PageSectionResponse[]> {
    return apiRequest<PageSectionResponse[]>('GET', `/pages/${pageId}/sections`);
  }

  async createPageSection(pageId: string, data: CreatePageSectionRequest): Promise<PageSectionResponse> {
    return apiRequest<PageSectionResponse>('POST', `/pages/${pageId}/sections`, data);
  }

  async updatePageSection(id: string, data: UpdatePageSectionRequest): Promise<PageSectionResponse> {
    return apiRequest<PageSectionResponse>('PUT', `/pages/sections/${id}`, data);
  }

  async deletePageSection(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/pages/sections/${id}`);
  }

  // Section Localizations
  async getSectionLocalizations(sectionId: string): Promise<SectionLocalizationResponse[]> {
    return apiRequest<SectionLocalizationResponse[]>('GET', `/pages/sections/${sectionId}/localizations`);
  }

  async getPageSectionLocalizations(pageId: string): Promise<SectionLocalizationResponse[]> {
    return apiRequest<SectionLocalizationResponse[]>('GET', `/pages/${pageId}/sections/localizations`);
  }

  async upsertSectionLocalization(sectionId: string, data: UpsertSectionLocalizationRequest): Promise<SectionLocalizationResponse> {
    return apiRequest<SectionLocalizationResponse>('PUT', `/pages/sections/${sectionId}/localizations`, data);
  }

  async deleteSectionLocalization(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/pages/sections/localizations/${id}`);
  }

  // Legal
  async getLegalDocuments(siteId: string, params?: { page?: number; per_page?: number }): Promise<Paginated<LegalDocumentResponse>> {
    return apiRequest<Paginated<LegalDocumentResponse>>('GET', `/sites/${siteId}/legal`, undefined, { params });
  }

  async createLegalDocument(siteId: string, data: CreateLegalDocumentRequest): Promise<LegalDocumentResponse> {
    return apiRequest<LegalDocumentResponse>('POST', `/sites/${siteId}/legal`, data);
  }

  async updateLegalDocument(id: string, data: UpdateLegalDocumentRequest): Promise<LegalDocumentResponse> {
    return apiRequest<LegalDocumentResponse>('PUT', `/legal/${id}`, data);
  }

  async deleteLegalDocument(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/legal/${id}`);
  }

  async getLegalGroups(documentId: string): Promise<LegalGroupResponse[]> {
    return apiRequest<LegalGroupResponse[]>('GET', `/legal/${documentId}/groups`);
  }

  async createLegalGroup(documentId: string, data: CreateLegalGroupRequest): Promise<LegalGroupResponse> {
    return apiRequest<LegalGroupResponse>('POST', `/legal/${documentId}/groups`, data);
  }

  async updateLegalGroup(id: string, data: UpdateLegalGroupRequest): Promise<LegalGroupResponse> {
    return apiRequest<LegalGroupResponse>('PUT', `/legal/groups/${id}`, data);
  }

  async deleteLegalGroup(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/legal/groups/${id}`);
  }

  async getLegalItems(groupId: string): Promise<LegalItemResponse[]> {
    return apiRequest<LegalItemResponse[]>('GET', `/legal/groups/${groupId}/items`);
  }

  async createLegalItem(groupId: string, data: CreateLegalItemRequest): Promise<LegalItemResponse> {
    return apiRequest<LegalItemResponse>('POST', `/legal/groups/${groupId}/items`, data);
  }

  async updateLegalItem(id: string, data: UpdateLegalItemRequest): Promise<LegalItemResponse> {
    return apiRequest<LegalItemResponse>('PUT', `/legal/items/${id}`, data);
  }

  async deleteLegalItem(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/legal/items/${id}`);
  }

  // Skills
  async getSkills(siteId: string, params?: { page?: number; per_page?: number }): Promise<Paginated<SkillResponse>> {
    return apiRequest<Paginated<SkillResponse>>('GET', `/sites/${siteId}/skills`, undefined, { params });
  }

  async createSkill(data: CreateSkillRequest): Promise<SkillResponse> {
    return apiRequest<SkillResponse>('POST', '/skills', data);
  }

  async updateSkill(id: string, data: UpdateSkillRequest): Promise<SkillResponse> {
    return apiRequest<SkillResponse>('PUT', `/skills/${id}`, data);
  }

  async deleteSkill(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/skills/${id}`);
  }

  // CV Entries
  async getCvEntries(siteId: string, params?: { entry_type?: string; page?: number; per_page?: number }): Promise<Paginated<CvEntryResponse>> {
    return apiRequest<Paginated<CvEntryResponse>>('GET', `/sites/${siteId}/cv`, undefined, { params });
  }

  async createCvEntry(data: CreateCvEntryRequest): Promise<CvEntryResponse> {
    return apiRequest<CvEntryResponse>('POST', '/cv', data);
  }

  async updateCvEntry(id: string, data: UpdateCvEntryRequest): Promise<CvEntryResponse> {
    return apiRequest<CvEntryResponse>('PUT', `/cv/${id}`, data);
  }

  async deleteCvEntry(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/cv/${id}`);
  }

  // Document Folders
  async getDocumentFolders(siteId: string): Promise<DocumentFolder[]> {
    return apiRequest<DocumentFolder[]>('GET', `/sites/${siteId}/document-folders`);
  }

  async createDocumentFolder(siteId: string, data: CreateDocumentFolderRequest): Promise<DocumentFolder> {
    return apiRequest<DocumentFolder>('POST', `/sites/${siteId}/document-folders`, data);
  }

  async updateDocumentFolder(id: string, data: UpdateDocumentFolderRequest): Promise<DocumentFolder> {
    return apiRequest<DocumentFolder>('PUT', `/document-folders/${id}`, data);
  }

  async deleteDocumentFolder(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/document-folders/${id}`);
  }

  // Documents
  async getDocuments(siteId: string, params?: { folder_id?: string; page?: number; per_page?: number }): Promise<Paginated<DocumentListItem>> {
    return apiRequest<Paginated<DocumentListItem>>('GET', `/sites/${siteId}/documents`, undefined, { params });
  }

  async getDocument(id: string): Promise<DocumentResponse> {
    return apiRequest<DocumentResponse>('GET', `/documents/${id}`);
  }

  async createDocument(siteId: string, data: CreateDocumentRequest): Promise<DocumentListItem> {
    return apiRequest<DocumentListItem>('POST', `/sites/${siteId}/documents`, data);
  }

  async updateDocument(id: string, data: UpdateDocumentRequest): Promise<DocumentListItem> {
    return apiRequest<DocumentListItem>('PUT', `/documents/${id}`, data);
  }

  async deleteDocument(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/documents/${id}`);
  }

  async downloadDocument(id: string): Promise<Blob> {
    const response = await apiClient.get(`/documents/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Document Localizations
  async createDocumentLocalization(documentId: string, data: CreateDocumentLocalizationRequest): Promise<DocumentLocalizationResponse> {
    return apiRequest<DocumentLocalizationResponse>('POST', `/documents/${documentId}/localizations`, data);
  }

  async updateDocumentLocalization(locId: string, data: UpdateDocumentLocalizationRequest): Promise<DocumentLocalizationResponse> {
    return apiRequest<DocumentLocalizationResponse>('PUT', `/documents/localizations/${locId}`, data);
  }

  async deleteDocumentLocalization(locId: string): Promise<void> {
    return apiRequest<void>('DELETE', `/documents/localizations/${locId}`);
  }

  // Blog Documents
  async getBlogDocuments(blogId: string): Promise<BlogDocumentResponse[]> {
    return apiRequest<BlogDocumentResponse[]>('GET', `/blogs/${blogId}/documents`);
  }

  async assignBlogDocument(blogId: string, data: AssignBlogDocumentRequest): Promise<BlogDocumentResponse> {
    return apiRequest<BlogDocumentResponse>('POST', `/blogs/${blogId}/documents`, data);
  }

  async unassignBlogDocument(blogId: string, documentId: string): Promise<void> {
    return apiRequest<void>('DELETE', `/blogs/${blogId}/documents/${documentId}`);
  }

  // Media Folders
  async getMediaFolders(siteId: string): Promise<MediaFolder[]> {
    return apiRequest<MediaFolder[]>('GET', `/sites/${siteId}/media-folders`);
  }

  async createMediaFolder(siteId: string, data: CreateMediaFolderRequest): Promise<MediaFolder> {
    return apiRequest<MediaFolder>('POST', `/sites/${siteId}/media-folders`, data);
  }

  async updateMediaFolder(id: string, data: UpdateMediaFolderRequest): Promise<MediaFolder> {
    return apiRequest<MediaFolder>('PUT', `/media-folders/${id}`, data);
  }

  async deleteMediaFolder(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/media-folders/${id}`);
  }

  // Media Metadata
  async getMediaMetadata(mediaId: string): Promise<MediaMetadataResponse[]> {
    return apiRequest<MediaMetadataResponse[]>('GET', `/media/${mediaId}/metadata`);
  }

  async createMediaMetadata(mediaId: string, data: AddMediaMetadataRequest): Promise<MediaMetadataResponse> {
    return apiRequest<MediaMetadataResponse>('POST', `/media/${mediaId}/metadata`, data);
  }

  async updateMediaMetadata(metadataId: string, data: UpdateMediaMetadataRequest): Promise<MediaMetadataResponse> {
    return apiRequest<MediaMetadataResponse>('PUT', `/media/metadata/${metadataId}`, data);
  }

  async deleteMediaMetadata(metadataId: string): Promise<void> {
    return apiRequest<void>('DELETE', `/media/metadata/${metadataId}`);
  }

  // Site Settings
  async getSiteSettings(siteId: string): Promise<SiteSettingsResponse> {
    return apiRequest<SiteSettingsResponse>('GET', `/sites/${siteId}/settings`);
  }

  async updateSiteSettings(siteId: string, data: UpdateSiteSettingsRequest): Promise<SiteSettingsResponse> {
    return apiRequest<SiteSettingsResponse>('PUT', `/sites/${siteId}/settings`, data);
  }

  // Clerk User Management
  async getClerkUsers(params?: { limit?: number; offset?: number }): Promise<ClerkUserListResponse> {
    return apiRequest<ClerkUserListResponse>('GET', '/clerk/users', undefined, { params });
  }

  async getClerkUser(id: string): Promise<ClerkUser> {
    return apiRequest<ClerkUser>('GET', `/clerk/users/${id}`);
  }

  async updateClerkUserRole(userId: string, data: { role: string }): Promise<void> {
    return apiRequest<void>('PUT', `/clerk/users/${userId}/role`, data);
  }

  // Site Locale Management
  async getSiteLocales(siteId: string): Promise<SiteLocaleResponse[]> {
    return apiRequest<SiteLocaleResponse[]>('GET', `/sites/${siteId}/locales`);
  }

  async addSiteLocale(siteId: string, data: AddSiteLocaleRequest): Promise<SiteLocaleResponse> {
    return apiRequest<SiteLocaleResponse>('POST', `/sites/${siteId}/locales`, data);
  }

  async updateSiteLocale(siteId: string, localeId: string, data: UpdateSiteLocaleRequest): Promise<SiteLocaleResponse> {
    return apiRequest<SiteLocaleResponse>('PUT', `/sites/${siteId}/locales/${localeId}`, data);
  }

  async removeSiteLocale(siteId: string, localeId: string): Promise<void> {
    return apiRequest<void>('DELETE', `/sites/${siteId}/locales/${localeId}`);
  }

  async setSiteDefaultLocale(siteId: string, localeId: string): Promise<void> {
    return apiRequest<void>('PUT', `/sites/${siteId}/locales/${localeId}/default`);
  }

  // Site Membership Management
  async getSiteMembers(siteId: string): Promise<SiteMembership[]> {
    return apiRequest<SiteMembership[]>('GET', `/sites/${siteId}/members`);
  }

  async addSiteMember(siteId: string, data: AddSiteMemberRequest): Promise<SiteMembership> {
    return apiRequest<SiteMembership>('POST', `/sites/${siteId}/members`, data);
  }

  async updateMemberRole(siteId: string, memberId: string, data: UpdateMemberRoleRequest): Promise<SiteMembership> {
    return apiRequest<SiteMembership>('PUT', `/sites/${siteId}/members/${memberId}/role`, data);
  }

  async removeSiteMember(siteId: string, memberId: string): Promise<void> {
    return apiRequest<void>('DELETE', `/sites/${siteId}/members/${memberId}`);
  }

  async transferOwnership(siteId: string, data: TransferOwnershipRequest): Promise<void> {
    return apiRequest<void>('POST', `/sites/${siteId}/transfer-ownership`, data);
  }

  async getMyMemberships(): Promise<MembershipSummary[]> {
    return apiRequest<MembershipSummary[]>('GET', '/my/memberships');
  }

  // Audit Logs
  async getAuditLogs(siteId: string, params?: { page?: number; per_page?: number }): Promise<Paginated<AuditLogEntry>> {
    return apiRequest<Paginated<AuditLogEntry>>('GET', `/sites/${siteId}/audit`, undefined, { params });
  }

  async getEntityAuditLogs(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    return apiRequest<AuditLogEntry[]>('GET', `/audit/entity/${entityType}/${entityId}`);
  }

  async getEntityChangeHistory(entityType: string, entityId: string): Promise<ChangeHistoryEntry[]> {
    return apiRequest<ChangeHistoryEntry[]>('GET', `/audit/history/${entityType}/${entityId}`);
  }

  async revertChanges(changeIds: string[]): Promise<RevertChangesResponse> {
    return apiRequest<RevertChangesResponse>('POST', '/audit/history/revert', { change_ids: changeIds });
  }

  // ===== Webhooks =====

  async getWebhooks(siteId: string, params?: { page?: number; per_page?: number }): Promise<Paginated<Webhook>> {
    return apiRequest<Paginated<Webhook>>('GET', `/sites/${siteId}/webhooks`, undefined, { params });
  }

  async getWebhook(id: string): Promise<Webhook> {
    return apiRequest<Webhook>('GET', `/webhooks/${id}`);
  }

  async createWebhook(siteId: string, data: CreateWebhookRequest): Promise<Webhook> {
    return apiRequest<Webhook>('POST', `/sites/${siteId}/webhooks`, data);
  }

  async updateWebhook(id: string, data: UpdateWebhookRequest): Promise<Webhook> {
    return apiRequest<Webhook>('PUT', `/webhooks/${id}`, data);
  }

  async deleteWebhook(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/webhooks/${id}`);
  }

  async testWebhook(id: string): Promise<WebhookDelivery> {
    return apiRequest<WebhookDelivery>('POST', `/webhooks/${id}/test`);
  }

  async getWebhookDeliveries(id: string, params?: { page?: number; per_page?: number }): Promise<Paginated<WebhookDelivery>> {
    return apiRequest<Paginated<WebhookDelivery>>('GET', `/webhooks/${id}/deliveries`, undefined, { params });
  }

  // ===== Redirects =====

  async getRedirects(siteId: string, params?: { page?: number; per_page?: number }): Promise<Paginated<Redirect>> {
    return apiRequest<Paginated<Redirect>>('GET', `/sites/${siteId}/redirects`, undefined, { params });
  }

  async createRedirect(siteId: string, data: CreateRedirectRequest): Promise<Redirect> {
    return apiRequest<Redirect>('POST', `/sites/${siteId}/redirects`, data);
  }

  async updateRedirect(id: string, data: UpdateRedirectRequest): Promise<Redirect> {
    return apiRequest<Redirect>('PUT', `/redirects/${id}`, data);
  }

  async deleteRedirect(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/redirects/${id}`);
  }

  // ===== Content Templates =====

  async getContentTemplates(siteId: string, params?: { page?: number; per_page?: number; search?: string }): Promise<Paginated<ContentTemplate>> {
    return apiRequest<Paginated<ContentTemplate>>('GET', `/sites/${siteId}/content-templates`, undefined, { params });
  }

  async getContentTemplate(id: string): Promise<ContentTemplate> {
    return apiRequest<ContentTemplate>('GET', `/content-templates/${id}`);
  }

  async createContentTemplate(siteId: string, data: CreateContentTemplateRequest): Promise<ContentTemplate> {
    return apiRequest<ContentTemplate>('POST', `/sites/${siteId}/content-templates`, data);
  }

  async updateContentTemplate(id: string, data: UpdateContentTemplateRequest): Promise<ContentTemplate> {
    return apiRequest<ContentTemplate>('PUT', `/content-templates/${id}`, data);
  }

  async deleteContentTemplate(id: string): Promise<void> {
    return apiRequest<void>('DELETE', `/content-templates/${id}`);
  }

  // Bulk Actions
  async bulkBlogs(siteId: string, data: BulkContentRequest): Promise<BulkContentResponse> {
    return apiRequest<BulkContentResponse>('POST', `/sites/${siteId}/blogs/bulk`, data);
  }

  async bulkPages(siteId: string, data: BulkContentRequest): Promise<BulkContentResponse> {
    return apiRequest<BulkContentResponse>('POST', `/sites/${siteId}/pages/bulk`, data);
  }

  // Editorial Workflow - Review Actions
  async reviewBlog(id: string, data: ReviewActionRequest): Promise<ReviewActionResponse> {
    return apiRequest<ReviewActionResponse>('POST', `/blogs/${id}/review`, data);
  }

  async reviewPage(id: string, data: ReviewActionRequest): Promise<ReviewActionResponse> {
    return apiRequest<ReviewActionResponse>('POST', `/pages/${id}/review`, data);
  }

  // ===== Notifications =====

  async getNotifications(siteId: string, params?: { page?: number; per_page?: number }): Promise<Paginated<NotificationResponse>> {
    return apiRequest<Paginated<NotificationResponse>>('GET', `/sites/${siteId}/notifications`, undefined, { params });
  }

  async getUnreadCount(siteId: string): Promise<UnreadCountResponse> {
    return apiRequest<UnreadCountResponse>('GET', `/sites/${siteId}/notifications/unread-count`);
  }

  async markNotificationRead(id: string): Promise<NotificationResponse> {
    return apiRequest<NotificationResponse>('PUT', `/notifications/${id}/read`);
  }

  async markAllNotificationsRead(siteId: string): Promise<MarkAllReadResponse> {
    return apiRequest<MarkAllReadResponse>('PUT', `/sites/${siteId}/notifications/read-all`);
  }
}

// Create singleton instance
const apiService = new ApiService();
export default apiService;
