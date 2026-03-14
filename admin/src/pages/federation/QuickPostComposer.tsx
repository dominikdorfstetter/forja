import { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import HubIcon from '@mui/icons-material/Hub';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';

interface QuickPostComposerProps {
  siteId: string;
  handle?: string;
}

const MAX_CHARS = 500;

export default function QuickPostComposer({ siteId, handle }: QuickPostComposerProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');

  const createMutation = useMutation({
    mutationFn: (body: string) => apiService.createFederationNote(siteId, { body }),
    onSuccess: () => {
      setText('');
      enqueueSnackbar(t('federation.quickPost.posted'), { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['federation-notes', siteId] });
      queryClient.invalidateQueries({ queryKey: ['federation-stats', siteId] });
      queryClient.invalidateQueries({ queryKey: ['federation-activities', siteId] });
    },
  });

  const handlePost = () => {
    if (!text.trim()) return;
    createMutation.mutate(text);
  };

  return (
    <Card sx={{ mb: 0 }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, mt: 0.5 }}>
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color={text.length > MAX_CHARS * 0.9 ? 'warning.main' : 'text.disabled'}>
                {text.length}/{MAX_CHARS}
              </Typography>
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
                  : t('federation.quickPost.post')}
              </Button>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
