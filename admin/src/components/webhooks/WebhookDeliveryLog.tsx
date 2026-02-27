import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  TablePagination,
} from '@mui/material';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface WebhookDeliveryLogProps {
  open: boolean;
  webhookId: string | null;
  onClose: () => void;
}

export default function WebhookDeliveryLog({ open, webhookId, onClose }: WebhookDeliveryLogProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const { data, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhookId, page, perPage],
    queryFn: () => apiService.getWebhookDeliveries(webhookId!, { page, per_page: perPage }),
    enabled: !!webhookId && open,
  });

  const deliveries = data?.data;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="delivery-log-title">
      <DialogTitle id="delivery-log-title">{t('webhooks.deliveries.title')}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <LoadingState label={t('webhooks.deliveries.loading')} />
        ) : !deliveries || deliveries.length === 0 ? (
          <EmptyState
            title={t('webhooks.deliveries.empty')}
            description={t('webhooks.deliveries.emptyDescription')}
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('webhooks.deliveries.table.event')}</TableCell>
                  <TableCell>{t('webhooks.deliveries.table.status')}</TableCell>
                  <TableCell>{t('webhooks.deliveries.table.attempt')}</TableCell>
                  <TableCell>{t('webhooks.deliveries.table.timestamp')}</TableCell>
                  <TableCell>{t('webhooks.deliveries.table.error')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Chip label={d.event_type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {d.status_code ? (
                        <Chip
                          label={d.status_code}
                          size="small"
                          color={d.status_code >= 200 && d.status_code < 300 ? 'success' : 'error'}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>{d.attempt_number}</TableCell>
                    <TableCell>{format(new Date(d.delivered_at), 'Pp')}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="error" noWrap sx={{ maxWidth: 200 }}>
                        {d.error_message || '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {data?.meta && (
          <TablePagination
            component="div"
            count={data.meta.total_items}
            page={data.meta.page - 1}
            onPageChange={(_, p) => setPage(p + 1)}
            rowsPerPage={data.meta.page_size}
            onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.actions.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
