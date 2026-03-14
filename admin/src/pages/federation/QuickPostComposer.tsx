import { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ScheduleIcon from '@mui/icons-material/Schedule';
import HubIcon from '@mui/icons-material/Hub';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';

interface QuickPostComposerProps {
  siteId: string;
  handle?: string;
  avatarUrl?: string;
}

const MAX_CHARS = 500;

export default function QuickPostComposer({ siteId, handle, avatarUrl }: QuickPostComposerProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);

  const isScheduled = showSchedule && scheduledAt !== '';

  const createMutation = useMutation({
    mutationFn: (data: { body: string; scheduled_at?: string }) =>
      apiService.createFederationNote(siteId, data),
    onSuccess: (_data, variables) => {
      setText('');
      setScheduledAt('');
      setShowSchedule(false);
      const msg = variables.scheduled_at
        ? t('federation.quickPost.scheduledSuccess')
        : t('federation.quickPost.posted');
      enqueueSnackbar(msg, { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['federation-notes', siteId] });
      queryClient.invalidateQueries({ queryKey: ['federation-stats', siteId] });
      queryClient.invalidateQueries({ queryKey: ['federation-activities', siteId] });
    },
  });

  const handlePost = () => {
    if (!text.trim()) return;
    const data: { body: string; scheduled_at?: string } = { body: text };
    if (isScheduled) {
      data.scheduled_at = new Date(scheduledAt).toISOString();
    }
    createMutation.mutate(data);
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Avatar src={avatarUrl || undefined} sx={{ bgcolor: 'primary.main', width: 40, height: 40, mt: 0.5 }}>
            <HubIcon fontSize="small" />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            {handle && (
              <Typography variant="caption" color="text.secondary" fontFamily="monospace" sx={{ mb: 0.5, display: 'block' }}>
                @{handle}
              </Typography>
            )}
            <TextField
              multiline
              minRows={2}
              maxRows={6}
              fullWidth
              variant="standard"
              placeholder={t('federation.quickPost.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              slotProps={{
                htmlInput: { maxLength: MAX_CHARS },
                input: { disableUnderline: true },
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                },
              }}
            />

            {showSchedule && (
              <Box sx={{ mt: 1 }}>
                <TextField
                  type="datetime-local"
                  size="small"
                  fullWidth
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: new Date().toISOString().slice(0, 16) }}
                />
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color={text.length > MAX_CHARS * 0.9 ? 'warning.main' : 'text.disabled'}>
                {text.length}/{MAX_CHARS}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant={showSchedule ? 'outlined' : 'text'}
                  startIcon={<ScheduleIcon sx={{ fontSize: '16px !important' }} />}
                  onClick={() => {
                    setShowSchedule(!showSchedule);
                    if (showSchedule) setScheduledAt('');
                  }}
                  sx={{ borderRadius: 5, textTransform: 'none' }}
                >
                  {t('federation.quickPost.schedule')}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  endIcon={<SendIcon sx={{ fontSize: '16px !important' }} />}
                  onClick={handlePost}
                  disabled={!text.trim() || createMutation.isPending}
                  sx={{ borderRadius: 5, textTransform: 'none', px: 2 }}
                >
                  {createMutation.isPending
                    ? t('federation.quickPost.posting')
                    : isScheduled
                      ? t('federation.quickPost.schedulePost')
                      : t('federation.quickPost.post')}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
