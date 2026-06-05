import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { getSiteSettings, updateSiteSettings } from '@/services/sites';
import ModulesTab from '../ModulesTab';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const baseSettings = {
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

describe('ModulesTab — Forms toggle (#590)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSiteSettings).mockResolvedValue(baseSettings);
    vi.mocked(updateSiteSettings).mockResolvedValue(baseSettings);
  });

  it('renders the Forms toggle in the modules list, defaulted off', async () => {
    renderWithProviders(<ModulesTab />);

    // The toggle field is wired by data-testid="settings.modules.<key>".
    const toggle = await screen.findByTestId('settings.modules.module_forms_enabled');
    expect(toggle).toBeInTheDocument();

    // The inner <input type="checkbox"> reflects the current value
    const input = toggle.querySelector('input[type="checkbox"]');
    expect(input).not.toBeNull();
    expect((input as HTMLInputElement).checked).toBe(false);
  });

  it('mirrors saved state when the form module is already enabled', async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({
      ...baseSettings,
      module_forms_enabled: true,
    });

    renderWithProviders(<ModulesTab />);

    await waitFor(() => {
      const input = screen
        .getByTestId('settings.modules.module_forms_enabled')
        .querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(input.checked).toBe(true);
    });
  });
});
