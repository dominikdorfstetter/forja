import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import ContentEntityDialogs from '../ContentEntityDialogs';
import type { DialogsSlotProps } from '../types';

interface FakeItem {
  id: string;
  slug?: string;
  route?: string;
  cookie_name?: string;
}

function baseProps(overrides: Partial<DialogsSlotProps<FakeItem>> = {}): DialogsSlotProps<FakeItem> {
  return {
    rowState: {
      publishingItem: null,
      unpublishingItem: null,
      archivingItem: null,
      restoringItem: null,
    },
    rowActions: {
      openPublish: vi.fn(),
      openUnpublish: vi.fn(),
      openArchive: vi.fn(),
      openRestore: vi.fn(),
      closePublish: vi.fn(),
      closeUnpublish: vi.fn(),
      closeArchive: vi.fn(),
      closeRestore: vi.fn(),
    },
    bulkState: {
      bulkDeleteOpen: false,
      bulkPublishOpen: false,
      bulkUnpublishOpen: false,
      bulkArchiveOpen: false,
      bulkRestoreOpen: false,
    },
    bulkActions: {
      openBulkPublish: vi.fn(),
      openBulkUnpublish: vi.fn(),
      openBulkArchive: vi.fn(),
      openBulkRestore: vi.fn(),
      openBulkDelete: vi.fn(),
      closeAllBulk: vi.fn(),
    },
    bulkCount: 0,
    bulkLoading: false,
    onRowConfirmStatus: vi.fn(),
    onRowConfirmDelete: vi.fn(),
    onBulkConfirm: vi.fn(),
    deletingItem: null,
    onDeleteCancel: vi.fn(),
    deleteLoading: false,
    ...overrides,
  };
}

const blogsDescriptor = { i18nNamespace: 'blogs', identifierField: 'slug' as const, restore: 'publishOrDraft' as const };
const pagesDescriptor = { i18nNamespace: 'pages', identifierField: 'route' as const, restore: 'publishOrDraft' as const };
const legalDescriptor = { i18nNamespace: 'legal', identifierField: 'cookie_name' as const, restore: 'confirmDraft' as const };

describe('ContentEntityDialogs', () => {
  it('tracer: delete confirm shows the blog slug and confirms with the item', async () => {
    const user = userEvent.setup();
    const props = baseProps({ deletingItem: { id: 'b1', slug: 'my-post' } });
    renderWithProviders(<ContentEntityDialogs {...props} descriptor={blogsDescriptor} />);

    // Identifier resolved into the delete message via the slug field.
    expect(screen.getByText(/my-post/)).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(props.onRowConfirmDelete).toHaveBeenCalledWith(props.deletingItem);
  });

  it('resolves the identifier from route for pages', () => {
    const props = baseProps({ deletingItem: { id: 'p1', route: '/about-us' } });
    renderWithProviders(<ContentEntityDialogs {...props} descriptor={pagesDescriptor} />);
    expect(screen.getByText(/\/about-us/)).toBeInTheDocument();
  });

  it('resolves the identifier from cookie_name for legal', () => {
    const props = baseProps({ deletingItem: { id: 'l1', cookie_name: 'privacy_policy' } });
    renderWithProviders(<ContentEntityDialogs {...props} descriptor={legalDescriptor} />);
    expect(screen.getByText(/privacy_policy/)).toBeInTheDocument();
  });

  it('publish confirm sets Published status then closes', async () => {
    const user = userEvent.setup();
    const item = { id: 'b1', slug: 'my-post' };
    const props = baseProps({ rowState: { publishingItem: item, unpublishingItem: null, archivingItem: null, restoringItem: null } });
    renderWithProviders(<ContentEntityDialogs {...props} descriptor={blogsDescriptor} />);

    await user.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(props.onRowConfirmStatus).toHaveBeenCalledWith(item, 'Published');
    expect(props.rowActions.closePublish).toHaveBeenCalled();
  });

  it('publishOrDraft restore renders RestoreDialog with publish + draft actions', async () => {
    const user = userEvent.setup();
    const item = { id: 'b1', slug: 'my-post' };
    const props = baseProps({ rowState: { publishingItem: null, unpublishingItem: null, archivingItem: null, restoringItem: item } });
    renderWithProviders(<ContentEntityDialogs {...props} descriptor={blogsDescriptor} />);

    expect(screen.getByTestId('restore-dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('restore-dialog.btn.restore'));
    expect(props.onRowConfirmStatus).toHaveBeenCalledWith(item, 'Published');

    await user.click(screen.getByTestId('restore-dialog.btn.restore-draft'));
    expect(props.onRowConfirmStatus).toHaveBeenCalledWith(item, 'Draft');
  });

  it('confirmDraft restore (legal) renders a single confirm that restores to Draft', async () => {
    const user = userEvent.setup();
    const item = { id: 'l1', cookie_name: 'privacy_policy' };
    const props = baseProps({ rowState: { publishingItem: null, unpublishingItem: null, archivingItem: null, restoringItem: item } });
    renderWithProviders(<ContentEntityDialogs {...props} descriptor={legalDescriptor} />);

    // No publish/draft split — a plain confirm dialog.
    expect(screen.queryByTestId('restore-dialog')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(props.onRowConfirmStatus).toHaveBeenCalledWith(item, 'Draft');
  });

  it('bulk delete confirm dispatches the delete bulk action', async () => {
    const user = userEvent.setup();
    const props = baseProps({
      bulkCount: 3,
      bulkState: { bulkDeleteOpen: true, bulkPublishOpen: false, bulkUnpublishOpen: false, bulkArchiveOpen: false, bulkRestoreOpen: false },
    });
    renderWithProviders(<ContentEntityDialogs {...props} descriptor={blogsDescriptor} />);

    await user.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(props.onBulkConfirm).toHaveBeenCalledWith('delete');
  });
});
