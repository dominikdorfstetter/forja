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
  scope?: string;
}

export interface PaginationMeta {
  total_items: number;
  page: number;
  page_size: number;
}

export interface DataTableProps<T> {
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
}: DataTableProps<T>) {
  return (
    <>
      <TableContainer>
        <Table size={size}>
          <TableHead>
            <TableRow>
              {columns.map((col, i) => (
                <TableCell
                  key={i}
                  align={col.align}
                  padding={col.padding}
                  scope={col.scope as never}
                >
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((item) => (
              <TableRow key={getRowKey(item)} selected={isRowSelected?.(item)}>
                {columns.map((col, i) => (
                  <TableCell key={i} align={col.align} padding={col.padding}>
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
        />
      )}
    </>
  );
}
