import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/dom';
import { vi } from 'vitest';

// Initialize i18n with English translations (catches missing keys)
import '@/i18n';

// Testing-library's default waitFor timeout is 1s. Under full-suite load
// (MUI v9 + Tiptap + React Query all importing in parallel workers), React
// effect settlements can exceed that ceiling even when nothing is wrong with
// the component. 5s keeps legitimate failures loud without producing
// concurrency-induced flakes.
configure({ asyncUtilTimeout: 5000 });

// Mock @clerk/clerk-react
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isSignedIn: true,
    isLoaded: true,
    getToken: vi.fn().mockResolvedValue('mock-token'),
    signOut: vi.fn(),
  }),
  useUser: () => ({
    user: {
      id: 'clerk-user-1',
      fullName: 'Test User',
      primaryEmailAddress: { emailAddress: 'test@example.com' },
      imageUrl: 'https://example.com/avatar.png',
    },
  }),
  useSignIn: () => ({ signIn: null, isLoaded: true }),
  useClerk: () => ({
    redirectToSignUp: vi.fn(),
    redirectToSignIn: vi.fn(),
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock AuthContext (useAuth is used by many components for permission checks)
vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    permission: 'Admin',
    siteId: null,
    loading: false,
    memberships: [],
    isSystemAdmin: false,
    isGuest: false,
    logout: vi.fn(),
    refreshAuth: vi.fn(),
    canRead: true,
    canWrite: true,
    isAdmin: true,
    isMaster: false,
    currentSiteRole: 'admin',
    canManageMembers: true,
    canEditAll: true,
    isOwner: false,
    clerkUserId: 'clerk-user-1',
    userEmail: 'test@example.com',
    userFullName: 'Test User',
    userImageUrl: null,
    getRoleForSite: () => 'admin',
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock UserPreferencesContext (used by useListPageState and many page components)
vi.mock('@/store/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    preferences: {
      language: 'en',
      theme_id: 'system',
      page_size: 25,
    },
    isLoading: false,
    updatePreferences: vi.fn(),
    isUpdating: false,
  }),
}));

// Mock HelpStateContext (used by help system components)
vi.mock('@/store/HelpStateContext', () => ({
  useHelpState: () => ({
    state: { tour_completed: false, hotspots_seen: [], field_help_seen: [] },
    isLoading: false,
    tourActive: false,
    startTour: vi.fn(),
    completeTour: vi.fn(),
    resetTour: vi.fn(),
    dismissHotspot: vi.fn(),
    dismissFieldHelp: vi.fn(),
    isHotspotSeen: () => false,
    isFieldHelpSeen: () => false,
  }),
}));

// Mock window.matchMedia (needed by MUI)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock per-resource service modules (#667 split apiService into per-resource
// modules; tests reach into each module's named exports directly).
// Pre-seeded defaults are picked to make most tests render their empty-state
// happy path without per-test setup; tests can override via vi.mocked().

vi.mock('@/services/auth', () => ({
  getAuthMe: vi.fn(),
  getGuestToken: vi.fn().mockResolvedValue({
    api_key: 'dk_guest_test',
    site_id: 'site-1',
    site_name: 'Demo',
    site_slug: 'demo',
  }),
  getProfile: vi.fn(),
  exportUserData: vi.fn(),
  deleteAccount: vi.fn(),
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
  getOnboarding: vi.fn(),
  completeOnboarding: vi.fn(),
  getHelpState: vi.fn(),
  updateHelpState: vi.fn(),
  resetHelpState: vi.fn(),
  joinDemoSite: vi.fn(),
  getMyMemberships: vi.fn(),
}));

vi.mock('@/services/health', () => ({
  getHealth: vi.fn(),
}));

vi.mock('@/services/sites', () => ({
  getSites: vi.fn().mockResolvedValue([
    {
      id: 'site-1',
      name: 'Test Site',
      slug: 'test-site',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ]),
  getSite: vi.fn(),
  createSite: vi.fn(),
  updateSite: vi.fn(),
  deleteSite: vi.fn(),
  resetContent: vi.fn(),
  startSiteExport: vi.fn(),
  getSiteExportJob: vi.fn(),
  downloadSiteExport: vi.fn(),
  getDeletedSites: vi.fn().mockResolvedValue([]),
  restoreSite: vi.fn(),
  getSiteContext: vi.fn().mockResolvedValue({
    member_count: 0,
    current_user_role: 'admin',
    features: {
      editorial_workflow: false,
      scheduling: true,
      versioning: true,
      analytics: false,
    },
    suggestions: { show_team_workflow_prompt: false },
    modules: {
      blog: true,
      pages: true,
      portfolio: false,
      legal: false,
      documents: false,
      ai: false,
      forms: false,
    },
    integration: {
      code_injection_head: '',
      code_injection_footer: '',
      seo_title_template: '{{title}} | {{site_name}}',
      seo_default_description: '',
      theme_color: '#ffffff',
      background_color: '#ffffff',
    },
  }),
  leaveSite: vi.fn(),
  getSiteSettings: vi.fn(),
  updateSiteSettings: vi.fn(),
  getStorageUsage: vi.fn(),
  getSystemStorageOverview: vi.fn(),
  getSitesOverview: vi.fn(),
  getTrash: vi.fn(),
  getTrashCount: vi.fn(),
  restoreTrashItem: vi.fn(),
  permanentDeleteTrashItem: vi.fn(),
  getPreviewToken: vi.fn(),
  getOnboardingProgress: vi.fn().mockResolvedValue({ steps: [], completed: false }),
  completeOnboardingStep: vi.fn(),
  uploadFavicon: vi.fn(),
  getFavicon: vi.fn(),
  downloadFaviconPackage: vi.fn(),
}));

vi.mock('@/services/apiKeys', () => ({
  getApiKeys: vi.fn(),
  getApiKey: vi.fn(),
  createApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  blockApiKey: vi.fn(),
  unblockApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  getApiKeyUsage: vi.fn(),
  getApiKeyUsageSummary: vi.fn(),
}));

vi.mock('@/services/environments', () => ({
  getEnvironments: vi.fn(),
}));

vi.mock('@/services/locales', () => ({
  getLocales: vi.fn(),
  createLocale: vi.fn(),
  updateLocale: vi.fn(),
  deleteLocale: vi.fn(),
}));

vi.mock('@/services/siteLocales', () => ({
  getSiteLocales: vi.fn().mockResolvedValue([]),
  addSiteLocale: vi.fn(),
  updateSiteLocale: vi.fn(),
  removeSiteLocale: vi.fn(),
  setSiteDefaultLocale: vi.fn(),
}));

vi.mock('@/services/members', () => ({
  getSiteMembers: vi.fn(),
  addSiteMember: vi.fn(),
  updateMemberRole: vi.fn(),
  removeSiteMember: vi.fn(),
  transferOwnership: vi.fn(),
}));

vi.mock('@/services/clerkUsers', () => ({
  getClerkUsers: vi.fn(),
  getClerkUser: vi.fn(),
  updateClerkUserRole: vi.fn(),
  getUserAuditLogs: vi.fn(),
  suspendUser: vi.fn(),
  banUser: vi.fn(),
  unsuspendUser: vi.fn(),
  deleteBannedUser: vi.fn(),
}));

vi.mock('@/services/blogs', () => ({
  getBlogs: vi.fn(),
  getBlogStatusCounts: vi.fn().mockResolvedValue({
    draft: 0,
    in_review: 0,
    scheduled: 0,
    published: 0,
    archived: 0,
  }),
  getBlogDetail: vi.fn(),
  createBlog: vi.fn(),
  updateBlog: vi.fn(),
  deleteBlog: vi.fn(),
  cloneBlog: vi.fn(),
  getSimilarBlogs: vi.fn(),
  seedSampleContent: vi.fn(),
  deleteSampleContent: vi.fn(),
  bulkBlogs: vi.fn(),
  reviewBlog: vi.fn(),
  getBlogLocalizations: vi.fn(),
  createBlogLocalization: vi.fn(),
  updateBlogLocalization: vi.fn(),
  deleteBlogLocalization: vi.fn(),
}));

vi.mock('@/services/pages', () => ({
  getPages: vi.fn(),
  getPageStatusCounts: vi.fn().mockResolvedValue({
    draft: 0,
    in_review: 0,
    scheduled: 0,
    published: 0,
    archived: 0,
  }),
  getPage: vi.fn().mockResolvedValue(null),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  clonePage: vi.fn(),
  getPageSections: vi.fn().mockResolvedValue([]),
  createPageSection: vi.fn(),
  updatePageSection: vi.fn(),
  deletePageSection: vi.fn(),
  reorderPageSections: vi.fn(),
  getPageDetail: vi.fn(),
  getPageLocalizations: vi.fn().mockResolvedValue([]),
  createPageLocalization: vi.fn(),
  updatePageLocalization: vi.fn(),
  deletePageLocalization: vi.fn(),
  getSectionLocalizations: vi.fn(),
  getPageSectionLocalizations: vi.fn().mockResolvedValue([]),
  upsertSectionLocalization: vi.fn(),
  deleteSectionLocalization: vi.fn(),
  bulkPages: vi.fn(),
  reviewPage: vi.fn(),
}));

vi.mock('@/services/legal', () => ({
  getLegalDocuments: vi.fn(),
  createLegalDocument: vi.fn(),
  updateLegalDocument: vi.fn(),
  deleteLegalDocument: vi.fn(),
  getLegalGroups: vi.fn(),
  createLegalGroup: vi.fn(),
  updateLegalGroup: vi.fn(),
  deleteLegalGroup: vi.fn(),
  getLegalItems: vi.fn(),
  createLegalItem: vi.fn(),
  updateLegalItem: vi.fn(),
  deleteLegalItem: vi.fn(),
  getLegalDocumentDetail: vi.fn(),
  getLegalLocalizations: vi.fn(),
  createLegalLocalization: vi.fn(),
  updateLegalLocalization: vi.fn(),
  getLegalVersions: vi.fn(),
  createLegalVersion: vi.fn(),
}));

vi.mock('@/services/documents', () => ({
  getDocumentFolders: vi.fn().mockResolvedValue([]),
  createDocumentFolder: vi.fn(),
  updateDocumentFolder: vi.fn(),
  deleteDocumentFolder: vi.fn(),
  getDocuments: vi.fn(),
  getDocument: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  downloadDocument: vi.fn(),
  verifyDocumentAccess: vi.fn(),
  setDocumentPrivacy: vi.fn(),
  removeDocumentPrivacy: vi.fn(),
  unlockDocumentAccess: vi.fn(),
  createDocumentLocalization: vi.fn(),
  updateDocumentLocalization: vi.fn(),
  deleteDocumentLocalization: vi.fn(),
  getBlogDocuments: vi.fn(),
  assignBlogDocument: vi.fn(),
  unassignBlogDocument: vi.fn(),
}));

vi.mock('@/services/cv', () => ({
  getCvEntries: vi.fn(),
  getCvEntryDetail: vi.fn(),
  createCvEntry: vi.fn(),
  updateCvEntry: vi.fn(),
  deleteCvEntry: vi.fn(),
  reviewCvEntry: vi.fn(),
  bulkCvEntries: vi.fn(),
  reorderCvEntries: vi.fn(),
}));

vi.mock('@/services/projects', () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  getProjectBySlug: vi.fn(),
  getPublishedProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  reviewProject: vi.fn(),
  bulkProjects: vi.fn(),
  reorderProjects: vi.fn(),
}));

vi.mock('@/services/skills', () => ({
  getSkills: vi.fn(),
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
  bulkSkills: vi.fn(),
}));

vi.mock('@/services/media', () => ({
  getMedia: vi.fn(),
  getMediaCategoryCounts: vi.fn().mockResolvedValue({
    image: 0,
    video: 0,
    audio: 0,
    document: 0,
    other: 0,
  }),
  getMediaById: vi.fn().mockResolvedValue({
    id: 'media-1',
    filename: 'abc123.jpg',
    original_filename: 'photo.jpg',
    mime_type: 'image/jpeg',
    file_size: 1048576,
    storage_provider: 'local',
    is_global: false,
    focal_x: 0.5,
    focal_y: 0.5,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    variants: [],
  }),
  getMediaTags: vi.fn().mockResolvedValue({ tags: [] }),
  updateMediaTags: vi.fn().mockResolvedValue({ tags: [] }),
  getSiteTags: vi.fn().mockResolvedValue({ tags: [] }),
  getMediaUsage: vi.fn().mockResolvedValue({ usage_count: 0, references: [] }),
  uploadMedia: vi.fn(),
  uploadMediaFile: vi.fn(),
  updateMedia: vi.fn(),
  deleteMedia: vi.fn(),
  getMediaFolders: vi.fn(),
  createMediaFolder: vi.fn(),
  updateMediaFolder: vi.fn(),
  deleteMediaFolder: vi.fn(),
  getMediaMetadata: vi.fn().mockResolvedValue([]),
  createMediaMetadata: vi.fn().mockResolvedValue({}),
  updateMediaMetadata: vi.fn().mockResolvedValue({}),
  deleteMediaMetadata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/taxonomy', () => ({
  getTags: vi.fn(),
  getCategories: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  assignCategoryToContent: vi.fn(),
  removeCategoryFromContent: vi.fn(),
  assignTagToContent: vi.fn(),
  removeTagFromContent: vi.fn(),
  getCategoriesWithBlogCount: vi.fn(),
}));

vi.mock('@/services/social', () => ({
  getSocialLinks: vi.fn(),
  createSocialLink: vi.fn(),
  updateSocialLink: vi.fn(),
  deleteSocialLink: vi.fn(),
  reorderSocialLinks: vi.fn(),
}));

vi.mock('@/services/navigation', () => ({
  getNavigationMenus: vi.fn(),
  createNavigationMenu: vi.fn(),
  updateNavigationMenu: vi.fn(),
  deleteNavigationMenu: vi.fn(),
  getNavigationTree: vi.fn(),
  getNavigationItems: vi.fn(),
  getMenuItems: vi.fn(),
  createNavigationItem: vi.fn(),
  createMenuItem: vi.fn(),
  updateNavigationItem: vi.fn(),
  deleteNavigationItem: vi.fn(),
  reorderNavigationItems: vi.fn(),
  reorderMenuItems: vi.fn(),
  getNavigationItemLocalizations: vi.fn(),
  upsertNavigationItemLocalizations: vi.fn(),
}));

vi.mock('@/services/audit', () => ({
  getAuditLogs: vi.fn(),
  getAuditAiUsage: vi.fn(),
  getEntityAuditLogs: vi.fn(),
  getEntityChangeHistory: vi.fn(),
  revertChanges: vi.fn(),
}));

vi.mock('@/services/webhooks', () => ({
  getWebhooks: vi.fn(),
  getWebhook: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  testWebhook: vi.fn(),
  getWebhookDeliveries: vi.fn(),
  getWebhookStats: vi.fn(),
}));

vi.mock('@/services/redirects', () => ({
  getRedirects: vi.fn(),
  createRedirect: vi.fn(),
  updateRedirect: vi.fn(),
  deleteRedirect: vi.fn(),
}));

vi.mock('@/services/contentTemplates', () => ({
  getContentTemplates: vi.fn(),
  getContentTemplate: vi.fn(),
  createContentTemplate: vi.fn(),
  updateContentTemplate: vi.fn(),
  deleteContentTemplate: vi.fn(),
}));

vi.mock('@/services/notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  getNotificationStatusCounts: vi.fn().mockResolvedValue({ read: 0, unread: 0 }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn().mockResolvedValue({ deleted: 1 }),
  bulkDeleteNotifications: vi.fn().mockResolvedValue({ deleted: 0 }),
  deleteReadNotifications: vi.fn().mockResolvedValue({ deleted: 0 }),
}));

vi.mock('@/services/ai', () => ({
  getAiConfig: vi.fn(),
  upsertAiConfig: vi.fn(),
  deleteAiConfig: vi.fn(),
  testAiConnection: vi.fn(),
  generateAiContent: vi.fn(),
  listAiModels: vi.fn(),
  getAiUsage: vi.fn(),
  exportAiUsageCsv: vi.fn(),
}));

vi.mock('@/services/analytics', () => ({
  getAnalyticsReport: vi.fn(),
  getAnalyticsPageDetail: vi.fn(),
  aggregateAnalytics: vi.fn(),
}));

vi.mock('@/services/forms', () => ({
  getForms: vi.fn().mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
  }),
  getForm: vi.fn(),
  createForm: vi.fn(),
  updateForm: vi.fn(),
  deleteForm: vi.fn(),
  getFormTemplates: vi.fn().mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
  }),
  getFormTemplate: vi.fn(),
  createFormTemplate: vi.fn(),
  updateFormTemplate: vi.fn(),
  deleteFormTemplate: vi.fn(),
  getSubmissions: vi.fn().mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
  }),
  getSubmissionStatusCounts: vi.fn().mockResolvedValue({
    new: 0,
    in_review: 0,
    resolved: 0,
    rejected: 0,
    archived: 0,
  }),
  getSubmission: vi.fn(),
  updateSubmissionStatus: vi.fn(),
  deleteSubmission: vi.fn(),
  createSubmissionNote: vi.fn(),
  deleteSubmissionNote: vi.fn(),
}));

vi.mock('@/services/botProtection', () => ({
  getSiteBotProtection: vi.fn(),
  upsertSiteBotProtection: vi.fn(),
  deleteSiteBotProtection: vi.fn(),
}));

vi.mock('@/services/http', () => ({
  setClerkTokenGetter: vi.fn(),
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  apiRequest: vi.fn(),
}));

// Mock window.scrollTo
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// Mock localStorage (jsdom may not fully initialise it in all environments)
const localStorageMock = (() => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// Mock sessionStorage
const sessionStorageMock = (() => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
})();
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, writable: true });

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver (needed by recharts)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Mock document.elementFromPoint / elementsFromPoint (jsdom doesn't implement
// them). Tiptap 3.24+ ships a viewport plugin (@tiptap/extensions) that calls
// view.posAtCoords() → root.elementFromPoint() on editor mount; without these
// stubs every test that mounts the editor throws "elementFromPoint is not a
// function". ProseMirror tolerates a null result (it has coordinate fallbacks).
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
if (!document.elementsFromPoint) {
  document.elementsFromPoint = () => [];
}
