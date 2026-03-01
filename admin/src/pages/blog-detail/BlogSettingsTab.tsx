import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardMedia,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ImageIcon from '@mui/icons-material/Image';
import { Controller, type Control, type UseFormWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { BlogContentFormData } from './blogDetailSchema';
import { calculateReadingTime } from './blogDetailSchema';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';

interface BlogSettingsTabProps {
  control: Control<BlogContentFormData>;
  watch: UseFormWatch<BlogContentFormData>;
  setValue: UseFormSetValue<BlogContentFormData>;
  onSnapshot: () => void;
  siteId: string;
}

type ImageField = 'cover_image_id' | 'header_image_id';

export default function BlogSettingsTab({
  control,
  watch,
  setValue,
  onSnapshot,
  siteId,
}: BlogSettingsTabProps) {
  const { t } = useTranslation();
  const body = watch('body');
  const readingTimeOverride = watch('reading_time_override');
  const readingTimeMinutes = watch('reading_time_minutes');
  const autoReadingTime = calculateReadingTime(body);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<ImageField>('cover_image_id');

  const openPicker = (field: ImageField) => {
    setPickerTarget(field);
    setPickerOpen(true);
  };

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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('blogDetail.images.coverImageId')}
            </Typography>
            <Controller
              name="cover_image_id"
              control={control}
              render={({ field }) => (
                <ImageFieldControl
                  value={field.value}
                  onSelect={() => openPicker('cover_image_id')}
                  onClear={() => {
                    field.onChange(null);
                    onSnapshot();
                  }}
                  t={t}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('blogDetail.images.headerImageId')}
            </Typography>
            <Controller
              name="header_image_id"
              control={control}
              render={({ field }) => (
                <ImageFieldControl
                  value={field.value}
                  onSelect={() => openPicker('header_image_id')}
                  onClear={() => {
                    field.onChange(null);
                    onSnapshot();
                  }}
                  t={t}
                />
              )}
            />
          </Grid>
        </Grid>
      </Box>

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        siteId={siteId}
        currentValue={watch(pickerTarget)}
        onSelect={(mediaId) => {
          setValue(pickerTarget, mediaId, { shouldDirty: true });
          onSnapshot();
        }}
      />
    </Box>
  );
}

function ImageFieldControl({
  value,
  onSelect,
  onClear,
  t,
}: {
  value: string | null | undefined;
  onSelect: () => void;
  onClear: () => void;
  t: (key: string) => string;
}) {
  if (!value) {
    return (
      <Card
        variant="outlined"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 100,
          cursor: 'pointer',
          bgcolor: 'action.hover',
        }}
        onClick={onSelect}
      >
        <Stack alignItems="center" spacing={0.5}>
          <ImageIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary">
            {t('blogDetail.images.selectImage')}
          </Typography>
        </Stack>
      </Card>
    );
  }

  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 1 }}>
        <CardMedia
          component="img"
          height={100}
          image={`/api/media/${value}/file`}
          alt=""
          sx={{ objectFit: 'cover' }}
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </Card>
      <Typography variant="caption" fontFamily="monospace" display="block" sx={{ mb: 0.5 }}>
        {value}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={onSelect}>
          {t('blogDetail.images.changeImage')}
        </Button>
        <Button size="small" color="error" onClick={onClear}>
          {t('blogDetail.images.removeImage')}
        </Button>
      </Stack>
    </Box>
  );
}
