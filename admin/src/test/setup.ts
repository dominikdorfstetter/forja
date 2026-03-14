import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Initialize i18n with English translations (catches missing keys)
import '@/i18n';

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
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock UserPreferencesContext (used by useListPageState and many page components)
vi.mock('@/store/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    preferences: {
      autosave_enabled: true,
      autosave_debounce_seconds: 3,
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

// Mock apiService
vi.mock('@/services/api', () => {
  const apiService = {
    setClerkTokenGetter: vi.fn(),
    getAuthMe: vi.fn(),
    getSites: vi.fn(),
    getTags: vi.fn(),
    getCategories: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    getWebhooks: vi.fn(),
    createWebhook: vi.fn(),
    updateWebhook: vi.fn(),
    deleteWebhook: vi.fn(),
    testWebhook: vi.fn(),
    getWebhookDeliveries: vi.fn(),
    getHealth: vi.fn(),
    getSiteSettings: vi.fn(),
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    // Blog methods
    getBlogs: vi.fn(),
    createBlog: vi.fn(),
    updateBlog: vi.fn(),
    deleteBlog: vi.fn(),
    cloneBlog: vi.fn(),
    seedSampleContent: vi.fn(),
    deleteSampleContent: vi.fn(),
    bulkBlogs: vi.fn(),
    createBlogLocalization: vi.fn(),
    // Page methods
    getPages: vi.fn(),
    getPage: vi.fn(),
    createPage: vi.fn(),
    updatePage: vi.fn(),
    deletePage: vi.fn(),
    clonePage: vi.fn(),
    bulkPages: vi.fn(),
    getPageDetail: vi.fn(),
    getPageLocalizations: vi.fn(),
    createPageLocalization: vi.fn(),
    updatePageLocalization: vi.fn(),
    deletePageLocalization: vi.fn(),
    // Media methods
    getMedia: vi.fn(),
    uploadMediaFile: vi.fn(),
    updateMedia: vi.fn(),
    deleteMedia: vi.fn(),
    getMediaFolders: vi.fn(),
    createMediaFolder: vi.fn(),
    updateMediaFolder: vi.fn(),
    deleteMediaFolder: vi.fn(),
    getMediaById: vi.fn(),
    // Section methods
    getSectionLocalizations: vi.fn(),
    upsertSectionLocalization: vi.fn(),
    updatePageSection: vi.fn(),
    // User Preferences
    getUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),
    // Onboarding
    getOnboarding: vi.fn(),
    completeOnboarding: vi.fn(),
    // Onboarding progress
    getOnboardingProgress: vi.fn(),
    completeOnboardingStep: vi.fn(),
    // Help state
    getHelpState: vi.fn(),
    updateHelpState: vi.fn(),
    resetHelpState: vi.fn(),
    // Locale & template methods
    getSiteLocales: vi.fn(),
    getContentTemplates: vi.fn(),
    // Redirect methods
    getRedirects: vi.fn(),
    createRedirect: vi.fn(),
    updateRedirect: vi.fn(),
    deleteRedirect: vi.fn(),
    // Social link methods
    getSocialLinks: vi.fn(),
    createSocialLink: vi.fn(),
    updateSocialLink: vi.fn(),
    deleteSocialLink: vi.fn(),
    reorderSocialLinks: vi.fn(),
    // Navigation methods
    getNavigationMenus: vi.fn(),
    createNavigationMenu: vi.fn(),
    updateNavigationMenu: vi.fn(),
    deleteNavigationMenu: vi.fn(),
    getMenuItems: vi.fn(),
    createMenuItem: vi.fn(),
    createNavigationItem: vi.fn(),
    updateNavigationItem: vi.fn(),
    deleteNavigationItem: vi.fn(),
    reorderMenuItems: vi.fn(),
    reorderNavigationItems: vi.fn(),
    // Member methods
    getSiteMembers: vi.fn(),
    addSiteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeSiteMember: vi.fn(),
    transferOwnership: vi.fn(),
    getClerkUsers: vi.fn(),
    // Site methods
    createSite: vi.fn(),
    updateSite: vi.fn(),
    deleteSite: vi.fn(),
    getSiteContext: vi.fn(),
    updateSiteSettings: vi.fn(),
    getLocales: vi.fn(),
    // API key methods
    getApiKeys: vi.fn(),
    // Analytics methods
    getAnalyticsReport: vi.fn(),
    aggregateAnalytics: vi.fn(),
    // AI methods
    getAiConfig: vi.fn(),
    upsertAiConfig: vi.fn(),
    deleteAiConfig: vi.fn(),
    testAiConnection: vi.fn(),
    generateAiContent: vi.fn(),
    listAiModels: vi.fn(),
    // Federation methods
    getFederationSettings: vi.fn(),
    updateFederationSettings: vi.fn(),
    enableFederation: vi.fn(),
    disableFederation: vi.fn(),
    rotateKeys: vi.fn(),
    getFederationStats: vi.fn(),
    getFederationFollowers: vi.fn(),
    removeFederationFollower: vi.fn(),
    getFederationActivities: vi.fn(),
    retryFederationActivity: vi.fn(),
    getFederationComments: vi.fn(),
    approveFederationComment: vi.fn(),
    rejectFederationComment: vi.fn(),
    deleteFederationComment: vi.fn(),
    getBlockedInstances: vi.fn(),
    blockInstance: vi.fn(),
    unblockInstance: vi.fn(),
    getBlockedActors: vi.fn(),
    blockActor: vi.fn(),
    unblockActor: vi.fn(),
    getFeaturedPosts: vi.fn(),
    pinPost: vi.fn(),
    unpinPost: vi.fn(),
    createFederationNote: vi.fn(),
    getFederationNotes: vi.fn(),
    updateFederationNote: vi.fn(),
    deleteFederationNote: vi.fn(),
    importBlocklist: vi.fn(),
    getFederationHealth: vi.fn(),
  };
  return { default: apiService, ApiService: vi.fn(() => apiService) };
});

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
