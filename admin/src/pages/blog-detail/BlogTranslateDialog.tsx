import {
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';

type TranslatableField = 'title' | 'subtitle' | 'excerpt' | 'body' | 'meta_title' | 'meta_description';

export type TranslationPreview = Partial<Record<TranslatableField, string | null | undefined>> | null;

interface LocaleOption {
  id: string;
  code: string;
  name: string;
}

interface BlogTranslateDialogProps {
  open: boolean;
  onClose: () => void;
  otherLocales: LocaleOption[];
  translateLocale: string;
  onLocaleChange: (code: string) => void;
  translationPreview: TranslationPreview;
  onTranslationPreviewChange: (preview: TranslationPreview) => void;
  onGenerate: () => void;
  onRefreshField: (field: TranslatableField) => void;
  onApply: () => void;
  isGenerating: boolean;
  refreshingField: string | null;
  hasBody: boolean;
}

export default function BlogTranslateDialog({
  open,
  onClose,
  otherLocales,
  translateLocale,
  onLocaleChange,
  translationPreview,
  onTranslationPreviewChange,
  onGenerate,
  onRefreshField,
  onApply,
  isGenerating,
  refreshingField,
  hasBody,
}: BlogTranslateDialogProps) {
  const { t } = useTranslation();

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="translate"
      title={t('blogDetail.ai.translate')}
      maxWidth="md"
      actions={
        <>
          <M3Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.actions.cancel')}
          </M3Button>
          <M3Button
            variant="filled"
            size="sm"
            onClick={onApply}
            disabled={!translationPreview}
          >
            {t('blogDetail.ai.applyTranslation')}
          </M3Button>
        </>
      }
    >
      <TextField
        select
        label={t('blogDetail.ai.selectTargetLocale')}
        value={translateLocale}
        onChange={(e) => onLocaleChange(e.target.value)}
        fullWidth
        size="small"
      >
        {otherLocales.map((l) => (
          <MenuItem key={l.id} value={l.code}>
            {l.name} ({l.code.toUpperCase()})
          </MenuItem>
        ))}
      </TextField>

      <M3Button
        variant="outlined"
        size="sm"
        icon={isGenerating ? 'progress_activity' : 'auto_awesome'}
        onClick={onGenerate}
        disabled={isGenerating || !translateLocale || !hasBody}
      >
        {isGenerating ? t('blogDetail.ai.generating') : t('blogDetail.ai.suggestTranslation')}
      </M3Button>

      {translationPreview && (
        <Stack spacing={2}>
          {([
            { key: 'title' as const, label: t('blogDetail.fields.title') },
            { key: 'subtitle' as const, label: t('blogDetail.fields.subtitle') },
            { key: 'excerpt' as const, label: t('blogDetail.fields.excerpt'), multiline: true, minRows: 2 },
            { key: 'body' as const, label: t('blogDetail.fields.body'), multiline: true, minRows: 4, maxRows: 12 },
            { key: 'meta_title' as const, label: t('blogDetail.fields.metaTitle') },
            { key: 'meta_description' as const, label: t('blogDetail.fields.metaDescription'), multiline: true, minRows: 2 },
          ] as const).filter(({ key }) => translationPreview[key] !== undefined).map(({ key, label, ...props }) => (
            <TextField
              key={key}
              label={label}
              value={translationPreview[key] ?? ''}
              onChange={(e) => onTranslationPreviewChange(
                translationPreview ? { ...translationPreview, [key]: e.target.value } : translationPreview,
              )}
              fullWidth
              size="small"
              disabled={refreshingField === key}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('blogDetail.ai.refreshField')}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => onRefreshField(key)}
                            disabled={refreshingField !== null}
                          >
                            {refreshingField === key ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}
              {...props}
            />
          ))}
        </Stack>
      )}
    </FormDialog>
  );
}
