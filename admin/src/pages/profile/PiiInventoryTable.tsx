import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PiiInventoryEntity } from '@/types/api';

/**
 * GDPR Art. 15 transparency view — every identity-bearing field Forja
 * stores about the user, why, on which legal basis, and its erasure fate.
 */
export default function PiiInventoryTable({ entities }: { entities: PiiInventoryEntity[] }) {
  const { t } = useTranslation();

  const erasureLabel = (behavior: string) =>
    behavior === 'retention_purged'
      ? t('profile.piiInventory.retentionPurged')
      : t('profile.piiInventory.anonymizeOnErasure');

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        {t('profile.piiInventory.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('profile.piiInventory.description')}
      </Typography>
      <Table size="small" data-testid="pii-inventory.table">
        <TableHead>
          <TableRow>
            <TableCell scope="col">{t('profile.piiInventory.colField')}</TableCell>
            <TableCell scope="col">{t('profile.piiInventory.colPurpose')}</TableCell>
            <TableCell scope="col">{t('profile.piiInventory.colLegalBasis')}</TableCell>
            <TableCell scope="col" align="right">
              {t('profile.piiInventory.colRecords')}
            </TableCell>
            <TableCell scope="col">{t('profile.piiInventory.colErasure')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entities.flatMap((entity) =>
            entity.fields.map((field) => (
              <TableRow key={`${entity.table}.${field.field}`}>
                <TableCell>
                  <Tooltip title={entity.description}>
                    <Typography
                      component="span"
                      sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                    >
                      {entity.table}.{field.field}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>{field.purpose}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" component="span">
                    {field.legal_basis}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {field.record_count ?? '—'}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={erasureLabel(field.retention_behavior)}
                  />
                </TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
