import { type ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
} from '@mui/material';

export interface DataTableColumn<T> {
  header: ReactNode;
  render: (item: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  padding?: 'checkbox' | 'none' | 'normal';
  /** @deprecated scope="col" is now applied automatically to all header cells */
  scope?: string;
}

interface PaginationMeta {
  total_items: number;
  page: number;
  page_size: number;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (item: T) => string;
  meta?: PaginationMeta;
  page?: number;
  onPageChange?: (_: unknown, page: number) => void;
  rowsPerPage?: number;
  onRowsPerPageChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isRowSelected?: (item: T) => boolean;
  size?: 'small' | 'medium';
  rowsPerPageOptions?: number[];
  caption?: string;
  testIdPrefix?: string;
}

export default function DataTable<T>({
  data,
  columns,
  getRowKey,
  meta,
  page,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  isRowSelected,
  size = 'small',
  rowsPerPageOptions = [10, 25, 50],
  caption,
  testIdPrefix,
}: DataTableProps<T>) {
  return (
    <>
      <TableContainer {...(testIdPrefix ? { 'data-testid': `${testIdPrefix}.table` } : {})}>
        <Table size={size}>
          {caption && (
            <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              {caption}
            </caption>
          )}
          <TableHead>
            <TableRow>
              {columns.map((col, colIndex) => (
                <TableCell
                  key={colIndex}
                  align={col.align}
                  padding={col.padding}
                  scope="col"
                >
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((item) => (
              <TableRow key={getRowKey(item)} selected={isRowSelected?.(item)}>
                {columns.map((col, colIndex) => (
                  <TableCell key={colIndex} align={col.align} padding={col.padding}>
                    {col.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {meta && onPageChange && onRowsPerPageChange && (
        <TablePagination
          component="div"
          count={meta.total_items}
          page={(page ?? meta.page) - 1}
          onPageChange={onPageChange}
          rowsPerPage={rowsPerPage ?? meta.page_size}
          onRowsPerPageChange={onRowsPerPageChange}
          rowsPerPageOptions={rowsPerPageOptions}
          {...(testIdPrefix ? { 'data-testid': `${testIdPrefix}.table.pagination` } : {})}
        />
      )}
    </>
  );
}
