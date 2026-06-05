import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { getSiteSettings, updateSiteSettings } from '@/services/sites';
import ContentPage from '../ContentPage';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockSettings = {
  max_document_file_size: 10_485_760,
  max_media_file_size: 52_428_800,
  analytics_enabled: false,
  maintenance_mode: false,
  contact_email: '',
  editorial_workflow_enabled: false,
  preview_templates: [],
  document_password_min_length: 8,
  document_password_regex: '',
  module_blog_enabled: true,
  module_pages_enabled: true,
  module_portfolio_enabled: false,
  module_legal_enabled: false,
  module_documents_enabled: false,
  module_ai_enabled: false,
  module_forms_enabled: false,
  module_collections_enabled: false,
  robots_txt_rules: [],
  seo_title_template: '{{title}} | {{site_name}}',
  seo_default_description: '',
  seo_default_og_image_id: null,
  theme_color: '#ffffff',
  background_color: '#ffffff',
  code_injection_head: '',
  code_injection_footer: '',
  storage_quota_bytes: 1_073_741_824,
  allowed_origins: [],
};

describe('ContentPage — Maintenance Mode save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateSiteSettings).mockResolvedValue(mockSettings);
  });

  it('includes maintenance_mode in the save payload', async () => {
    const user = userEvent.setup();

    vi.mocked(getSiteSettings).mockResolvedValue({
      ...mockSettings,
      maintenance_mode: true,
    });

    renderWithProviders(<ContentPage />);

    // Make the form dirty first — the sticky save bar only renders while dirty.
    const passwordInput = await screen.findByLabelText(/min.*password.*length/i);
    await user.clear(passwordInput);
    await user.type(passwordInput, '12');

    const saveButton = await screen.findByTestId('site-settings.content.save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateSiteSettings).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({
          maintenance_mode: true,
        }),
      );
    });
  });
});

describe('ContentPage — Preview Templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateSiteSettings).mockResolvedValue(mockSettings);
  });

  it('excludes built-in templates from the save payload', async () => {
    const user = userEvent.setup();

    vi.mocked(getSiteSettings).mockResolvedValue({
      ...mockSettings,
      preview_templates: [
        { name: 'Blog', url: 'http://preview:4321', is_builtin: true },
        { name: 'Custom', url: 'http://localhost:3000', is_builtin: false },
      ],
    });

    renderWithProviders(<ContentPage />);

    // Make the form dirty first — the sticky save bar only renders while dirty.
    const passwordInput = await screen.findByLabelText(/min.*password.*length/i);
    await user.clear(passwordInput);
    await user.type(passwordInput, '12');

    const saveButton = await screen.findByTestId('site-settings.content.save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateSiteSettings).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({
          preview_templates: [{ name: 'Custom', url: 'http://localhost:3000' }],
        }),
      );
    });
  });
});
