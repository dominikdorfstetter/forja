import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { createUiString, getUiStringEntries } from '@/services/uiStrings';
import { getSiteLocales } from '@/services/siteLocales';
import { localeDe, localeEn, localization, uiString } from './fixtures';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: {
      id: 'site-1',
      name: 'Test Site',
      slug: 'test-site',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import UiStringDetailPage from '../UiStringDetailPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSiteLocales).mockResolvedValue([localeEn, localeDe]);
});

// Full create journey with a real router: the list cache is seeded with the
// created row before navigating, so the detail route renders it immediately
// instead of flashing "not found" while the invalidated list refetches.
describe('UiStringDetailPage — create → detail journey', () => {
  it('shows the created string on the detail route without a not-found flash', async () => {
    const created = uiString({
      id: 'us-new',
      key: 'footer.tagline',
      localizations: [localization('l-new', 'loc-en', 'Built with Forja')],
    });
    vi.mocked(getUiStringEntries)
      .mockResolvedValueOnce([])
      // The post-create refetch is still in flight when the detail route
      // mounts — only the seeded cache can supply the row.
      .mockImplementation(() => new Promise(() => {}));
    vi.mocked(createUiString).mockResolvedValue(created);

    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/ui-strings/new" element={<UiStringDetailPage />} />
        <Route path="/ui-strings/:id" element={<UiStringDetailPage />} />
      </Routes>,
      { route: '/ui-strings/new' },
    );

    await user.type(await screen.findByTestId('ui-strings.field.key'), 'footer.tagline');
    await user.type(screen.getByTestId('ui-strings.field.value'), 'Built with Forja');
    await user.click(await screen.findByTestId('ui-strings.detail.save'));

    // The locale tabs only render once the detail route resolved the row.
    expect(await screen.findByTestId('ui-strings.tab.de')).toBeInTheDocument();
    expect(screen.getByTestId('ui-strings.field.key')).toHaveValue('footer.tagline');
    expect(screen.queryByText('This UI string does not exist.')).not.toBeInTheDocument();
  });
});
