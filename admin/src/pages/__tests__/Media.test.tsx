import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import apiService from '@/services/api';
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
  created_at: '2025-06-01T00:00:00Z',
};

const mockMediaFile2: MediaListItem = {
  id: 'media-2',
  filename: 'def456.pdf',
  original_filename: 'document.pdf',
  mime_type: 'application/pdf',
  file_size: 2097152,
  is_global: false,
  created_at: '2025-07-01T00:00:00Z',
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
  vi.mocked(apiService.getMediaFolders).mockResolvedValue([]);
  const mod = await import('@/pages/Media');
  MediaPage = mod.default;
});

describe('MediaPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(apiService.getMedia).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MediaPage />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders media cards after data loads', async () => {
    vi.mocked(apiService.getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
  });

  it('shows file size information', async () => {
    vi.mocked(apiService.getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    // 1048576 bytes = 1.0 MB
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();
    // 2097152 bytes = 2.0 MB
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('shows empty state when no media', async () => {
    vi.mocked(apiService.getMedia).mockResolvedValue(emptyPaginated);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThan(0);
  });

  it('opens upload dialog on upload button click', async () => {
    vi.mocked(apiService.getMedia).mockResolvedValue(emptyPaginated);
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
    vi.mocked(apiService.getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('[data-testid="DeleteIcon"]'),
    );
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('opens delete confirm on delete icon click', async () => {
    vi.mocked(apiService.getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    const user = userEvent.setup();
    // Find delete buttons within media cards (not the folder tree)
    const mediaCard = screen.getByText('photo.jpg').closest('.MuiCard-root');
    expect(mediaCard).not.toBeNull();
    const deleteButton = mediaCard!.querySelector('[data-testid="DeleteIcon"]')?.closest('button');
    expect(deleteButton).not.toBeNull();
    await user.click(deleteButton!);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows error alert when API fails', async () => {
    vi.mocked(apiService.getMedia).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('renders MIME category filter chips', async () => {
    vi.mocked(apiService.getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    // Should have filter category chips visible
    const chips = screen.getAllByRole('button').filter(
      (b) => b.classList.contains('MuiChip-root'),
    );
    expect(chips.length).toBeGreaterThanOrEqual(4); // images, videos, audio, documents
  });

  it('displays image dimensions when available', async () => {
    vi.mocked(apiService.getMedia).mockResolvedValue(mockPaginatedMedia);
    renderWithProviders(<MediaPage />);
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
    expect(screen.getByText('1920x1080')).toBeInTheDocument();
  });
});
