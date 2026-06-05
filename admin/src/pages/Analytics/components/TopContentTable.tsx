import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Skeleton,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { TopContentItem } from '@/types/api';

interface TopContentTableProps {
  items: TopContentItem[];
  onRowClick: (path: string) => void;
  loading?: boolean;
}

export default function TopContentTable({
  items,
  onRowClick,
  loading,
}: TopContentTableProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="text" height={40} />
        ))}
      </>
    );
  }

  if (items.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        {t('analytics.noData')}
      </Typography>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('analytics.path')}</TableCell>
            <TableCell align="right">{t('analytics.views')}</TableCell>
            <TableCell align="right">{t('analytics.visitors')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.path}
              hover
              onClick={() => onRowClick(item.path)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>{item.path}</TableCell>
              <TableCell align="right">{item.total_views}</TableCell>
              <TableCell align="right">{item.unique_visitors}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
