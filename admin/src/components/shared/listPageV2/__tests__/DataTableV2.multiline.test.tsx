import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import en from '@/i18n/locales/en.json';
import { ThemeModeProvider } from '@/theme/ThemeContext';
import { DataTableV2, type DataTableV2Column } from '../index';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  });
}

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [{ id: '1', name: 'Alpha' }];

const columns: DataTableV2Column<Row>[] = [
  // single-line default
  { key: 'name', label: 'Name', render: (r) => r.name },
  // tall, interactive content that must not be clipped
  { key: 'role', label: 'Role', multiline: true, render: () => <div style={{ height: 40 }}>tall control</div> },
];

function wrap(ui: React.ReactElement) {
  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ThemeModeProvider>{ui}</ThemeModeProvider>
      </MemoryRouter>
    </I18nextProvider>
  );
}

function dataRowCells() {
  // row[0] is the header; row[1] is the first data row
  const dataRow = screen.getAllByRole('row')[1];
  return { dataRow, cells: within(dataRow).getAllByRole('cell') };
}

describe('DataTableV2 multiline / minHeight contract', () => {
  beforeEach(() => localStorage.clear());

  it('keeps non-multiline cells single-line (nowrap + clipped)', () => {
    render(wrap(<DataTableV2 columns={columns} rows={rows} getKey={(r) => r.id} />));
    const { cells } = dataRowCells();
    expect(cells[0].style.whiteSpace).toBe('nowrap');
    expect(cells[0].style.overflow).toBe('hidden');
  });

  it('drops nowrap + overflow:hidden on multiline cells so tall content is not clipped', () => {
    render(wrap(<DataTableV2 columns={columns} rows={rows} getKey={(r) => r.id} />));
    const { cells } = dataRowCells();
    expect(cells[1].style.whiteSpace).not.toBe('nowrap');
    expect(cells[1].style.overflow).not.toBe('hidden');
  });

  it('uses minHeight (not a fixed height) on rows so a tall cell can grow the row — compact floor stays 40px', () => {
    localStorage.setItem('forja:density', 'compact');
    render(wrap(<DataTableV2 columns={columns} rows={rows} getKey={(r) => r.id} />));
    const { dataRow } = dataRowCells();
    expect(dataRow.style.minHeight).toBe('40px');
    expect(dataRow.style.height).toBe('');
  });

  it('keeps the comfortable floor at 52px', () => {
    render(wrap(<DataTableV2 columns={columns} rows={rows} getKey={(r) => r.id} />));
    const { dataRow } = dataRowCells();
    expect(dataRow.style.minHeight).toBe('52px');
  });
});
