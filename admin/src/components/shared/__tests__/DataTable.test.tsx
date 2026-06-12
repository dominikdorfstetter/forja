import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/test-utils';
import DataTable, { type DataTableColumn } from '../DataTable';

interface Item {
  id: string;
  name: string;
  status: string;
}

const items: Item[] = [
  { id: '1', name: 'First post', status: 'draft' },
  { id: '2', name: 'Second post', status: 'published' },
];

const columns: DataTableColumn<Item>[] = [
  { header: 'Name', render: (item) => item.name },
  { header: 'Status', render: (item) => item.status },
];

const baseProps = {
  data: items,
  columns,
  getRowKey: (item: Item) => item.id,
};

describe('DataTable (legacy)', () => {
  it('renders column headers and one row per item', () => {
    renderWithProviders(<DataTable {...baseProps} rowTestId="row" />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();

    const rows = screen.getAllByTestId('row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('First post')).toBeInTheDocument();
    expect(within(rows[1]).getByText('published')).toBeInTheDocument();
  });

  it('renders an accessible caption when provided', () => {
    renderWithProviders(<DataTable {...baseProps} caption="Blog posts" />);
    expect(screen.getByText('Blog posts')).toBeInTheDocument();
  });

  it('omits pagination unless meta and handlers are supplied', () => {
    renderWithProviders(<DataTable {...baseProps} testIdPrefix="posts" />);
    expect(screen.queryByTestId('posts.table.pagination')).not.toBeInTheDocument();
  });

  it('pages forward through the pagination controls', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderWithProviders(
      <DataTable
        {...baseProps}
        meta={{ total_items: 50, page: 1, page_size: 10 }}
        onPageChange={onPageChange}
        onRowsPerPageChange={vi.fn()}
        testIdPrefix="posts"
      />,
    );

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(expect.anything(), 1);
  });

  it('reports rows-per-page changes', async () => {
    const user = userEvent.setup();
    const onRowsPerPageChange = vi.fn();
    renderWithProviders(
      <DataTable
        {...baseProps}
        meta={{ total_items: 50, page: 1, page_size: 10 }}
        onPageChange={vi.fn()}
        onRowsPerPageChange={onRowsPerPageChange}
      />,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '25' }));
    expect(onRowsPerPageChange).toHaveBeenCalled();
  });

  it('marks rows as selected via isRowSelected', () => {
    renderWithProviders(
      <DataTable
        {...baseProps}
        rowTestId="row"
        isRowSelected={(item) => item.id === '2'}
      />,
    );
    const rows = screen.getAllByTestId('row');
    expect(rows[0]).not.toHaveClass('Mui-selected');
    expect(rows[1]).toHaveClass('Mui-selected');
  });
});
