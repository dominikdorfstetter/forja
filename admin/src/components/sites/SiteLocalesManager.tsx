import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Switch,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  FormControlLabel,
  Checkbox,
  Divider,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { Locale, SiteLocaleResponse } from '@/types/api';

interface SiteLocalesManagerProps {
  siteId: string;
}

export default function SiteLocalesManager({ siteId }: SiteLocalesManagerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<Locale | null>(null);
  const [urlPrefix, setUrlPrefix] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const { data: siteLocales = [], isLoading: localesLoading } = useQuery({
    queryKey: ['site-locales', siteId],
    queryFn: () => apiService.getSiteLocales(siteId),
  });

  const { data: allLocales = [] } = useQuery({
    queryKey: ['locales'],
    queryFn: () => apiService.getLocales(),
  });

  const assignedLocaleIds = siteLocales.map((sl) => sl.locale_id);
  const availableLocales = allLocales.filter((l) => !assignedLocaleIds.includes(l.id));

  const invalidateLocales = () => {
    queryClient.invalidateQueries({ queryKey: ['site-locales', siteId] });
    queryClient.invalidateQueries({ queryKey: ['site', siteId] });
  };

  const addMutation = useMutation({
    mutationFn: (data: { locale_id: string; is_default: boolean; url_prefix?: string }) =>
      apiService.addSiteLocale(siteId, data),
    onSuccess: () => {
      invalidateLocales();
      setAddDialogOpen(false);
      resetAddForm();
      enqueueSnackbar(t('siteLocales.messages.added'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title || t('siteLocales.messages.addFailed'), { variant: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ localeId, data }: { localeId: string; data: { is_default?: boolean; is_active?: boolean; url_prefix?: string } }) =>
      apiService.updateSiteLocale(siteId, localeId, data),
    onSuccess: () => {
      invalidateLocales();
      enqueueSnackbar(t('siteLocales.messages.updated'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title || t('siteLocales.messages.updateFailed'), { variant: 'error' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (localeId: string) => apiService.removeSiteLocale(siteId, localeId),
    onSuccess: () => {
      invalidateLocales();
      enqueueSnackbar(t('siteLocales.messages.removed'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title || t('siteLocales.messages.removeFailed'), { variant: 'error' });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (localeId: string) => apiService.setSiteDefaultLocale(siteId, localeId),
    onSuccess: () => {
      invalidateLocales();
      enqueueSnackbar(t('siteLocales.messages.defaultSet'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title || t('siteLocales.messages.defaultFailed'), { variant: 'error' });
    },
  });

  const resetAddForm = () => {
    setSelectedLocale(null);
    setUrlPrefix('');
    setIsDefault(false);
  };

  const handleAdd = () => {
    if (!selectedLocale) return;
    addMutation.mutate({
      locale_id: selectedLocale.id,
      is_default: isDefault,
      url_prefix: urlPrefix || undefined,
    });
  };

  const handleToggleActive = (sl: SiteLocaleResponse) => {
    updateMutation.mutate({
      localeId: sl.locale_id,
      data: { is_active: !sl.is_active },
    });
  };

  const isLastLocale = siteLocales.length <= 1;
  const isMutating = addMutation.isPending || updateMutation.isPending || removeMutation.isPending || setDefaultMutation.isPending;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{t('siteLocales.title')}</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
          disabled={availableLocales.length === 0}
          size="small"
        >
          {t('siteLocales.addLanguage')}
        </Button>
      </Box>
      <Divider sx={{ mb: 2 }} />

      {localesLoading ? (
        <Typography color="text.secondary">{t('common.actions.loading')}</Typography>
      ) : siteLocales.length === 0 ? (
        <Alert severity="info">{t('siteLocales.empty')}</Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('siteLocales.columns.language')}</TableCell>
                <TableCell>{t('siteLocales.columns.nativeName')}</TableCell>
                <TableCell>{t('siteLocales.columns.urlPrefix')}</TableCell>
                <TableCell>{t('siteLocales.columns.default')}</TableCell>
                <TableCell>{t('siteLocales.columns.active')}</TableCell>
                <TableCell align="right">{t('siteLocales.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {siteLocales.map((sl) => (
                <TableRow key={sl.locale_id}>
                  <TableCell>
                    <Typography variant="body2">
                      <strong>{sl.code}</strong> &mdash; {sl.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {sl.native_name || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {sl.url_prefix ? (
                      <Chip label={sl.url_prefix} size="small" variant="outlined" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {sl.is_default ? (
                      <Chip label={t('siteLocales.columns.default')} size="small" color="primary" />
                    ) : (
                      <Tooltip title={t('siteLocales.setDefault')}>
                        <IconButton
                          size="small"
                          onClick={() => setDefaultMutation.mutate(sl.locale_id)}
                          disabled={isMutating}
                        >
                          <StarBorderIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={sl.is_active}
                      onChange={() => handleToggleActive(sl)}
                      disabled={isMutating || (sl.is_active && siteLocales.filter(l => l.is_active).length <= 1)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip
                      title={
                        sl.is_default
                          ? t('siteLocales.tooltips.cannotRemoveDefault')
                          : isLastLocale
                            ? t('siteLocales.tooltips.cannotRemoveLast')
                            : t('siteLocales.remove')
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeMutation.mutate(sl.locale_id)}
                          disabled={sl.is_default || isLastLocale || isMutating}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Language Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => { setAddDialogOpen(false); resetAddForm(); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('siteLocales.addDialog.title')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              options={availableLocales}
              getOptionLabel={(option) => `${option.code} — ${option.name}${option.native_name ? ` (${option.native_name})` : ''}`}
              value={selectedLocale}
              onChange={(_, value) => setSelectedLocale(value)}
              renderInput={(params) => (
                <TextField {...params} label={t('siteLocales.addDialog.selectLanguage')} />
              )}
            />
            <TextField
              label={t('siteLocales.addDialog.urlPrefix')}
              value={urlPrefix}
              onChange={(e) => setUrlPrefix(e.target.value)}
              helperText={t('siteLocales.addDialog.urlPrefixHelper')}
              inputProps={{ maxLength: 10 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
              }
              label={t('siteLocales.addDialog.setAsDefault')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialogOpen(false); resetAddForm(); }}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!selectedLocale || addMutation.isPending}
          >
            {addMutation.isPending ? t('common.actions.saving') : t('common.actions.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
