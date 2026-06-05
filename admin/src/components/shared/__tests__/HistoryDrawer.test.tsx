import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { getEntityAuditLogs, getEntityChangeHistory } from '@/services/audit';
import HistoryDrawer from '../HistoryDrawer';

vi.mock('@/store/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAdmin: true,
    isMaster: false,
  })),
}));

describe('HistoryDrawer', () => {
  beforeEach(() => {
    vi.mocked(getEntityAuditLogs).mockResolvedValue([]);
    vi.mocked(getEntityChangeHistory).mockResolvedValue([]);
  });

  it('renders the drawer with History title when open', () => {
    renderWithProviders(
      <HistoryDrawer open onClose={vi.fn()} entityType="blog" entityId="123" />,
    );
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderWithProviders(
      <HistoryDrawer open={false} onClose={vi.fn()} entityType="blog" entityId="123" />,
    );
    // MUI Drawer with open=false still mounts but hides the content
    // The title should not be visible
    expect(screen.queryByText('History')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <HistoryDrawer open onClose={onClose} entityType="blog" entityId="123" />,
    );

    // The close button is an IconButton with CloseIcon
    const closeButton = screen.getByRole('button');
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('passes correct entity props to EntityHistoryPanel', () => {
    renderWithProviders(
      <HistoryDrawer open onClose={vi.fn()} entityType="page" entityId="456" />,
    );
    // The panel makes API calls with the correct entity params
    expect(getEntityAuditLogs).toHaveBeenCalledWith('page', '456');
    expect(getEntityChangeHistory).toHaveBeenCalledWith('page', '456');
  });
});
