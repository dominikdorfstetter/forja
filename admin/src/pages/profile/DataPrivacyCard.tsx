import { Alert, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useTranslation } from 'react-i18next';
import type { PiiInventoryResponse } from '@/types/api';
import PiiInventoryTable from './PiiInventoryTable';

interface DataPrivacyCardProps {
  piiInventory: PiiInventoryResponse | undefined;
  isClerkUser: boolean;
  exporting: boolean;
  onExport: () => void;
  onDeleteAccount: () => void;
}

/** "Data & Privacy": what we store (PII inventory), export, and account deletion. */
export default function DataPrivacyCard({
  piiInventory,
  isClerkUser,
  exporting,
  onExport,
  onDeleteAccount,
}: DataPrivacyCardProps) {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('profile.dataPrivacy')}
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        {t('profile.dataPrivacyInfo')}
      </Alert>
      {piiInventory && piiInventory.entities.length > 0 && (
        <PiiInventoryTable entities={piiInventory.entities} />
      )}
      <Stack direction="row" spacing={2}>
        <Button
          variant="outlined"
          startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
          onClick={onExport}
          disabled={exporting}
          data-testid="export-data-btn"
        >
          {exporting ? t('profile.exporting') : t('profile.exportData')}
        </Button>
        {isClerkUser && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverIcon />}
            onClick={onDeleteAccount}
            data-testid="confirm-delete-account"
          >
            {t('profile.deleteAccount')}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
