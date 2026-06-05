import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import type { AiUsageResponse } from '@/types/api';

// Default to "admin" role; individual tests override.
const ROLE = { current: 'admin' as 'admin' | 'editor' | 'owner' | 'author' | 'viewer' };

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({
    context: {
      current_user_role: ROLE.current,
      member_count: 1,
      features: { editorial_workflow: false, scheduling: true, versioning: true, analytics: false },
      suggestions: { show_team_workflow_prompt: false },
      modules: { ai: true, blog: true, pages: true, portfolio: false, legal: false, documents: false, forms: false },
      integration: {},
    },
    modules: { ai: true, blog: true, pages: true, portfolio: false, legal: false, documents: false, forms: false },
    isLoading: false,
  }),
}));

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: { id: 'site-1', name: 'Test', slug: 't', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { exportAiUsageCsv, getAiUsage } from '@/services/ai';
let AiUsagePage: typeof import('../AiUsagePage').default;

const sampleResponse: AiUsageResponse = {
  group_by: 'action',
  own_only: false,
  buckets: [
    { key: 'seo', call_count: 12, input_tokens: 1200, output_tokens: 800 },
    { key: 'translate', call_count: 5, input_tokens: 600, output_tokens: 400 },
  ],
  items: [
    {
      id: 'a',
      site_id: 'site-1',
      actor_id: 'u1',
      action: 'seo',
      provider: 'openai',
      model: 'gpt-4o',
      input_tokens: 100,
      output_tokens: 80,
      created_at: '2026-05-13T10:00:00Z',
    },
  ],
};

beforeEach(async () => {
  vi.clearAllMocks();
  ROLE.current = 'admin';
  vi.mocked(getAiUsage).mockResolvedValue(sampleResponse);
  vi.mocked(exportAiUsageCsv).mockResolvedValue(
    'id,site_id,actor_id,action,provider,model,input_tokens,output_tokens,created_at\n',
  );
  const mod = await import('../AiUsagePage');
  AiUsagePage = mod.default;
});

describe('AiUsagePage', () => {
  it('renders aggregated buckets and the recent-calls table', async () => {
    renderWithProviders(<AiUsagePage />);

    await waitFor(() => {
      expect(screen.getByTestId('ai-usage.bucket.seo')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ai-usage.bucket.translate')).toBeInTheDocument();
    // Recent calls table renders the row's action
    expect(screen.getAllByText('seo').length).toBeGreaterThan(0);
  });

  it('shows export button for admin and hides it for editor', async () => {
    renderWithProviders(<AiUsagePage />);
    await waitFor(() => {
      expect(screen.getByTestId('ai-usage.btn.export')).toBeInTheDocument();
    });

    ROLE.current = 'editor';
    const mod = await import('../AiUsagePage');
    const EditorPage = mod.default;
    renderWithProviders(<EditorPage />);
    // The first render's button still exists in the DOM (jsdom doesn't tear it down between renders),
    // but querying just the second tree by its container is awkward — assert by count instead.
    // After the second render, there's still exactly 1 export button (from the admin tree).
    expect(screen.queryAllByTestId('ai-usage.btn.export')).toHaveLength(1);
  });

  it('shows the own-only banner when the server scopes the response', async () => {
    vi.mocked(getAiUsage).mockResolvedValue({ ...sampleResponse, own_only: true });

    renderWithProviders(<AiUsagePage />);
    await waitFor(() => {
      expect(screen.getByTestId('ai-usage.alert.own-only')).toBeInTheDocument();
    });
  });
});
