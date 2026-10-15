import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { getFavicon, getSite, getSiteSettings, updateSiteSettings, uploadFavicon } from '@/services/sites';
import type { FaviconResponse, Site, SiteSettingsResponse } from '@/types/api';
import FaviconPage from '../FaviconPage';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const settings = {
  theme_color: '#112233',
  background_color: '#ffffff',
  max_media_file_size: 1_048_576,
} as SiteSettingsResponse;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSiteSettings).mockResolvedValue(settings);
  vi.mocked(getSite).mockResolvedValue({ favicon_url: null } as unknown as Site);
  vi.mocked(updateSiteSettings).mockResolvedValue(settings);
});

describe('FaviconPage', () => {
  it('shows the saved colours and the "no favicon yet" hint', async () => {
    renderWithProviders(<FaviconPage />);

    await waitFor(() => expect(screen.getByTestId('site-settings.favicon.theme-color').querySelector('input')).toHaveValue('#112233'));
    expect(screen.getByText(/no favicon package generated yet/i)).toBeInTheDocument();
  });

  it('saves edited colours through the save bar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FaviconPage />);

    const themeInput = await waitFor(() => {
      const input = screen.getByTestId('site-settings.favicon.theme-color').querySelector('input');
      expect(input).toHaveValue('#112233');
      return input!;
    });
    fireEvent.change(themeInput, { target: { value: '#445566' } });

    await user.click(await screen.findByTestId('site-settings.favicon.save-colors'));

    await waitFor(() => {
      expect(updateSiteSettings).toHaveBeenCalledWith('site-1', { theme_color: '#445566', background_color: '#ffffff' });
    });
  });

  it('refuses source images over the site upload limit', async () => {
    renderWithProviders(<FaviconPage />);
    await screen.findByTestId('site-settings.favicon.dropzone');

    const big = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 2 * 1_048_576 });
    fireEvent.change(screen.getByLabelText('Select File'), { target: { files: [big] } });

    expect(await screen.findByText('File too large (max 1 MB)')).toBeInTheDocument();
    expect(uploadFavicon).not.toHaveBeenCalled();
  });

  it('lists generated variants and the head snippet once a favicon exists', async () => {
    vi.mocked(getSite).mockResolvedValue({ favicon_url: 'https://cdn.test/favicon.ico' } as unknown as Site);
    vi.mocked(getFavicon).mockResolvedValue({
      variants: [{ name: 'favicon-32x32.png', url: 'https://cdn.test/32.png', width: 32, height: 32 }],
      head_snippet: '<link rel="icon" href="/favicon.ico">',
    } as unknown as FaviconResponse);

    renderWithProviders(<FaviconPage />);

    expect(await screen.findByTestId('site-settings.favicon.variant')).toHaveTextContent('favicon-32x32.png');
    expect(screen.getByTestId('site-settings.favicon.snippet-preview')).toHaveTextContent('<link rel="icon" href="/favicon.ico">');
    expect(screen.queryByText(/no favicon package generated yet/i)).not.toBeInTheDocument();
  });
});
