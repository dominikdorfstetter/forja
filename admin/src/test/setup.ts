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
    bulkBlogs: vi.fn(),
    createBlogLocalization: vi.fn(),
    // Page methods
    getPages: vi.fn(),
    createPage: vi.fn(),
    updatePage: vi.fn(),
    deletePage: vi.fn(),
    clonePage: vi.fn(),
    bulkPages: vi.fn(),
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
    // Locale & template methods
    getSiteLocales: vi.fn(),
    getContentTemplates: vi.fn(),
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
