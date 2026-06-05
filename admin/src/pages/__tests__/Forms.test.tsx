import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { getForms } from '@/services/forms';
import type { FormListItem, Paginated } from '@/types/api';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [{ id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' }],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    permission: 'Admin' as const,
    loading: false,
    canRead: true,
    canWrite: true,
    isAdmin: true,
    isMaster: false,
    memberships: [],
    isSystemAdmin: false,
    isGuest: false,
    siteId: null,
    logout: vi.fn(),
    refreshAuth: vi.fn(),
    currentSiteRole: 'admin' as const,
    canManageMembers: true,
    canEditAll: true,
    isOwner: false,
    clerkUserId: 'clerk-1',
    userEmail: 'test@example.com',
    userFullName: 'Test User',
    userImageUrl: null,
    getRoleForSite: () => 'admin' as const,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

import FormsPage from '../Forms';

const baseForm: FormListItem = {
  id: 'form-1',
  site_id: 'site-1',
  name: 'Contact',
  slug: 'contact',
  description: null,
  is_active: true,
  field_count: 3,
  submission_count: 12,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const emptyPage: Paginated<FormListItem> = {
  data: [],
  meta: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
};

const onePage: Paginated<FormListItem> = {
  data: [baseForm],
  meta: { page: 1, page_size: 10, total_items: 1, total_pages: 1 },
};

describe('FormsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when the API returns no forms', async () => {
    vi.mocked(getForms).mockResolvedValue(emptyPage);
    renderWithProviders(<FormsPage />);

    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
    expect(screen.getByText(/No forms yet/i)).toBeInTheDocument();
  });

  it('renders form rows when the API returns data', async () => {
    vi.mocked(getForms).mockResolvedValue(onePage);
    renderWithProviders(<FormsPage />);

    await waitFor(() => expect(screen.getByText('Contact')).toBeInTheDocument());
    expect(screen.getByText('contact')).toBeInTheDocument();
    // Field count + submission count
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    // Active status pill
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });

  it('exposes a create-form button in the header', async () => {
    vi.mocked(getForms).mockResolvedValue(emptyPage);
    renderWithProviders(<FormsPage />);

    await waitFor(() =>
      expect(screen.getByTestId('forms.btn.create-form')).toBeInTheDocument(),
    );
  });
});
