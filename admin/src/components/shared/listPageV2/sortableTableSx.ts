import type { SxProps, Theme } from '@mui/material';

/**
 * Shared M3 table chrome for the hand-built sortable content tables (Portfolio
 * CV + Projects) that can't use DataTableV2 (no row reordering). Previously
 * duplicated byte-for-byte across both hosts. `rowHeight` comes from
 * useTableDensity so the body rows track the Density toggle and match
 * DataTableV2's 40/52px variants.
 */
export function sortableContentTableSx(rowHeight: number): SxProps<Theme> {
  return {
    borderRadius: '20px',
    border: '1px solid var(--outline-variant)',
    background: 'var(--surface-container-low)',
    /* M3-styled MUI table chrome: header row picks up the same
       uppercase/tracked typography DataTableV2 uses; cell dividers
       use --outline-variant; default Paper backgrounds go transparent. */
    '& .MuiTableHead-root .MuiTableCell-root': {
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '1px',
      color: 'var(--on-surface-variant)',
      background: 'transparent',
      borderBottom: '1px solid var(--outline-variant)',
      height: 44,
      py: 0,
    },
    '& .MuiTableBody-root .MuiTableCell-root': {
      borderBottom: '1px solid var(--outline-variant)',
      color: 'var(--on-surface)',
      fontSize: 14,
      background: 'transparent',
      height: rowHeight,
    },
    '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-root': {
      borderBottom: 'none',
    },
    '& .MuiTableBody-root .MuiTableRow-root:hover .MuiTableCell-root': {
      background: 'var(--surface-container)',
    },
    '& .MuiTableSortLabel-root, & .MuiTableSortLabel-active, & .MuiTableSortLabel-icon': {
      color: 'inherit !important',
    },
  };
}
