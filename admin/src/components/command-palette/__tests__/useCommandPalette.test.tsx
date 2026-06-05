import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { getBlogs } from '@/services/blogs';
import { getMedia } from '@/services/media';
import { getPages } from '@/services/pages';
import { useCommandPalette, type Command } from '../useCommandPalette';

// Mock AuthContext
vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    isAdmin: true,
    canWrite: true,
    canManageMembers: true,
    isOwner: false,
    isMaster: false,
    canRead: true,
    canEditAll: true,
    currentSiteRole: 'admin',
    clerkUserId: 'clerk-user-1',
  }),
}));

// Mock SiteContext
vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site' },
    sites: [{ id: 'site-1', name: 'Test Site' }],
    isLoading: false,
  }),
}));

// Mock react-router
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const navCommands: Command[] = [
  { id: 'nav:blogs', label: 'Blogs', category: 'navigation', action: vi.fn() },
  { id: 'nav:pages', label: 'Pages', category: 'navigation', action: vi.fn() },
];

const contextCommands: Command[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockPaginatedResponse(data: any[]) {
  return { data, meta: { page: 1, page_size: 5, total_items: data.length, total_pages: 1 } };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function setupSearchMocks() {
  vi.mocked(getBlogs).mockResolvedValue(mockPaginatedResponse([]));
  vi.mocked(getPages).mockResolvedValue(mockPaginatedResponse([]));
  vi.mocked(getMedia).mockResolvedValue(mockPaginatedResponse([]));
}

/** Open palette, type query, wait for debounce + React Query to settle */
async function typeAndWait(result: { current: ReturnType<typeof useCommandPalette> }, query: string) {
  act(() => result.current.setOpen(true));
  act(() => result.current.setQuery(query));
  // Wait for the 300ms debounce + React Query to fire
  await act(async () => {
    await new Promise((r) => setTimeout(r, 350));
  });
}

describe('useCommandPalette — content search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes search parameter to getBlogs API call', async () => {
    setupSearchMocks();
    vi.mocked(getBlogs).mockResolvedValue(
      mockPaginatedResponse([{ id: 'b1', slug: 'hello-world', author: 'me' }]),
    );

    const { result } = renderHook(() =>
      useCommandPalette(navCommands, contextCommands, '/'),
      { wrapper: createWrapper() },
    );

    await typeAndWait(result, 'hello');

    await waitFor(() => {
      expect(getBlogs).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({ search: 'hello', page_size: 5 }),
      );
    });
  });

  it('passes search parameter to getPages API call', async () => {
    setupSearchMocks();
    vi.mocked(getPages).mockResolvedValue(
      mockPaginatedResponse([{ id: 'p1', route: '/about', slug: 'about', page_type: 'standard' }]),
    );

    const { result } = renderHook(() =>
      useCommandPalette(navCommands, contextCommands, '/'),
      { wrapper: createWrapper() },
    );

    await typeAndWait(result, 'about');

    await waitFor(() => {
      expect(getPages).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({ search: 'about', page_size: 5 }),
      );
    });
  });

  it('passes search parameter to getMedia API call', async () => {
    setupSearchMocks();
    vi.mocked(getMedia).mockResolvedValue(
      mockPaginatedResponse([{ id: 'm1', filename: 'logo.png', original_filename: 'logo.png', mime_type: 'image/png', file_size: 1024, is_global: false, created_at: '2025-01-01T00:00:00Z' }]),
    );

    const { result } = renderHook(() =>
      useCommandPalette(navCommands, contextCommands, '/'),
      { wrapper: createWrapper() },
    );

    await typeAndWait(result, 'logo');

    await waitFor(() => {
      expect(getMedia).toHaveBeenCalledWith(
        'site-1',
        expect.objectContaining({ search: 'logo', page_size: 5 }),
      );
    });
  });

  it('does not search when query has fewer than 2 characters', async () => {
    setupSearchMocks();
    const { result } = renderHook(() =>
      useCommandPalette(navCommands, contextCommands, '/'),
      { wrapper: createWrapper() },
    );

    await typeAndWait(result, 'a');

    expect(getBlogs).not.toHaveBeenCalled();
    expect(getPages).not.toHaveBeenCalled();
    expect(getMedia).not.toHaveBeenCalled();
  });

  it('does not search when palette is closed', async () => {
    setupSearchMocks();
    const { result } = renderHook(() =>
      useCommandPalette(navCommands, contextCommands, '/'),
      { wrapper: createWrapper() },
    );

    // Set query without opening palette
    act(() => result.current.setQuery('hello'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(getBlogs).not.toHaveBeenCalled();
  });

  it('includes media results in commands with correct category', async () => {
    setupSearchMocks();
    vi.mocked(getMedia).mockResolvedValue(
      mockPaginatedResponse([
        { id: 'm1', filename: 'photo.jpg', original_filename: 'photo.jpg', mime_type: 'image/jpeg', file_size: 2048, is_global: false, created_at: '2025-01-01T00:00:00Z' },
      ]),
    );

    const { result } = renderHook(() =>
      useCommandPalette(navCommands, contextCommands, '/'),
      { wrapper: createWrapper() },
    );

    await typeAndWait(result, 'photo');

    await waitFor(() => {
      const mediaCmd = result.current.commands.find((c) => c.id === 'media:m1');
      expect(mediaCmd).toBeDefined();
      expect(mediaCmd!.category).toBe('media');
      expect(mediaCmd!.label).toBe('photo.jpg');
    });
  });

  it('navigates to /media when selecting a media result', async () => {
    setupSearchMocks();
    vi.mocked(getMedia).mockResolvedValue(
      mockPaginatedResponse([
        { id: 'm1', filename: 'photo.jpg', original_filename: 'photo.jpg', mime_type: 'image/jpeg', file_size: 2048, is_global: false, created_at: '2025-01-01T00:00:00Z' },
      ]),
    );

    const { result } = renderHook(() =>
      useCommandPalette(navCommands, contextCommands, '/'),
      { wrapper: createWrapper() },
    );

    await typeAndWait(result, 'photo');

    await waitFor(() => {
      const mediaCmd = result.current.commands.find((c) => c.id === 'media:m1');
      expect(mediaCmd).toBeDefined();
    });

    const mediaCmd = result.current.commands.find((c) => c.id === 'media:m1')!;
    act(() => mediaCmd.action());
    expect(mockNavigate).toHaveBeenCalledWith('/media');
  });
});
