import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/test/test-utils';
import { getEntityAuditLogs, getEntityChangeHistory, revertChanges } from '@/services/audit';
import EntityHistoryPanel from '../EntityHistoryPanel';
import type { AuditLogEntry, ChangeHistoryEntry } from '@/types/api';

vi.mock('@/store/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAdmin: true,
    isMaster: false,
  })),
}));

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: null,
    sites: [],
    isLoading: false,
  }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { useAuth } from '@/store/AuthContext';

const ENTITY_TYPE = 'blog';
const ENTITY_ID = '550e8400-e29b-41d4-a716-446655440000';

const now = new Date('2026-03-21T12:00:00Z');

function makeAuditLog(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: crypto.randomUUID(),
    action: 'Update',
    entity_type: ENTITY_TYPE,
    entity_id: ENTITY_ID,
    created_at: now.toISOString(),
    ...overrides,
  };
}

function makeChange(
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
  offsetMs = 0,
): ChangeHistoryEntry {
  return {
    id: crypto.randomUUID(),
    entity_type: ENTITY_TYPE,
    entity_id: ENTITY_ID,
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue,
    changed_by: 'user-1',
    changed_at: new Date(now.getTime() + offsetMs).toISOString(),
  };
}

function renderPanel() {
  return renderWithProviders(
    <EntityHistoryPanel entityType={ENTITY_TYPE} entityId={ENTITY_ID} />,
  );
}

/** Find all MUI Chip labels to check which field names render as chips */
function getChipLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.MuiChip-label')).map(
    (el) => el.textContent ?? '',
  );
}

describe('EntityHistoryPanel', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isAdmin: true,
      isMaster: false,
    } as ReturnType<typeof useAuth>);
    vi.mocked(getEntityAuditLogs).mockReset();
    vi.mocked(getEntityChangeHistory).mockReset();
    vi.mocked(revertChanges).mockReset();
    vi.mocked(getEntityAuditLogs).mockResolvedValue([]);
    vi.mocked(getEntityChangeHistory).mockResolvedValue([]);
  });

  it('shows a loading spinner while fetching', () => {
    vi.mocked(getEntityAuditLogs).mockReturnValue(new Promise(() => {}));
    vi.mocked(getEntityChangeHistory).mockReturnValue(new Promise(() => {}));

    renderPanel();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty message when no history exists', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('No history recorded yet')).toBeInTheDocument();
    });
  });

  it('renders audit events when present', async () => {
    vi.mocked(getEntityAuditLogs).mockResolvedValue([
      makeAuditLog({ action: 'Create' }),
      makeAuditLog({ action: 'Update' }),
    ]);

    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('Events')).toBeInTheDocument();
      expect(screen.getByText('Create')).toBeInTheDocument();
      expect(screen.getByText('Update')).toBeInTheDocument();
    });
  });

  it('renders field changes and groups by timestamp (±2s)', async () => {
    const changes = [
      makeChange('blog_title', 'Old Title', 'New Title', 0),
      makeChange('blog_body', 'Old Body', 'New Body', 500), // within 2s → same group
      makeChange('blog_slug', 'old-slug', 'new-slug', 5000), // outside 2s → new group
    ];
    vi.mocked(getEntityChangeHistory).mockResolvedValue(changes);

    const { container } = renderPanel();
    await waitFor(() => {
      expect(screen.getByText('Field Changes')).toBeInTheDocument();
    });

    const chips = getChipLabels(container);
    expect(chips).toContain('blog_title');
    expect(chips).toContain('blog_body');
    expect(chips).toContain('blog_slug');

    // First two should be in the same group (same accordion), third in a different one
    const accordions = container.querySelectorAll('.MuiAccordion-root');
    expect(accordions).toHaveLength(2);

    // First accordion has 2 chips (blog_title + blog_body), second has 1 (blog_slug)
    const firstChips = getChipLabels(accordions[0] as HTMLElement);
    expect(firstChips).toContain('blog_title');
    expect(firstChips).toContain('blog_body');

    const secondChips = getChipLabels(accordions[1] as HTMLElement);
    expect(secondChips).toContain('blog_slug');
  });

  it('filters out system fields', async () => {
    const changes = [
      makeChange('description', 'Old', 'New', 0),
      makeChange('updated_at', '2026-01-01', '2026-03-21', 100),
      makeChange('created_by', 'a', 'b', 200),
    ];
    vi.mocked(getEntityChangeHistory).mockResolvedValue(changes);

    const { container } = renderPanel();
    await waitFor(() => {
      const chips = getChipLabels(container);
      expect(chips).toContain('description');
    });

    const chips = getChipLabels(container);
    expect(chips).not.toContain('updated_at');
    expect(chips).not.toContain('created_by');
  });

  it('shows revert buttons for admin users', async () => {
    vi.mocked(getEntityChangeHistory).mockResolvedValue([
      makeChange('description', 'Old', 'New'),
    ]);

    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('Revert')).toBeInTheDocument();
    });
  });

  it('hides revert buttons for non-admin users', async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAdmin: false,
      isMaster: false,
    } as ReturnType<typeof useAuth>);

    vi.mocked(getEntityChangeHistory).mockResolvedValue([
      makeChange('description', 'Old', 'New'),
    ]);

    const { container } = renderPanel();
    await waitFor(() => {
      const chips = getChipLabels(container);
      expect(chips).toContain('description');
    });
    expect(screen.queryByText('Revert')).not.toBeInTheDocument();
  });

  it('opens confirmation dialog on revert click', async () => {
    const user = userEvent.setup();
    vi.mocked(getEntityChangeHistory).mockResolvedValue([
      makeChange('description', 'Old Value', 'New Value'),
    ]);

    renderPanel();

    // Wait for content, then expand the accordion via the summary button
    await waitFor(() => {
      expect(screen.getByText('Field Changes')).toBeInTheDocument();
    });
    const accordionBtn = screen.getByRole('button', { expanded: false });
    await user.click(accordionBtn);

    const revertBtn = await screen.findByText('Revert');
    await user.click(revertBtn);

    await waitFor(() => {
      expect(screen.getByTestId('entity-history-revert.dialog')).toBeInTheDocument();
      expect(screen.getByText('Revert Changes')).toBeInTheDocument();
      expect(screen.getByText('Revert the following fields to their previous values?')).toBeInTheDocument();
    });
  });

  it('calls revertChanges API on confirm', async () => {
    const user = userEvent.setup();
    const changeId = crypto.randomUUID();
    vi.mocked(getEntityChangeHistory).mockResolvedValue([
      { ...makeChange('description', 'Old', 'New'), id: changeId },
    ]);
    vi.mocked(revertChanges).mockResolvedValue({
      entity_type: ENTITY_TYPE,
      entity_id: ENTITY_ID,
      fields_reverted: ['description'],
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Field Changes')).toBeInTheDocument();
    });

    const accordionBtn = screen.getByRole('button', { expanded: false });
    await user.click(accordionBtn);
    const revertBtn = await screen.findByText('Revert');
    await user.click(revertBtn);

    const submitBtn = await screen.findByTestId('entity-history-revert.btn.submit');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(revertChanges).toHaveBeenCalledWith([changeId]);
    });
  });

  it('closes dialog on cancel without calling API', async () => {
    const user = userEvent.setup();
    vi.mocked(getEntityChangeHistory).mockResolvedValue([
      makeChange('description', 'Old', 'New'),
    ]);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Field Changes')).toBeInTheDocument();
    });

    const accordionBtn = screen.getByRole('button', { expanded: false });
    await user.click(accordionBtn);
    const revertBtn = await screen.findByText('Revert');
    await user.click(revertBtn);

    const cancelBtn = await screen.findByTestId('entity-history-revert.btn.cancel');
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('entity-history-revert.dialog')).not.toBeInTheDocument();
    });
    expect(revertChanges).not.toHaveBeenCalled();
  });
});
