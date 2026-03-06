import {
  Box,
  Divider,
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
import { format } from 'date-fns';
import CopyableId from '@/components/shared/CopyableId';
import type { BlogContentFormData } from './blogDetailSchema';
import { calculateReadingTime } from './blogDetailSchema';

interface BlogSettingsTabProps {
  control: Control<BlogContentFormData>;
  watch: UseFormWatch<BlogContentFormData>;
  setValue: UseFormSetValue<BlogContentFormData>;
  onSnapshot: () => void;
  blogId: string;
  contentId: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function BlogSettingsTab({
  control,
  watch,
  setValue,
  onSnapshot,
  blogId,
  contentId,
  publishedAt,
  createdAt,
  updatedAt,
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

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t('blogDetail.metadata.info')}
      </Typography>
      <Grid container spacing={1}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">{t('blogDetail.metadata.blogId')}</Typography>
          <CopyableId value={blogId} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">{t('blogDetail.metadata.contentId')}</Typography>
          <CopyableId value={contentId} />
        </Grid>
        {publishedAt && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">{t('blogDetail.metadata.publishedAt')}</Typography>
            <Typography variant="body2">{format(new Date(publishedAt), 'PPpp')}</Typography>
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">{t('blogDetail.metadata.createdAt')}</Typography>
          <Typography variant="body2">{format(new Date(createdAt), 'PPpp')}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">{t('blogDetail.metadata.updatedAt')}</Typography>
          <Typography variant="body2">{format(new Date(updatedAt), 'PPpp')}</Typography>
        </Grid>
      </Grid>
    </Box>
  );
}
