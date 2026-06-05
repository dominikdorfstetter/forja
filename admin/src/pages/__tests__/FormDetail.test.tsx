import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { deleteForm, getForm, updateForm } from '@/services/forms';
import type { FormDetailResponse } from '@/types/api';

const mockNavigate = vi.fn();
vi.mock('react-router', async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'form-1' }),
  };
});

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

import FormDetailPage from '../FormDetail';

const baseForm: FormDetailResponse = {
  id: 'form-1',
  site_id: 'site-1',
  name: 'Contact',
  slug: 'contact',
  description: 'Reach us',
  is_active: true,
  consent_required: false,
  consent_text: null,
  bot_protection: 'none',
  storage_mode: 'simple',
  retention_days: null,
  fields: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('FormDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getForm).mockResolvedValue(baseForm);
  });

  it('renders the form name, slug, and description on the Settings tab', async () => {
    renderWithProviders(<FormDetailPage />);
    await waitFor(() =>
      expect(screen.getByDisplayValue('Contact')).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue('contact')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Reach us')).toBeInTheDocument();
  });

  it('saves edits via updateForm when the save bar is clicked', async () => {
    vi.mocked(updateForm).mockResolvedValue({ ...baseForm, name: 'Contact Us' });
    const user = userEvent.setup();

    renderWithProviders(<FormDetailPage />);

    const nameField = await screen.findByDisplayValue('Contact');
    await user.clear(nameField);
    await user.type(nameField, 'Contact Us');

    const saveBtn = await screen.findByTestId('forms.detail.save');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updateForm).toHaveBeenCalledWith(
        'form-1',
        expect.objectContaining({ name: 'Contact Us' }),
      );
    });
  });

  it('switches to the Fields tab, adds a field, and saves it via updateForm with the fields array', async () => {
    vi.mocked(updateForm).mockResolvedValue(baseForm);
    const user = userEvent.setup();
    renderWithProviders(<FormDetailPage />);

    await user.click(await screen.findByTestId('forms.detail.tab.fields'));
    await user.click(await screen.findByTestId('forms.fields.btn.add'));
    await user.click(await screen.findByTestId('forms.fields.type.text'));

    await user.click(await screen.findByTestId('forms.detail.save'));

    await waitFor(() => {
      expect(updateForm).toHaveBeenCalledWith(
        'form-1',
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({ field_type: 'text', display_order: 0 }),
          ]),
        }),
      );
    });
  });

  it('confirms delete and navigates back to /forms after success', async () => {
    vi.mocked(deleteForm).mockResolvedValue();
    const user = userEvent.setup();
    renderWithProviders(<FormDetailPage />);

    await user.click(await screen.findByTestId('forms.detail.btn.delete'));
    await user.click(await screen.findByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(deleteForm).toHaveBeenCalledWith('form-1');
      expect(mockNavigate).toHaveBeenCalledWith('/forms');
    });
  });
});
