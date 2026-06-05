import { useTranslation } from 'react-i18next';
import { M3IconButton } from '@/components/design-system';

export interface PaginationProps {
  total: number;
  page: number;
  perPage: number;
  onPage: (next: number) => void;
  onPerPage: (next: number) => void;
  options?: number[];
}

/**
 * Right-aligned pagination footer: rows-per-page select, range readout,
 * prev/next icon buttons. Range text uses i18n interpolation so plural /
 * number formatting follows the active locale.
 */
export function Pagination({
  total,
  page,
  perPage,
  onPage,
  onPerPage,
  options = [10, 25, 50, 100],
}: PaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '14px 4px',
        fontSize: 12.5,
        color: 'var(--on-surface-variant)',
      }}
    >
      <div style={{ flex: 1 }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{t('listPage.pagination.rowsPerPage', 'Rows per page:')}</span>
        <select
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
          style={{
            background: 'var(--surface-container-low)',
            border: '1px solid var(--outline-variant)',
            color: 'var(--on-surface)',
            padding: '4px 8px',
            borderRadius: 8,
            fontFamily: 'inherit',
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>
        {t('listPage.pagination.of', '{{from}}–{{to}} of {{total}}', { from, to, total })}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <M3IconButton
          name="chevron_left"
          size={32}
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          ariaLabel={t('listPage.pagination.previous', 'Previous page')}
        />
        <M3IconButton
          name="chevron_right"
          size={32}
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          ariaLabel={t('listPage.pagination.next', 'Next page')}
        />
      </div>
    </div>
  );
}
