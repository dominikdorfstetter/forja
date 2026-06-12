import { useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getLocales } from '@/services/locales';
import { addSiteLocale, getSiteLocales, removeSiteLocale, setSiteDefaultLocale, updateSiteLocale } from '@/services/siteLocales';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import {
  DataTableV2,
  type DataTableV2Column,
} from '@/components/shared/listPageV2';
import { Icon, M3Button, M3IconButton } from '@/components/design-system';
import type { Locale, SiteLocaleResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

interface SiteLocalesManagerProps {
  siteId: string;
}

function TokenPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'primary';
}) {
  const paint =
    tone === 'primary'
      ? {
          bg: 'var(--primary-container)',
          fg: 'var(--on-primary-container)',
          border: '1px solid transparent',
        }
      : {
          bg: 'var(--surface-container-high)',
          fg: 'var(--on-surface-variant)',
          border: '1px solid var(--outline-variant)',
        };
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        height: 22,
        borderRadius: '999px',
        bgcolor: paint.bg,
        color: paint.fg,
        border: paint.border,
        fontSize: 11,
        fontWeight: 600,
        fontVariationSettings: '"wght" 600, "opsz" 11',
        letterSpacing: 0.3,
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
      }}
    >
      {children}
    </Box>
  );
}

export default function SiteLocalesManager({ siteId }: SiteLocalesManagerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState<Locale | null>(null);
  const [urlPrefix, setUrlPrefix] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [removingLocale, setRemovingLocale] = useState<SiteLocaleResponse | null>(null);

  const { data: siteLocales = [], isLoading: localesLoading } = useQuery({
    queryKey: queryKeys.siteLocales(siteId),
    queryFn: () => getSiteLocales(siteId),
  });

  const { data: allLocales = [] } = useQuery({
    queryKey: queryKeys.locales(),
    queryFn: () => getLocales(),
  });

  const assignedLocaleIds = siteLocales.map((sl) => sl.locale_id);
  const availableLocales = allLocales.filter((l) => !assignedLocaleIds.includes(l.id));

  const invalidateLocales = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.siteLocales(siteId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.site(siteId) });
  };

  const addMutation = useMutation({
    mutationFn: (data: { locale_id: string; is_default: boolean; url_prefix?: string }) =>
      addSiteLocale(siteId, data),
    onSuccess: () => {
      invalidateLocales();
      setAddDialogOpen(false);
      resetAddForm();
      showSuccess(t('siteLocales.messages.added'));
    },
    onError: (error) => showError(error),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      localeId,
      data,
    }: {
      localeId: string;
      data: { is_default?: boolean; is_active?: boolean; url_prefix?: string };
    }) => updateSiteLocale(siteId, localeId, data),
    onSuccess: () => {
      invalidateLocales();
      showSuccess(t('siteLocales.messages.updated'));
    },
    onError: (error) => showError(error),
  });

  const removeMutation = useMutation({
    mutationFn: (localeId: string) => removeSiteLocale(siteId, localeId),
    onSuccess: () => {
      invalidateLocales();
      setRemovingLocale(null);
      showSuccess(t('siteLocales.messages.removed'));
    },
    onError: (error) => showError(error),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (localeId: string) => setSiteDefaultLocale(siteId, localeId),
    onSuccess: () => {
      invalidateLocales();
      showSuccess(t('siteLocales.messages.defaultSet'));
    },
    onError: (error) => showError(error),
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
  const isMutating =
    addMutation.isPending ||
    updateMutation.isPending ||
    removeMutation.isPending ||
    setDefaultMutation.isPending;

  const columns: DataTableV2Column<SiteLocaleResponse>[] = [
    {
      key: 'language',
      label: t('siteLocales.columns.language'),
      width: '180px',
      render: (sl) => (
        <Box component="span" sx={{ fontSize: 13.5, color: 'var(--on-surface)' }}>
          <Box component="strong" sx={{ fontWeight: 700 }}>{sl.code}</Box>
          {' — '}
          {sl.name}
        </Box>
      ),
    },
    {
      key: 'native_name',
      label: t('siteLocales.columns.nativeName'),
      width: '160px',
      muted: true,
      render: (sl) => sl.native_name || '—',
    },
    {
      key: 'url_prefix',
      label: t('siteLocales.columns.urlPrefix'),
      width: '120px',
      render: (sl) =>
        sl.url_prefix ? (
          <TokenPill>{sl.url_prefix}</TokenPill>
        ) : (
          <Box component="span" sx={{ color: 'var(--on-surface-variant)' }}>–</Box>
        ),
    },
    {
      key: 'is_default',
      label: t('siteLocales.columns.default'),
      width: '130px',
      render: (sl) =>
        sl.is_default ? (
          <TokenPill tone="primary">{t('siteLocales.columns.default')}</TokenPill>
        ) : (
          <M3IconButton
            name="star"
            size={28}
            tooltip={t('siteLocales.setDefault')}
            disabled={isMutating}
            onClick={() => setDefaultMutation.mutate(sl.locale_id)}
          />
        ),
    },
    {
      key: 'is_active',
      label: t('siteLocales.columns.active'),
      width: '90px',
      render: (sl) => (
        <Switch
          checked={sl.is_active}
          onChange={() => handleToggleActive(sl)}
          disabled={
            isMutating || (sl.is_active && siteLocales.filter((l) => l.is_active).length <= 1)
          }
          size="small"
        />
      ),
    },
  ];

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: '16px',
        bgcolor: 'var(--surface-container-low)',
        border: '1px solid var(--outline-variant)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography
          component="h2"
          sx={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--on-surface)',
            fontVariationSettings: '"wght" 700, "opsz" 16',
          }}
        >
          {t('siteLocales.title')}
        </Typography>
        <M3Button
          variant="outlined"
          size="md"
          icon="add"
          onClick={() => setAddDialogOpen(true)}
          disabled={availableLocales.length === 0}
        >
          {t('siteLocales.addLanguage')}
        </M3Button>
      </Box>
      <Divider sx={{ borderColor: 'var(--outline-variant)', mb: 2 }} />

      {localesLoading ? (
        <Typography sx={{ color: 'var(--on-surface-variant)' }}>
          {t('common.actions.loading')}
        </Typography>
      ) : siteLocales.length === 0 ? (
        <Alert severity="info">{t('siteLocales.empty')}</Alert>
      ) : (
        <DataTableV2<SiteLocaleResponse>
          columns={columns}
          rows={siteLocales}
          getKey={(sl) => sl.locale_id}
          renderActions={(sl) => (
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
                  disabled={sl.is_default || isLastLocale || isMutating}
                  onClick={() => setRemovingLocale(sl)}
                  sx={{
                    width: 32,
                    height: 32,
                    color: 'var(--err)',
                    '&:hover': {
                      bgcolor: 'color-mix(in srgb, var(--err) 14%, transparent)',
                    },
                    '&.Mui-disabled': { color: 'var(--on-surface-variant)', opacity: 0.5 },
                  }}
                >
                  <Icon name="delete" size={18} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        />
      )}

      {/* Add Language Dialog */}
      <FormDialog
        open={addDialogOpen}
        onClose={() => {
          setAddDialogOpen(false);
          resetAddForm();
        }}
        onSubmit={handleAdd}
        icon="language"
        title={t('siteLocales.addDialog.title')}
        submitLabel={t('common.actions.add')}
        submitDisabled={!selectedLocale}
        loading={addMutation.isPending}
      >
        <Autocomplete
          options={availableLocales}
          getOptionLabel={(option) =>
            `${option.code} — ${option.name}${option.native_name ? ` (${option.native_name})` : ''}`
          }
          value={selectedLocale}
          // eslint-disable-next-line forja/require-read-only-gate -- add-locale dialog is opened only from isAdmin actions on SiteDetail
          onChange={(_, value) => setSelectedLocale(value)}
          renderInput={(params) => (
            <TextField {...params} size="small" label={t('siteLocales.addDialog.selectLanguage')} />
          )}
        />
        <TextField
          label={t('siteLocales.addDialog.urlPrefix')}
          size="small"
          value={urlPrefix}
          onChange={(e) => setUrlPrefix(e.target.value)}
          helperText={t('siteLocales.addDialog.urlPrefixHelper')}
          slotProps={{
            htmlInput: { maxLength: 10 },
          }}
        />
        <FormControlLabel
          control={
            <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          }
          label={t('siteLocales.addDialog.setAsDefault')}
        />
      </FormDialog>

      <ConfirmDialog
        open={!!removingLocale}
        title={t('siteLocales.removeDialog.title')}
        message={
          removingLocale
            ? t('siteLocales.removeDialog.message', {
                name: removingLocale.name,
                code: removingLocale.code,
              })
            : ''
        }
        confirmLabel={t('siteLocales.removeDialog.confirm')}
        confirmColor="error"
        onConfirm={() =>
          removingLocale && removeMutation.mutate(removingLocale.locale_id)
        }
        onCancel={() => setRemovingLocale(null)}
        loading={removeMutation.isPending}
      />
    </Box>
  );
}
