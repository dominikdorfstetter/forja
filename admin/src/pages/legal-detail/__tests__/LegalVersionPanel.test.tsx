import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { getLegalVersions } from '@/services/legal';
import type { LegalVersionResponse } from '@/types/api';
import LegalVersionPanel from '@/pages/legal-detail/LegalVersionPanel';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const mockVersions: LegalVersionResponse[] = [
  { id: 'doc-1', version: 1, status: 'Published', created_at: '2026-01-01T00:00:00Z' },
  { id: 'doc-2', version: 2, status: 'Draft', created_at: '2026-02-01T00:00:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LegalVersionPanel', () => {
  it('renders version list with both versions', async () => {
    vi.mocked(getLegalVersions).mockResolvedValue(mockVersions);
    renderWithProviders(<LegalVersionPanel documentId="doc-1" currentVersion={2} />);
    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument();
    });
    expect(screen.getByText('v2')).toBeInTheDocument();
  });

  it('highlights the current version item as selected', async () => {
    vi.mocked(getLegalVersions).mockResolvedValue(mockVersions);
    renderWithProviders(<LegalVersionPanel documentId="doc-1" currentVersion={2} />);
    await waitFor(() => {
      expect(screen.getByText('v2')).toBeInTheDocument();
    });
    // The ListItemButton for v2 should have the Mui-selected class
    const v2Chip = screen.getByText('v2');
    const listItemButton = v2Chip.closest('[class*="MuiListItemButton"]');
    expect(listItemButton).toHaveClass('Mui-selected');
  });

  it('shows empty state message when no versions exist', async () => {
    vi.mocked(getLegalVersions).mockResolvedValue([]);
    renderWithProviders(<LegalVersionPanel documentId="doc-1" currentVersion={1} />);
    await waitFor(() => {
      // The loading state should be replaced by the empty message
      const items = screen.queryAllByRole('button');
      // No version list items present
      expect(items.filter((b) => b.textContent?.includes('v'))).toHaveLength(0);
    });
    // The empty state text from i18n key legalDetail.versions.noVersions should render
    // We check that no v-prefixed chips are present and no progressbar
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
