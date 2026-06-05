import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import BulkActionToolbar from '../BulkActionToolbar';

const baseProps = {
  selectedCount: 3,
  onPublish: vi.fn(),
  onUnpublish: vi.fn(),
  onArchive: vi.fn(),
  onRestore: vi.fn(),
  onDelete: vi.fn(),
  onClear: vi.fn(),
};

describe('BulkActionToolbar — read-only gating', () => {
  it('hides every write action when canWrite=false and isAdmin=false', () => {
    renderWithProviders(<BulkActionToolbar {...baseProps} canWrite={false} isAdmin={false} />);

    expect(screen.queryByTestId('bulk-toolbar.btn.publish')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-toolbar.btn.unpublish')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-toolbar.btn.archive')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-toolbar.btn.restore')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-toolbar.btn.delete')).not.toBeInTheDocument();
  });

  it('still hides bulk-delete when canWrite=true but isAdmin=false (delete is admin-only)', () => {
    renderWithProviders(<BulkActionToolbar {...baseProps} canWrite isAdmin={false} />);

    expect(screen.queryByTestId('bulk-toolbar.btn.delete')).not.toBeInTheDocument();
  });

  it('renders publish + delete only when canWrite=true AND isAdmin=true', () => {
    renderWithProviders(<BulkActionToolbar {...baseProps} canWrite isAdmin />);

    expect(screen.getByTestId('bulk-toolbar.btn.publish')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-toolbar.btn.delete')).toBeInTheDocument();
  });
});
