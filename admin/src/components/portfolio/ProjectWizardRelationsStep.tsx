import { useState } from 'react';
import {
  Stack,
  Typography,
  Button,
  Card,
  CardMedia,
  CardActions,
  Chip,
  IconButton,
  Autocomplete,
  TextField,
  Box,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { getCvEntries } from '@/services/cv';
import { getMediaById } from '@/services/media';
import { getSkills } from '@/services/skills';
import type { ProjectMediaRequest, SkillResponse, CvEntryResponse } from '@/types/api';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import type { ProjectWizardFormData } from './ProjectWizard';

interface ProjectWizardRelationsStepProps {
  watch: UseFormWatch<ProjectWizardFormData>;
  setValue: UseFormSetValue<ProjectWizardFormData>;
  siteId: string;
}

interface MediaItem extends ProjectMediaRequest {
  url?: string | null;
}

export default function ProjectWizardRelationsStep({
  watch,
  setValue,
  siteId,
}: ProjectWizardRelationsStepProps) {
  const { t } = useTranslation();
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const media: MediaItem[] = watch('media') ?? [];
  const skillIds: string[] = watch('skill_ids') ?? [];
  const cvEntryIds: string[] = watch('cv_entry_ids') ?? [];

  const { data: skillsData } = useQuery({
    queryKey: ['skills', siteId, 'all'],
    queryFn: () => getSkills(siteId, { page_size: 200 }),
    enabled: !!siteId,
  });
  const allSkills: SkillResponse[] = skillsData?.data ?? [];

  const { data: entriesData } = useQuery({
    queryKey: ['cv-entries', siteId, 'all'],
    queryFn: () => getCvEntries(siteId, { page_size: 200 }),
    enabled: !!siteId,
  });
  const allEntries: CvEntryResponse[] = entriesData?.data ?? [];

  const handleMediaSelect = async (mediaId: string | null) => {
    if (mediaId) {
      try {
        const mediaItem = await getMediaById(mediaId);
        const newMedia: MediaItem[] = [
          ...media,
          {
            media_id: mediaId,
            display_order: media.length,
            is_cover: media.length === 0,
            url: mediaItem.public_url,
          },
        ];
        setValue('media', newMedia, { shouldDirty: true });
      } catch {
        // Silently fail — user can retry
      }
    }
    setMediaPickerOpen(false);
  };

  const handleMediaRemove = (index: number) => {
    const updated = media.filter((_, i) => i !== index);
    // If removed item was cover, make first remaining item cover
    if (media[index]?.is_cover && updated.length > 0) {
      updated[0] = { ...updated[0], is_cover: true };
    }
    setValue('media', updated, { shouldDirty: true });
  };

  const handleToggleCover = (index: number) => {
    const updated = media.map((m, i) => ({
      ...m,
      is_cover: i === index,
    }));
    setValue('media', updated, { shouldDirty: true });
  };

  const selectedSkills = allSkills.filter((s) => skillIds.includes(s.id));
  const selectedEntries = allEntries.filter((e) => cvEntryIds.includes(e.id));

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      {/* Images section */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('wizard.project.fields.images')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {media.map((item, index) => (
            <Card key={item.media_id} sx={{ width: 120, position: 'relative' }} data-testid={`project-wizard.media.${index}`}>
              <CardMedia
                component="img"
                height={80}
                image={item.url ?? ''}
                alt={`Media ${index + 1}`}
                sx={{ objectFit: 'cover' }}
              />
              <CardActions sx={{ p: 0.5, justifyContent: 'space-between' }}>
                <Chip
                  label={item.is_cover ? t('wizard.project.cover') : t('wizard.project.setCover')}
                  size="small"
                  color={item.is_cover ? 'primary' : 'default'}
                  onClick={() => handleToggleCover(index)}
                  data-testid={`project-wizard.media.cover.${index}`}
                />
                <IconButton
                  size="small"
                  onClick={() => handleMediaRemove(index)}
                  aria-label={t('common.actions.delete')}
                  data-testid={`project-wizard.media.delete.${index}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          ))}
        </Box>
        <Button
          startIcon={<AddPhotoAlternateIcon />}
          onClick={() => setMediaPickerOpen(true)}
          data-testid="project-wizard.media.add"
        >
          {t('wizard.project.addImage')}
        </Button>
      </Box>
      {/* Skills section */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('wizard.project.fields.skills')}
        </Typography>
        <Autocomplete
          multiple
          options={allSkills}
          getOptionLabel={(option) => option.name}
          value={selectedSkills}
          // eslint-disable-next-line forja/require-read-only-gate -- wizard parent (Portfolio.tsx) opens this dialog only when canWrite is true
          onChange={(_, newValue) =>
            setValue('skill_ids', newValue.map((s) => s.id), { shouldDirty: true })
          }
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderValue={(value, getItemProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getItemProps({ index });
              return <Chip key={key} label={option.name} size="small" {...tagProps} />;
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={t('wizard.project.searchSkills')}
              data-testid="project-wizard.field.skill_ids"
            />
          )}
          data-testid="project-wizard.skills-autocomplete"
        />
      </Box>
      {/* CV Entries section */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('wizard.project.fields.cvEntries')}
        </Typography>
        <Autocomplete
          multiple
          options={allEntries}
          getOptionLabel={(option) => `${option.company} (${option.entry_type})`}
          value={selectedEntries}
          // eslint-disable-next-line forja/require-read-only-gate -- wizard parent (Portfolio.tsx) opens this dialog only when canWrite is true
          onChange={(_, newValue) =>
            setValue('cv_entry_ids', newValue.map((e) => e.id), { shouldDirty: true })
          }
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderValue={(value, getItemProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getItemProps({ index });
              return <Chip key={key} label={option.company} size="small" {...tagProps} />;
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={t('wizard.project.searchCvEntries')}
              data-testid="project-wizard.field.cv_entry_ids"
            />
          )}
          data-testid="project-wizard.cv-entries-autocomplete"
        />
      </Box>
      <MediaPickerDialog
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        siteId={siteId}
        onSelect={handleMediaSelect}
      />
    </Stack>
  );
}
