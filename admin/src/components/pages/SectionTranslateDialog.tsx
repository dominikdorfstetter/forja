import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';

type SectionTranslatableField = 'title' | 'text' | 'button_text';

export type SectionTranslationPreview =
  | Partial<Record<SectionTranslatableField, string | null | undefined>>
  | null;

interface SectionTranslateDialogProps {
  open: boolean;
  onClose: () => void;
  targetLocaleCode: string;
  targetLocaleName: string;
  hasSourceContent: boolean;
  preview: SectionTranslationPreview;
  onPreviewChange: (preview: SectionTranslationPreview) => void;
  onGenerate: () => void;
  onRefreshField: (field: SectionTranslatableField) => void;
  onApply: () => void;
  isGenerating: boolean;
  refreshingField: SectionTranslatableField | null;
}

export default function SectionTranslateDialog({
  open,
  onClose,
  targetLocaleCode,
  targetLocaleName,
  hasSourceContent,
  preview,
  onPreviewChange,
  onGenerate,
  onRefreshField,
  onApply,
  isGenerating,
  refreshingField,
}: SectionTranslateDialogProps) {
  const { t } = useTranslation();

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="translate"
      title={t('forms.section.ai.translate')}
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
            disabled={!preview}
            data-testid="section-translate-dialog.btn.apply"
          >
            {t('forms.section.ai.applyTranslation')}
          </M3Button>
        </>
      }
    >
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('forms.section.ai.translateHint', {
            locale: targetLocaleName,
            code: targetLocaleCode.toUpperCase(),
          })}
        </Typography>
      </Box>

      <M3Button
        variant="outlined"
        size="sm"
        icon={isGenerating ? 'progress_activity' : 'auto_awesome'}
        onClick={onGenerate}
        disabled={isGenerating || !hasSourceContent}
        data-testid="section-translate-dialog.btn.generate"
      >
        {isGenerating
          ? t('forms.section.ai.generating')
          : t('forms.section.ai.suggestTranslation')}
      </M3Button>

      {!hasSourceContent && (
        <Typography variant="caption" color="text.secondary">
          {t('forms.section.ai.noSourceContent')}
        </Typography>
      )}

      {preview && (
        <Stack spacing={2}>
          {([
            { key: 'title' as const, label: t('blogDetail.fields.title') },
            {
              key: 'text' as const,
              label: t('forms.section.fields.text', { defaultValue: 'Text' }),
              multiline: true,
              minRows: 4,
              maxRows: 12,
            },
            {
              key: 'button_text' as const,
              label: t('forms.section.fields.buttonText'),
            },
          ] as const)
            .filter(({ key }) => preview[key] !== undefined)
            .map(({ key, label, ...props }) => (
              <TextField
                key={key}
                label={label}
                value={preview[key] ?? ''}
                onChange={(e) =>
                  onPreviewChange(preview ? { ...preview, [key]: e.target.value } : preview)
                }
                fullWidth
                size="small"
                disabled={refreshingField === key}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={t('forms.section.ai.refreshField')}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => onRefreshField(key)}
                              disabled={refreshingField !== null}
                              aria-label={t('forms.section.ai.refreshField')}
                            >
                              {refreshingField === key ? (
                                <CircularProgress size={16} />
                              ) : (
                                <RefreshIcon fontSize="small" />
                              )}
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
