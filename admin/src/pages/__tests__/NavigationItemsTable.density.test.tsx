import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import en from '@/i18n/locales/en.json';
import { ThemeModeProvider } from '@/theme/ThemeContext';
import NavigationItemsTable from '@/pages/NavigationItemsTable';
import { flattenItemsWithDepth } from '@/pages/NavigationReducer';
import type { NavigationItem } from '@/types/api';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
}

const items: NavigationItem[] = [
  { id: 'item-1', menu_id: 'menu-1', external_url: 'https://example.com', display_order: 0, open_in_new_tab: false, title: 'Home' },
];

function renderTable() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeModeProvider>
        <NavigationItemsTable
          flattenedItems={flattenItemsWithDepth(items)}
          orderedItems={items}
          activeId={null}
          expandedIds={new Set()}
          totalLocales={0}
          pageRouteMap={new Map()}
          canWrite
          isAdmin
          sensors={[]}
          onDragStart={() => {}}
          onDragEnd={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onToggleExpand={() => {}}
        />
      </ThemeModeProvider>
    </I18nextProvider>,
  );
}

describe('NavigationItemsTable density', () => {
  beforeEach(() => localStorage.clear());

  it('renders the comfortable (medium) variant by default — the tracer bullet that fails while the table is hardcoded small', () => {
    renderTable();
    const cell = within(screen.getByTestId('nav-row')).getAllByRole('cell')[0];
    expect(cell.className).toMatch(/MuiTableCell-sizeMedium/);
    expect(screen.getByTestId('nav-items-table')).toHaveAttribute('data-density', 'comfortable');
  });

  it('shrinks to the compact (small) variant when Density → Compact is active', () => {
    localStorage.setItem('forja:density', 'compact');
    renderTable();
    const cell = within(screen.getByTestId('nav-row')).getAllByRole('cell')[0];
    expect(cell.className).toMatch(/MuiTableCell-sizeSmall/);
    expect(screen.getByTestId('nav-items-table')).toHaveAttribute('data-density', 'compact');
  });

  it('keeps the drag handle operable across densities (reorder unaffected)', () => {
    localStorage.setItem('forja:density', 'compact');
    renderTable();
    expect(within(screen.getByTestId('nav-row')).getByTestId('drag-handle')).toBeInTheDocument();
  });
});
