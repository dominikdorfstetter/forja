import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { getLegalDocuments } from '@/services/legal';
import type { LegalDocumentResponse, Paginated } from '@/types/api';
import LegalPicker from '../LegalPicker';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test Site', slug: 'test-site', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [],
    isLoading: false,
  }),
}));

const mockDocs: LegalDocumentResponse[] = [
  { id: 'legal-1', cookie_name: 'privacy_policy', slug: 'privacy-policy', document_type: 'PrivacyPolicy', status: 'Published', version: 1, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  { id: 'legal-2', cookie_name: 'imprint', slug: null, document_type: 'Imprint', status: 'Draft', version: 1, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  { id: 'legal-3', cookie_name: 'cookie_consent', slug: 'cookie-consent', document_type: 'CookieConsent', status: 'Published', version: 1, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
];

const paginatedResponse: Paginated<LegalDocumentResponse> = {
  data: mockDocs,
  meta: { page: 1, page_size: 50, total_items: 3, total_pages: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLegalDocuments).mockResolvedValue(paginatedResponse);
});

describe('LegalPicker', () => {
  it('renders with label and placeholder', () => {
    renderWithProviders(<LegalPicker value="" onChange={vi.fn()} />);
    expect(screen.getByTestId('legal-picker')).toBeInTheDocument();
    expect(screen.getByLabelText(/select a legal document/i)).toBeInTheDocument();
  });

  it('emits the document id when a document is selected', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<LegalPicker value="" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('privacy-policy'));

    expect(onChange).toHaveBeenCalledWith('legal-1');
  });

  it('resolves the selected option from a document id value', async () => {
    renderWithProviders(<LegalPicker value="legal-1" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue('privacy-policy');
    });
  });

  it('falls back to cookie_name as label when a document has no slug', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LegalPicker value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByText('imprint')).toBeInTheDocument();
  });

  it('hides CookieConsent documents — they are not navigable pages', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LegalPicker value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));

    await screen.findByText('privacy-policy');
    expect(screen.queryByText('cookie-consent')).not.toBeInTheDocument();
  });
});
