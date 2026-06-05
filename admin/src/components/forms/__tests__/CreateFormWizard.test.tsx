import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { createForm, getFormTemplates } from '@/services/forms';
import type { FormDetailResponse, FormTemplateResponse, Paginated } from '@/types/api';

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

import CreateFormWizard from '../CreateFormWizard';

const emptyTemplates: Paginated<FormTemplateResponse> = {
  data: [],
  meta: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
};

const createdForm: FormDetailResponse = {
  id: 'form-99',
  site_id: 'site-1',
  name: 'Contact',
  slug: 'contact',
  description: null,
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

describe('CreateFormWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFormTemplates).mockResolvedValue(emptyTemplates);
    vi.mocked(createForm).mockResolvedValue(createdForm);
  });

  it('walks scratch → name+slug → create and calls onCreated with the new form id', async () => {
    const onCreated = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CreateFormWizard open onClose={() => {}} onCreated={onCreated} />,
    );

    // Step 1: pick "start from scratch".
    await waitFor(() =>
      expect(screen.getByTestId('forms.wizard.method.scratch')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('forms.wizard.method.scratch'));

    // Step 2: name field is visible; slug auto-fills from name.
    const nameInput = await screen.findByTestId('forms.wizard.field.name');
    await user.type(nameInput, 'Contact');

    // Submit — wait for createForm to fire and onCreated to receive the new id.
    const createBtn = screen.getByTestId('forms.wizard.btn.create');
    await user.click(createBtn);

    await waitFor(() => {
      expect(createForm).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({ name: 'Contact', slug: 'contact', template_id: undefined }),
      );
      expect(onCreated).toHaveBeenCalledWith('form-99');
    });
  });

  it('hides inactive templates from the picker', async () => {
    vi.mocked(getFormTemplates).mockResolvedValue({
      data: [
        {
          id: 'tpl-active', site_id: 'site-1', name: 'Active template', description: null, icon: null,
          fields: [], consent_required: false, consent_text: null, is_active: true,
          created_at: '', updated_at: '',
        },
        {
          id: 'tpl-inactive', site_id: 'site-1', name: 'Inactive template', description: null, icon: null,
          fields: [], consent_required: false, consent_text: null, is_active: false,
          created_at: '', updated_at: '',
        },
      ],
      meta: { page: 1, page_size: 10, total_items: 2, total_pages: 1 },
    });

    renderWithProviders(
      <CreateFormWizard open onClose={() => {}} onCreated={() => {}} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('forms.wizard.template.tpl-active')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('forms.wizard.template.tpl-inactive')).toBeNull();
  });

  it('disables the create button until name + slug are filled', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CreateFormWizard open onClose={() => {}} onCreated={() => {}} />,
    );

    await user.click(await screen.findByTestId('forms.wizard.method.scratch'));
    const createBtn = await screen.findByTestId('forms.wizard.btn.create');
    expect(createBtn).toBeDisabled();
  });
});
