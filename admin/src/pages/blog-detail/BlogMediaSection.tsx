import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardMedia,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import { Controller, type Control, type UseFormWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { BlogContentFormData } from './blogDetailSchema';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';

interface BlogMediaSectionProps {
  control: Control<BlogContentFormData>;
  watch: UseFormWatch<BlogContentFormData>;
  setValue: UseFormSetValue<BlogContentFormData>;
  onSnapshot: () => void;
  siteId: string;
}

type ImageField = 'cover_image_id' | 'header_image_id';

export default function BlogMediaSection({
  control,
  watch,
  setValue,
  onSnapshot,
  siteId,
}: BlogMediaSectionProps) {
  const { t } = useTranslation();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<ImageField>('cover_image_id');

  const openPicker = (field: ImageField) => {
    setPickerTarget(field);
    setPickerOpen(true);
  };

  return (
    <Box>
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
