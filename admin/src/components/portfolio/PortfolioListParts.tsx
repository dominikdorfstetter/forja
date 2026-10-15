import type { ReactNode } from 'react';
import { TableCell, TableSortLabel } from '@mui/material';
import { Pagination } from '@/components/shared/listPageV2';
import type { PortfolioListSectionProps } from './portfolioListTypes';

type SortProps = Pick<PortfolioListSectionProps, 'sortBy' | 'sortDir' | 'onSort'>;

/** Header cell that sorts the list by `column` (ascending until it is the active column). */
export function SortHeaderCell({ column, sortBy, sortDir, onSort, children }: SortProps & { column: string; children: ReactNode }) {
  const active = sortBy === column;
  return (
    <TableCell scope="col">
      <TableSortLabel active={active} direction={active ? sortDir : 'asc'} onClick={() => onSort(column)}>
        {children}
      </TableSortLabel>
    </TableCell>
  );
}

type PaginationProps = Pick<PortfolioListSectionProps, 'page' | 'rowsPerPage' | 'onPage' | 'onPerPage'> & { total: number };

/** List pagination; changing the page size jumps back to page 1. */
export function PortfolioPagination({ total, page, rowsPerPage, onPage, onPerPage }: PaginationProps) {
  return (
    <Pagination
      total={total}
      page={page}
      perPage={rowsPerPage}
      onPage={onPage}
      onPerPage={(n) => {
        onPerPage(n);
        onPage(1);
      }}
    />
  );
}
