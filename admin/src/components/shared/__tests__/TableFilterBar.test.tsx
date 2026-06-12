import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import TableFilterBar from '../TableFilterBar';

const statusFilter = {
  key: 'status',
  label: 'Status',
  value: 'all',
  onChange: vi.fn(),
  options: [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ],
};

describe('TableFilterBar', () => {
  it('reports search input changes', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    renderWithProviders(
      <TableFilterBar searchValue="" onSearchChange={onSearchChange} />,
    );

    await user.type(screen.getByLabelText('Search'), 'a');
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('uses a custom placeholder as the accessible search label', () => {
    renderWithProviders(
      <TableFilterBar
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Search blogs"
      />,
    );
    expect(screen.getByLabelText('Search blogs')).toBeInTheDocument();
  });

  it('clears the search via the clear affordance, shown only while text is present', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const { rerender } = renderWithProviders(
      <TableFilterBar searchValue="" onSearchChange={onSearchChange} />,
    );
    expect(screen.queryByLabelText('Clear')).not.toBeInTheDocument();

    rerender(<TableFilterBar searchValue="hello" onSearchChange={onSearchChange} />);
    await user.click(screen.getByLabelText('Clear'));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('changes a filter through its dropdown options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <TableFilterBar
        searchValue=""
        onSearchChange={vi.fn()}
        filters={[{ ...statusFilter, onChange }]}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Draft' }));

    expect(onChange).toHaveBeenCalledWith('draft');
  });

  it('renders one dropdown per configured filter', () => {
    renderWithProviders(
      <TableFilterBar
        searchValue=""
        onSearchChange={vi.fn()}
        filters={[
          statusFilter,
          { ...statusFilter, key: 'category', label: 'Category' },
        ]}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
  });

  it('hides the search input when hideSearch is set', () => {
    renderWithProviders(
      <TableFilterBar searchValue="" onSearchChange={vi.fn()} hideSearch />,
    );
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
  });

  it('renders custom actions at the end of the bar', () => {
    renderWithProviders(
      <TableFilterBar
        searchValue=""
        onSearchChange={vi.fn()}
        actions={<button>Export CSV</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });
});
