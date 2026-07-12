import { useEffect, useRef, useState } from 'react';
import {
  Box, Paper, Typography, Divider, TextField, Button,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { updateSiteSettings } from '@/services/sites';
import type { SiteSettingsResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

const ORIGIN_REGEX = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*(:\d{1,5})?$/;

function isValidOrigin(origin: string): boolean {
  if (!origin || origin.includes('*') || origin.endsWith('/')) return false;
  const afterScheme = origin.split('://')[1];
  if (afterScheme?.includes('/')) return false;
  return ORIGIN_REGEX.test(origin);
}

function parseOrigins(text: string): string[] {
  return text.split(/[\n,]/).flatMap((s) => {
    const trimmed = s.trim();
    return trimmed ? [trimmed] : [];
  });
}

interface AllowedOriginsSectionProps {
  siteId: string;
  settings: SiteSettingsResponse;
}

export default function AllowedOriginsSection({ siteId, settings }: AllowedOriginsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [originsText, setOriginsText] = useState('');
  const [originsError, setOriginsError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      setOriginsText(settings.allowed_origins.join('\n'));
    }
  }, [settings.allowed_origins]);

  const mutation = useMutation({
    mutationFn: (origins: string[]) =>
      updateSiteSettings(siteId, { allowed_origins: origins }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings(siteId) });
      enqueueSnackbar(t('settings.messages.saved'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('settings.messages.saveFailed'), { variant: 'error' });
    },
  });

  const handleSave = () => {
    const origins = parseOrigins(originsText);
    const invalid = origins.filter((o) => !isValidOrigin(o));
    if (invalid.length > 0) {
      setOriginsError(t('siteSettings.cors.invalidOrigin'));
      return;
    }
    setOriginsError(null);
    mutation.mutate(origins);
  };

  const currentOrigins = settings.allowed_origins;
  const parsedOrigins = parseOrigins(originsText);
  const hasChanged =
    parsedOrigins.length !== currentOrigins.length ||
    parsedOrigins.some((o, i) => o !== currentOrigins[i]);

  return (
    <Paper sx={{ p: 3 }} data-testid="site-settings.cors">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SecurityIcon color="primary" fontSize="small" />
        <Typography variant="h6" component="h2">{t('siteSettings.cors.title')}</Typography>
      </Box>
      <Divider sx={{ mb: 2.5 }} />
      <TextField
        multiline
        minRows={3}
        maxRows={10}
        fullWidth
        size="small"
        placeholder={t('siteSettings.cors.placeholder')}
        helperText={originsError ?? t('siteSettings.cors.help')}
        error={!!originsError}
        value={originsText}
        onChange={(e) => {
          setOriginsText(e.target.value);
          setOriginsError(null);
        }}
        data-testid="site-settings.cors-input"
      />
      {currentOrigins.length === 0 && !originsText.trim() && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {t('siteSettings.cors.emptyHelp')}
        </Typography>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          disabled={!hasChanged || mutation.isPending}
          onClick={handleSave}
          data-testid="site-settings.cors-save"
        >
          {mutation.isPending ? t('common.actions.saving') : t('common.actions.save')}
        </Button>
      </Box>
    </Paper>
  );
}
