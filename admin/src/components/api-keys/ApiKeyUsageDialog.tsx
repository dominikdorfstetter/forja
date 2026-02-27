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
  Typography,
  Chip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface ApiKeyUsageDialogProps {
  open: boolean;
  keyId: string | null;
  keyName: string;
  onClose: () => void;
}

export default function ApiKeyUsageDialog({ open, keyId, keyName, onClose }: ApiKeyUsageDialogProps) {
  const { t } = useTranslation();
  const { data: usage, isLoading } = useQuery({
    queryKey: ['apiKeyUsage', keyId],
    queryFn: () => apiService.getApiKeyUsage(keyId!, { limit: 50 }),
    enabled: !!keyId && open,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="api-key-usage-title">
      <DialogTitle id="api-key-usage-title">{t('apiKeys.usageDialog.title')}: {keyName}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <LoadingState label="Loading usage data..." />
        ) : !usage || usage.length === 0 ? (
          <EmptyState title={t('apiKeys.usageDialog.noUsage')} description="" />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('apiKeys.usageDialog.endpoint')}</TableCell>
                  <TableCell>{t('apiKeys.usageDialog.method')}</TableCell>
                  <TableCell>{t('apiKeys.usageDialog.statusCode')}</TableCell>
                  <TableCell>Response Time</TableCell>
                  <TableCell>{t('apiKeys.usageDialog.timestamp')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usage.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" noWrap sx={{ maxWidth: 300 }}>
                        {record.endpoint}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={record.method} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status_code}
                        size="small"
                        color={record.status_code < 400 ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{record.response_time_ms}ms</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {format(new Date(record.created_at), 'PP p')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.actions.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
