import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { getSiteLocales } from '@/services/siteLocales';
import type { SiteLocaleResponse } from '@/types/api';
import ProjectWizard from '@/components/portfolio/ProjectWizard';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const enLocale = {
  site_id: 'site-1',
  locale_id: 'locale-en',
  is_default: true,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  code: 'en',
  name: 'English',
  native_name: 'English',
  direction: 'Ltr',
} as unknown as SiteLocaleResponse;

function setup(onSubmit = vi.fn()) {
  return {
    onSubmit,
    ...renderWithProviders(
      <ProjectWizard open project={null} onSubmit={onSubmit} onClose={vi.fn()} loading={false} />,
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSiteLocales).mockResolvedValue([enLocale]);
});

describe('ProjectWizard validation gating (#136)', () => {
  it('renders an editable slug field on the basics step', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByTestId('project-wizard.field.title')).toBeInTheDocument();
    });
    expect(screen.getByTestId('project-wizard.field.slug')).toBeInTheDocument();
  });

  it('blocks Next and surfaces the slug error when a non-Latin title yields an empty slug', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => {
      expect(screen.getByTestId('project-wizard.field.title')).toBeInTheDocument();
    });

    // A fully non-Latin title slugifies to an empty string — the wizard must
    // not silently advance past a required-but-invalid slug.
    const titleInput = screen.getByTestId('project-wizard.field.title').querySelector('input')!;
    await user.type(titleInput, 'Проект');

    await user.click(screen.getByTestId('project-wizard.btn.next'));

    // Still on the basics step (title field visible, not the content step),
    // with the slug error shown rather than a silent no-op.
    expect(screen.getByTestId('project-wizard.field.title')).toBeInTheDocument();
    const slugInput = screen.getByTestId('project-wizard.field.slug').querySelector('input')!;
    expect(slugInput).toBeInvalid();
  });

  it('lets the user recover by typing a valid slug, then advances', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => {
      expect(screen.getByTestId('project-wizard.field.title')).toBeInTheDocument();
    });

    const titleInput = screen.getByTestId('project-wizard.field.title').querySelector('input')!;
    await user.type(titleInput, 'Проект');
    const slugInput = screen.getByTestId('project-wizard.field.slug').querySelector('input')!;
    await user.clear(slugInput);
    await user.type(slugInput, 'my-project');

    await user.click(screen.getByTestId('project-wizard.btn.next'));

    // Advanced off the basics step: the start-date field is gone, the wizard
    // moved forward.
    await waitFor(() => {
      expect(screen.queryByTestId('project-wizard.field.start_date')).not.toBeInTheDocument();
    });
  });
});
