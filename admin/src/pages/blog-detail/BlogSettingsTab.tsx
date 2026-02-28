import {
  Box,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { Controller, type Control, type UseFormWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { BlogContentFormData } from './blogDetailSchema';
import { calculateReadingTime } from './blogDetailSchema';

interface BlogSettingsTabProps {
  control: Control<BlogContentFormData>;
  watch: UseFormWatch<BlogContentFormData>;
  setValue: UseFormSetValue<BlogContentFormData>;
  onSnapshot: () => void;
  coverImageId?: string;
  headerImageId?: string;
}

export default function BlogSettingsTab({
  control,
  watch,
  setValue,
  onSnapshot,
  coverImageId,
  headerImageId,
}: BlogSettingsTabProps) {
  const { t } = useTranslation();
  const body = watch('body');
  const readingTimeOverride = watch('reading_time_override');
  const readingTimeMinutes = watch('reading_time_minutes');
  const autoReadingTime = calculateReadingTime(body);

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="author"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('blogDetail.fields.author')}
                fullWidth
                required
                onBlur={() => { field.onBlur(); onSnapshot(); }}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="published_date"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('blogDetail.fields.publishedDate')}
                type="date"
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                onBlur={() => { field.onBlur(); onSnapshot(); }}
              />
            )}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          {t('blogDetail.metadata.readingTime')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="number"
            size="small"
            value={readingTimeOverride ? (readingTimeMinutes ?? '') : autoReadingTime}
            onChange={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value);
              setValue('reading_time_minutes', val && val > 0 ? val : null, { shouldDirty: true });
              if (!readingTimeOverride) {
                setValue('reading_time_override', true, { shouldDirty: true });
              }
            }}
            sx={{ width: 120 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">min</InputAdornment>,
              inputProps: { min: 1 },
            }}
          />
          {readingTimeOverride && (
            <Tooltip title={t('blogDetail.metadata.resetAuto')}>
              <IconButton
                size="small"
                onClick={() => {
                  setValue('reading_time_override', false, { shouldDirty: true });
                  setValue('reading_time_minutes', null, { shouldDirty: true });
                }}
              >
                <AutorenewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Typography variant="caption" color="text.disabled">
          {readingTimeOverride ? t('blogDetail.metadata.manualOverride') : t('blogDetail.metadata.autoCalculated')}
        </Typography>
      </Box>

      <Box sx={{ mt: 3, display: 'flex', gap: 3 }}>
        <Controller
          name="is_featured"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={(e) => { field.onChange(e.target.checked); onSnapshot(); }}
                />
              }
              label={t('blogDetail.settings.featured')}
            />
          )}
        />
        <Controller
          name="allow_comments"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value}
                  onChange={(e) => { field.onChange(e.target.checked); onSnapshot(); }}
                />
              }
              label={t('blogDetail.settings.commentsOn')}
            />
          )}
        />
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          {t('blogDetail.images.title')}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2" color="text.secondary">
              {t('blogDetail.images.coverImageId')}
            </Typography>
            <Typography variant="caption" fontFamily="monospace">
              {coverImageId || '\u2014'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2" color="text.secondary">
              {t('blogDetail.images.headerImageId')}
            </Typography>
            <Typography variant="caption" fontFamily="monospace">
              {headerImageId || '\u2014'}
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
