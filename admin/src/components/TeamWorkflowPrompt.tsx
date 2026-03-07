import { Alert, Button, Stack } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';

export default function TeamWorkflowPrompt() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { context } = useSiteContextData();

  const dismissMutation = useMutation({
    mutationFn: () =>
      apiService.updateSiteSettings(selectedSiteId, {
        team_features_prompt_dismissed: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteContext', selectedSiteId] });
    },
  });

  if (!context.suggestions.show_team_workflow_prompt) {
    return null;
  }

  return (
    <Alert
      severity="info"
      icon={<GroupsIcon />}
      sx={{ mb: 3 }}
      action={
        <Stack direction="row" spacing={1}>
          <Button
            color="inherit"
            size="small"
            onClick={() => navigate('/settings?highlight=editorial_workflow')}
          >
            {t('teamWorkflowPrompt.enableButton')}
          </Button>
          <Button
            color="inherit"
            size="small"
            onClick={() => dismissMutation.mutate()}
          >
            {t('teamWorkflowPrompt.dismissButton')}
          </Button>
        </Stack>
      }
    >
      {t('teamWorkflowPrompt.message')}
    </Alert>
  );
}
