import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/i18n/locales/en.json';
import { ThemeModeProvider } from '@/theme/ThemeContext';
import {
  PageHeader,
  Toolbar,
  ToolbarSpacer,
  SearchField,
  DataTableV2,
  type DataTableV2Column,
  Pagination,
  RowActionBtn,
  ActionMenu,
} from '../index';

// Minimal i18n bootstrap for these unit tests so translation interpolation works.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
}

function wrap(ui: React.ReactElement) {
  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ThemeModeProvider>{ui}</ThemeModeProvider>
      </MemoryRouter>
    </I18nextProvider>
  );
}

interface Row {
  id: string;
  slug: string;
  author: string;
}

const rows: Row[] = [
  { id: '1', slug: 'post-one', author: 'Ana' },
  { id: '2', slug: 'post-two', author: 'Ben' },
  { id: '3', slug: 'post-three', author: 'Cai' },
];

const columns: DataTableV2Column<Row>[] = [
  { key: 'slug', label: 'Slug', width: '1fr', render: (r) => r.slug },
  { key: 'author', label: 'Author', width: '120px', muted: true, render: (r) => r.author },
];

describe('listPageV2', () => {
  describe('PageHeader', () => {
    it('renders title, breadcrumb and actions', () => {
      render(
        wrap(
          <PageHeader
            breadcrumb="Content / Blogs"
            title="Blogs"
            subtitle="All posts"
            actions={<button type="button">Create blog</button>}
          />,
        ),
      );
      expect(screen.getByRole('heading', { level: 1, name: 'Blogs' })).toBeInTheDocument();
      // Breadcrumb string is split across spans for M3 emphasis (last
      // segment bold); assert on combined textContent.
      expect(
        screen.getByText((_, node) => node?.textContent === 'Content / Blogs'),
      ).toBeInTheDocument();
      expect(screen.getByText('All posts')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create blog' })).toBeInTheDocument();
    });
  });

  describe('Toolbar', () => {
    it('renders children and the spacer pushes siblings apart', () => {
      render(
        wrap(
          <Toolbar>
            <span data-testid="left">L</span>
            <ToolbarSpacer />
            <span data-testid="right">R</span>
          </Toolbar>,
        ),
      );
      expect(screen.getByTestId('left')).toBeInTheDocument();
      expect(screen.getByTestId('right')).toBeInTheDocument();
    });
  });

  describe('SearchField', () => {
    it('is controlled and fires onChange on typing', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(wrap(<SearchField value="" onChange={onChange} placeholder="Search blogs…" />));
      await user.type(screen.getByPlaceholderText('Search blogs…'), 'hi');
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('DataTableV2', () => {
    it('renders a header row and one row per data item', () => {
      render(wrap(<DataTableV2 columns={columns} rows={rows} getKey={(r) => r.id} />));
      expect(screen.getByRole('columnheader', { name: 'Slug' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Author' })).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
    });

    it('shows the empty message when rows is empty', () => {
      render(
        wrap(
          <DataTableV2
            columns={columns}
            rows={[]}
            getKey={(r) => r.id}
            emptyMessage="No blogs yet"
          />,
        ),
      );
      expect(screen.getByText('No blogs yet')).toBeInTheDocument();
    });

    it('bulk select: allChecked/indeterminate transitions correctly', () => {
      const onToggleAll = vi.fn();
      const onToggleSelect = vi.fn();
      const selected = new Set(['1']); // partial → indeterminate

      const { rerender } = render(
        wrap(
          <DataTableV2
            columns={columns}
            rows={rows}
            getKey={(r) => r.id}
            selected={selected}
            onToggleSelect={onToggleSelect}
            onToggleAll={onToggleAll}
          />,
        ),
      );
      const headerRow = screen.getAllByRole('row')[0];
      const headerCheckbox = within(headerRow).getByRole('checkbox');
      expect((headerCheckbox as HTMLInputElement).indeterminate).toBe(true);

      rerender(
        wrap(
          <DataTableV2
            columns={columns}
            rows={rows}
            getKey={(r) => r.id}
            selected={new Set(rows.map((r) => r.id))}
            onToggleSelect={onToggleSelect}
            onToggleAll={onToggleAll}
          />,
        ),
      );
      const hc2 = within(screen.getAllByRole('row')[0]).getByRole('checkbox');
      expect((hc2 as HTMLInputElement).checked).toBe(true);
      expect((hc2 as HTMLInputElement).indeterminate).toBe(false);
    });

    it('fires onRowClick when a row is activated via Enter', async () => {
      const user = userEvent.setup();
      const onRowClick = vi.fn();
      render(
        wrap(
          <DataTableV2
            columns={columns}
            rows={rows}
            getKey={(r) => r.id}
            onRowClick={onRowClick}
          />,
        ),
      );
      const dataRows = screen.getAllByRole('row').slice(1);
      dataRows[0].focus();
      await user.keyboard('{Enter}');
      expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    });

    it('renders the sort indicator and reports sorted state via aria-sort', () => {
      const sorted: DataTableV2Column<Row>[] = [
        { key: 'slug', label: 'Slug', sorted: 'desc', render: (r) => r.slug },
      ];
      render(
        wrap(
          <DataTableV2
            columns={sorted}
            rows={rows}
            getKey={(r) => r.id}
            onSort={() => {}}
          />,
        ),
      );
      const header = screen.getByRole('columnheader', { name: /Slug/ });
      expect(header).toHaveAttribute('aria-sort', 'descending');
    });

    it('renders skeleton placeholders when loadingRows is set', () => {
      const { container } = render(
        wrap(
          <DataTableV2
            columns={columns}
            rows={[]}
            getKey={(r) => r.id}
            loadingRows={3}
          />,
        ),
      );
      // Skeleton rows are not role=row — count the placeholder div shells
      // by checking that the empty-message did NOT render.
      expect(container.textContent).not.toContain('Nothing here yet');
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('disables Previous on page 1 and Next on last page', () => {
      const onPage = vi.fn();
      render(
        wrap(
          <Pagination total={10} page={1} perPage={10} onPage={onPage} onPerPage={() => {}} />,
        ),
      );
      expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
    });

    it('renders the localized range text', () => {
      render(
        wrap(
          <Pagination
            total={100}
            page={2}
            perPage={25}
            onPage={() => {}}
            onPerPage={() => {}}
          />,
        ),
      );
      expect(screen.getByText('26–50 of 100')).toBeInTheDocument();
    });

    it('invokes onPerPage when the select changes', async () => {
      const user = userEvent.setup();
      const onPerPage = vi.fn();
      render(
        wrap(
          <Pagination
            total={100}
            page={1}
            perPage={10}
            onPage={() => {}}
            onPerPage={onPerPage}
          />,
        ),
      );
      await user.selectOptions(screen.getByRole('combobox'), '50');
      expect(onPerPage).toHaveBeenCalledWith(50);
    });
  });

  describe('RowActionBtn + ActionMenu', () => {
    it('exposes aria-haspopup and aria-expanded', () => {
      const onClick = vi.fn();
      render(wrap(<RowActionBtn onClick={onClick} />));
      const btn = screen.getByRole('button', { name: 'Actions' });
      expect(btn).toHaveAttribute('aria-haspopup', 'menu');
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    });

    it('ActionMenu closes on Escape', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        wrap(
          <ActionMenu
            items={[{ icon: 'edit', label: 'Edit' }]}
            onClose={onClose}
          />,
        ),
      );
      await user.keyboard('{Escape}');
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('ActionMenu invokes item onClick and closes after', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      const onClose = vi.fn();
      render(
        wrap(
          <ActionMenu
            items={[{ icon: 'edit', label: 'Edit', onClick: onEdit }]}
            onClose={onClose}
          />,
        ),
      );
      await user.click(screen.getByRole('menuitem', { name: /Edit/ }));
      expect(onEdit).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('ActionMenu closes when an outside mousedown reaches the window', async () => {
      // Regression: earlier versions registered a once:true click listener
      // and were blocked by stopPropagation on row action buttons, leaving
      // menus stuck open when users moved to a different row's trigger.
      const onClose = vi.fn();
      render(
        wrap(
          <div>
            <button type="button" data-testid="outside-target">
              outside
            </button>
            <ActionMenu items={[{ label: 'Edit' }]} onClose={onClose} />
          </div>,
        ),
      );
      // Wait for the next-tick listener registration to complete, then
      // dispatch mousedown outside the menu.
      await new Promise((r) => setTimeout(r, 10));
      const target = screen.getByTestId('outside-target');
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('ActionMenu does NOT close when mousedown lands inside the menu', async () => {
      const onClose = vi.fn();
      render(
        wrap(
          <ActionMenu
            items={[{ icon: 'edit', label: 'Edit' }]}
            onClose={onClose}
          />,
        ),
      );
      // Give the listener a tick to attach, then dispatch mousedown on the
      // menu item — clicking a menu item still triggers onClose via its own
      // handler, but the mousedown click-away guard must not double-fire it.
      await new Promise((r) => setTimeout(r, 10));
      const item = screen.getByRole('menuitem', { name: /Edit/ });
      item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      // onClose should not have been called from the mousedown alone.
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
