import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import {
  createMediaMetadata,
  getMediaById,
  getMediaMetadata,
  getMediaTags,
  getMediaUsage,
  getSiteTags,
} from '@/services/media';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings } from '@/services/sites';
import type { MediaListItem, MediaResponse, MediaUsageResponse, SiteLocaleResponse, SiteSettingsResponse } from '@/types/api';
import MediaDetailDialog from '../MediaDetailDialog';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const media = {
  id: 'media-1',
  original_filename: 'cat.jpg',
  mime_type: 'image/jpeg',
  file_size: 1024 * 1024,
  width: 800,
  height: 600,
  public_url: null,
  folder_id: 'folder-b',
  focal_x: null,
  focal_y: null,
} as unknown as MediaListItem;

const folders = [
  { id: 'folder-a', name: 'Alpha', parent_id: null, display_order: 0 },
  { id: 'folder-b', name: 'Beta', parent_id: null, display_order: 1 },
] as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSiteSettings).mockResolvedValue({ module_ai_enabled: false } as SiteSettingsResponse);
  vi.mocked(getSiteLocales).mockResolvedValue([
    { locale_id: 'loc-en', code: 'en', name: 'English', native_name: 'English', direction: 'Ltr', is_active: true, is_default: true, created_at: 't' },
  ] as SiteLocaleResponse[]);
  vi.mocked(getMediaMetadata).mockResolvedValue([]);
  vi.mocked(getMediaTags).mockResolvedValue({ tags: ['pets'] } as never);
  vi.mocked(getSiteTags).mockResolvedValue({ tags: [] } as never);
  vi.mocked(getMediaById).mockResolvedValue({ variants: [] } as unknown as MediaResponse);
  vi.mocked(getMediaUsage).mockResolvedValue({
    references: [{ content_type: 'blog', content_id: 'b1', title: 'Cat post', usage: 'featured' }],
    usage_count: 1,
  } as unknown as MediaUsageResponse);
  vi.mocked(createMediaMetadata).mockResolvedValue({} as never);
});

function renderDialog() {
  return renderWithProviders(<MediaDetailDialog open media={media} folders={folders} onClose={vi.fn()} />);
}

describe('MediaDetailDialog', () => {
  it('renders nothing without a media file', () => {
    renderWithProviders(<MediaDetailDialog open={false} media={null} folders={folders} onClose={vi.fn()} />);
    expect(screen.queryByTestId('media-detail.dialog')).not.toBeInTheDocument();
  });

  it('shows file info and seeds the folder selector from the file', async () => {
    renderDialog();
    const dialog = await screen.findByTestId('media-detail.dialog');
    expect(within(dialog).getByText('cat.jpg')).toBeInTheDocument();
    expect(within(dialog).getByText('1.0 MB')).toBeInTheDocument();
    expect(within(dialog).getByText('800 × 600')).toBeInTheDocument();
    // Select shows the file's current folder (menu options aren't rendered until opened)
    expect(within(dialog).getByText('Beta')).toBeInTheDocument();
    expect(within(dialog).queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('saves new per-locale metadata from the Metadata tab', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole('tab', { name: 'Metadata' }));
    await screen.findByRole('tab', { name: 'EN' });
    await user.type(screen.getByLabelText('Alt Text'), 'A sleepy cat');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(createMediaMetadata).toHaveBeenCalledWith('media-1', {
        locale_id: 'loc-en',
        alt_text: 'A sleepy cat',
        caption: undefined,
        title: undefined,
      });
    });
  });

  it('shows the empty variants note and the usage references', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole('tab', { name: 'Variants' }));
    expect(await screen.findByText('No variants available')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Usage' }));
    expect(await screen.findByText('Cat post')).toBeInTheDocument();
    expect(screen.getByText('featured')).toBeInTheDocument();
  });
});
