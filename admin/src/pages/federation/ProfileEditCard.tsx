import { useState } from 'react';
import { Avatar, Box, Button, Card, CardContent, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import EditIcon from '@mui/icons-material/Edit';
import ImageIcon from '@mui/icons-material/Image';
import { useTranslation } from 'react-i18next';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import apiService from '@/services/api';
import type { FederationSettings } from '@/types/api';

interface ProfileEditCardProps {
  siteId: string;
  settings: FederationSettings;
}

export default function ProfileEditCard({ siteId, settings }: ProfileEditCardProps) {
  const { t } = useTranslation();
  const { updateSettings } = useFederationMutations(siteId);

  const [editingProfile, setEditingProfile] = useState(false);
  const [bio, setBio] = useState<string | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

  const bioValue = bio ?? settings.summary ?? '';
  const avatarUrlValue = avatarUrl ?? settings.avatar_url ?? '';

  const handleSaveProfile = () => {
    updateSettings.mutate({ summary: bioValue, avatar_url: avatarUrlValue });
    setEditingProfile(false);
  };

  const handleMediaSelected = async (mediaId: string | null) => {
    if (!mediaId) return;
    try {
      const media = await apiService.getMediaById(mediaId);
      if (media.public_url) {
        setAvatarUrl(media.public_url);
      }
    } catch { /* ignore */ }
  };

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {!editingProfile ? (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                {settings.summary && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {settings.summary}
                  </Typography>
                )}
                {!settings.summary && (
                  <Typography variant="body2" color="text.disabled" fontStyle="italic">
                    {t('federation.profile.noBio')}
                  </Typography>
                )}
              </Box>
              <Tooltip title={t('federation.profile.edit')}>
                <IconButton size="small" onClick={() => setEditingProfile(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar
                  src={avatarUrlValue || undefined}
                  sx={{ width: 56, height: 56, cursor: 'pointer' }}
                  onClick={() => setPickerOpen(true)}
                >
                  <HubIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={t('federation.settings.avatarUrl')}
                    value={avatarUrlValue}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    inputProps={{ maxLength: 500 }}
                  />
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<ImageIcon />}
                    onClick={() => setPickerOpen(true)}
                    sx={{ mt: 0.5 }}
                  >
                    {t('federation.settings.chooseFromMedia')}
                  </Button>
                </Box>
              </Stack>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
                label={t('federation.settings.bio')}
                helperText={t('federation.settings.bioHelper')}
                value={bioValue}
                onChange={(e) => setBio(e.target.value)}
                inputProps={{ maxLength: 500 }}
              />
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" onClick={() => { setEditingProfile(false); setBio(undefined); setAvatarUrl(undefined); }}>
                  {t('common.actions.cancel')}
                </Button>
                <Button variant="contained" size="small" onClick={handleSaveProfile}>
                  {t('common.actions.save')}
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        siteId={siteId}
        onSelect={handleMediaSelected}
      />
    </>
  );
}
