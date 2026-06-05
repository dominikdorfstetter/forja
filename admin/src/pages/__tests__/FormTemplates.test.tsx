import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { getFormTemplates } from '@/services/forms';
import type { FormTemplateResponse, Paginated } from '@/types/api';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '', updated_at: '' },
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    canWrite: true,
    isAdmin: true,
    loading: false,
    canRead: true,
    isMaster: false,
    permission: 'Admin' as const,
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
    userEmail: 'a@b.c',
    userFullName: 'A',
    userImageUrl: null,
    getRoleForSite: () => 'admin' as const,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

import FormTemplatesPage from '../FormTemplates';

const baseTpl: FormTemplateResponse = {
  id: 'tpl-1',
  site_id: 'site-1',
  name: 'Contact form',
  description: 'Standard contact form',
  icon: 'contact_mail',
  fields: [
    { label: 'Email', field_type: 'email', is_required: true, display_order: 0, validation: {}, placeholder: null, help_text: null, options: null },
    { label: 'Message', field_type: 'textarea', is_required: true, display_order: 1, validation: {}, placeholder: null, help_text: null, options: null },
  ],
  consent_required: false,
  consent_text: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const empty: Paginated<FormTemplateResponse> = {
  data: [],
  meta: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
};
const one: Paginated<FormTemplateResponse> = {
  data: [baseTpl],
  meta: { page: 1, page_size: 10, total_items: 1, total_pages: 1 },
};

describe('FormTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when no templates exist', async () => {
    vi.mocked(getFormTemplates).mockResolvedValue(empty);
    renderWithProviders(<FormTemplatesPage />);
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument());
  });

  it('renders templates with name, description, and field count', async () => {
    vi.mocked(getFormTemplates).mockResolvedValue(one);
    renderWithProviders(<FormTemplatesPage />);
    await waitFor(() => expect(screen.getByText('Contact form')).toBeInTheDocument());
    expect(screen.getByText('Standard contact form')).toBeInTheDocument();
    // Field count column
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens the create-template dialog when the header button is clicked', async () => {
    vi.mocked(getFormTemplates).mockResolvedValue(empty);
    const user = userEvent.setup();
    renderWithProviders(<FormTemplatesPage />);
    await user.click(await screen.findByTestId('forms.templates.btn.create'));
    expect(await screen.findByTestId('forms.template.dialog')).toBeInTheDocument();
  });
});
