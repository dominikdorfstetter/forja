import { describe, it, expect } from 'vitest';
import {
  ariaSortFor,
  gridTemplateColumns,
  headerSelectionState,
  minGridWidth,
} from '../dataTableV2Layout';
import type { DataTableV2Column } from '../dataTableV2Types';

interface Row {
  id: string;
}

const columns: DataTableV2Column<Row>[] = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status', width: '140px' },
  { key: 'updated', label: 'Updated', width: 'minmax(120px, 1fr)' },
];

const rows: Row[] = [{ id: 'a' }, { id: 'b' }];
const getKey = (r: Row) => r.id;

describe('gridTemplateColumns', () => {
  it('defaults widthless columns to 1fr and omits optional tracks', () => {
    expect(gridTemplateColumns(columns, { selectable: false, hasActions: false })).toBe(
      '1fr 140px minmax(120px, 1fr)',
    );
  });

  it('adds the checkbox and actions tracks when enabled', () => {
    expect(gridTemplateColumns(columns, { selectable: true, hasActions: true })).toBe(
      '40px 1fr 140px minmax(120px, 1fr) 56px',
    );
  });
});

describe('minGridWidth', () => {
  it('sums px widths, floors flexible columns at 120px, and adds the gaps', () => {
    // 120 (no width) + 140 + 120 (minmax) + 2 gaps of 12
    expect(minGridWidth(columns, { selectable: false, hasActions: false })).toBe(404);
  });

  it('includes the checkbox and actions tracks', () => {
    expect(minGridWidth(columns, { selectable: true, hasActions: true })).toBe(404 + 40 + 56);
  });
});

describe('headerSelectionState', () => {
  it('is all-unchecked without a selection set', () => {
    expect(headerSelectionState(rows, undefined, getKey)).toEqual({ allChecked: false, someChecked: false });
  });

  it('is indeterminate on a partial selection', () => {
    expect(headerSelectionState(rows, new Set(['a']), getKey)).toEqual({ allChecked: false, someChecked: true });
  });

  it('is fully checked when every row is selected', () => {
    expect(headerSelectionState(rows, new Set(['a', 'b']), getKey)).toEqual({ allChecked: true, someChecked: false });
  });

  it('never reports all-checked for an empty page', () => {
    expect(headerSelectionState([], new Set(['a']), getKey)).toEqual({ allChecked: false, someChecked: false });
  });
});

describe('ariaSortFor', () => {
  it('maps the sort direction to the ARIA token', () => {
    expect(ariaSortFor('asc')).toBe('ascending');
    expect(ariaSortFor('desc')).toBe('descending');
    expect(ariaSortFor(undefined)).toBeUndefined();
  });
});
