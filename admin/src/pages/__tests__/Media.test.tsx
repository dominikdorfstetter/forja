import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { getMedia, getMediaFolders } from '@/services/media';
import type { Paginated, MediaListItem } from '@/types/api';

// Mock store hooks
const mockAuth = {
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
};

vi.mock('@/components/media/MediaDetailDialog', () => ({
  default: () => null,
}));

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
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  notifySelectedSiteChanged: vi.fn(),
}));

const mockMediaFile: MediaListItem = {
  id: 'media-1',
  filename: 'abc123.jpg',
  original_filename: 'photo.jpg',
  mime_type: 'image/jpeg',
  file_size: 1048576,
  public_url: 'https://cdn.example.com/photo.jpg',
  width: 1920,
  height: 1080,
  is_global: false,
  focal_x: 0.5,
  focal_y: 0.5,
  created_at: '2025-06-01T00:00:00Z',
  tags: [],
  has_alt_text: false,
};

const mockMediaFile2: MediaListItem = {
  id: 'media-2',
  filename: 'def456.pdf',
  original_filename: 'document.pdf',
  mime_type: 'application/pdf',
  file_size: 2097152,
  is_global: false,
  focal_x: 0.5,
  focal_y: 0.5,
  created_at: '2025-07-01T00:00:00Z',
  tags: [],
  has_alt_text: false,
};

const mockPaginatedMedia: Paginated<MediaListItem> = {
  data: [mockMediaFile, mockMediaFile2],
  meta: { page: 1, page_size: 25, total_items: 2, total_pages: 1 },
};

const emptyPaginated: Paginated<MediaListItem> = {
  data: [],
  meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
};

let MediaPage: typeof import('@/pages/Media').default;

beforeEach(async () => {
  vi.clearAllMocks();
  mockAuth.canWrite = true;
  mockAuth.isAdmin = true;
  vi.mocked(getMediaFolders).mockResolvedValue([]);
  const mod = await import('@/pages/Media');
  MediaPage = mod.default;
});

describe('MediaPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(getMedia).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MediaPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders media cards after data loads', async () => {
    vi.mocked(getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
  });

  it('shows file size information', async () => {
    vi.mocked(getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    // 1048576 bytes = 1.0 MB
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
    // 2097152 bytes = 2.0 MB
    expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();
  });

  it('shows empty state when no media', async () => {
    vi.mocked(getMedia).mockResolvedValue(emptyPaginated);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('opens upload dialog on upload button click', async () => {
    vi.mocked(getMedia).mockResolvedValue(emptyPaginated);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const user = userEvent.setup();
    const addButtons = screen.getAllByRole('button');
    const uploadButton = addButtons.find(
      (b) => b.textContent?.includes('Upload') || b.textContent?.includes('upload'),
    );
    expect(uploadButton).toBeDefined();
    await user.click(uploadButton!);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows delete button for admin users', async () => {
    vi.mocked(getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/ });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('opens delete confirm on delete icon click', async () => {
    vi.mocked(getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    // The action strip hides behind a CSS :hover state; jsdom does not
    // simulate hover, so we bypass the pointer-events: none guard rather
    // than fight the style.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const mediaCard = screen.getByText('photo.jpg').closest('[data-testid="media-item"]');
    expect(mediaCard).not.toBeNull();
    const deleteButton = (mediaCard as HTMLElement).querySelector('button[aria-label="Delete"]');
    expect(deleteButton).not.toBeNull();
    await user.click(deleteButton!);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows error alert when API fails', async () => {
    vi.mocked(getMedia).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('renders MIME category filter chips', async () => {
    vi.mocked(getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    // Design-system Chip renders as a plain <button> with aria-pressed;
    // look for the three MIME category labels directly (en locale).
    expect(screen.getAllByText(/images/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/videos/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^audio$/i).length).toBeGreaterThan(0);
  });

  it('hides secondary metadata on the card for a decluttered list view', async () => {
    // M3 Expressive rework: mime chip, dimensions, and tag chips moved to the
    // detail dialog — the card surfaces only filename + "size · date".
    vi.mocked(getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    expect(screen.queryByText('1920x1080')).not.toBeInTheDocument();
  });
});
