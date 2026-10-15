import type { ReactNode } from 'react';
import { Box, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { MAX, charCounter, type RegenerateField } from './blogWizardAiFields';

/** `n / max` helper text that turns red near the limit. */
export function CharCountHelper({ value, max }: { value: string; max: number }) {
  const { text, color } = charCounter(value, max);
  return <Typography variant="caption" sx={{ color }}>{text}</Typography>;
}

interface AiRegenerateControlProps {
  field: RegenerateField;
  regeneratingField: RegenerateField | null;
  busy: boolean;
  onRegenerate: (field: RegenerateField) => void;
}

export function AiRegenerateButton({ field, regeneratingField, busy, onRegenerate }: AiRegenerateControlProps) {
  const { t } = useTranslation();
  return (
    <Tooltip title={t('quickPost.ai.regenerate', 'Regenerate')} arrow>
      <span>
        <IconButton
          size="small"
          onClick={() => onRegenerate(field)}
          disabled={busy}
          aria-label={t('quickPost.ai.regenerate', 'Regenerate')}
        >
          {regeneratingField === field ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** Captioned post-phase section with its own regenerate control. */
export function AiRegenerableSection({ label, children, ...control }: AiRegenerateControlProps & { label: string; children: ReactNode }) {
  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, alignItems: "center" }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <AiRegenerateButton {...control} />
      </Stack>
      {children}
    </Box>
  );
}

/** Raw-markdown body editor for the wizard's post phase. */
export function AiMarkdownBodyField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <TextField
      fullWidth
      multiline
      minRows={6}
      maxRows={12}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      slotProps={{
        htmlInput: { maxLength: MAX.body },
        input: { sx: { fontFamily: 'monospace', fontSize: '0.875rem' } },
      }}
      helperText={<CharCountHelper value={value} max={MAX.body} />}
    />
  );
}
