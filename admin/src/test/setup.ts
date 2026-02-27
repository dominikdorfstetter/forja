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
  };
  return { default: apiService, ApiService: vi.fn(() => apiService) };
});

// Mock window.scrollTo
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

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
