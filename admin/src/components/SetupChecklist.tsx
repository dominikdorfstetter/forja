import { useMemo } from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WebIcon from '@mui/icons-material/Web';
import EditIcon from '@mui/icons-material/Edit';
import PreviewIcon from '@mui/icons-material/Preview';
import PublishIcon from '@mui/icons-material/Publish';
import SettingsIcon from '@mui/icons-material/Settings';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import WorkflowIcon from '@mui/icons-material/AccountTree';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

interface SetupChecklistProps {
  hasLocales: boolean;
  hasPages: boolean;
  hasBlogs: boolean;
  hasNavigation: boolean;
  hasPublished: boolean;
  hasSampleContent: boolean;
  isTeam: boolean;
  completedSteps: string[];
  onDismiss: () => void;
  onCompleteStep: (stepKey: string) => void;
  onDeleteSamples?: () => void;
}

interface ChecklistStep {
  key: string;
  icon: React.ReactNode;
  done: boolean;
  route: string;
  estimateKey: string;
}

export default function SetupChecklist({
  hasBlogs,
  hasPublished,
  hasSampleContent,
  isTeam,
  completedSteps,
  onDismiss,
  onCompleteStep,
  onDeleteSamples,
}: SetupChecklistProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const steps: ChecklistStep[] = useMemo(() => {
    const done = (key: string) => completedSteps.includes(key);
    const base: ChecklistStep[] = [
      { key: 'create_site', icon: <WebIcon fontSize="small" />, done: true, route: '/sites', estimateKey: 'done' },
      { key: 'edit_first_post', icon: <EditIcon fontSize="small" />, done: done('edit_first_post') || hasBlogs, route: '/blogs', estimateKey: '2min' },
      { key: 'preview_site', icon: <PreviewIcon fontSize="small" />, done: done('preview_site'), route: '/settings', estimateKey: '30sec' },
      { key: 'publish_first_post', icon: <PublishIcon fontSize="small" />, done: done('publish_first_post') || hasPublished, route: '/blogs', estimateKey: '1min' },
      { key: 'customize_settings', icon: <SettingsIcon fontSize="small" />, done: done('customize_settings'), route: '/settings', estimateKey: '2min' },
    ];

    if (isTeam) {
      base.push(
        { key: 'invite_team', icon: <GroupAddIcon fontSize="small" />, done: done('invite_team'), route: '/members', estimateKey: '1min' },
        { key: 'setup_workflow', icon: <WorkflowIcon fontSize="small" />, done: done('setup_workflow'), route: '/settings', estimateKey: '1min' },
      );
    }

    return base;
  }, [completedSteps, hasBlogs, hasPublished, isTeam]);

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const progress = Math.round((completed / total) * 100);
  const allDone = completed === total;

  const handleStepClick = (step: ChecklistStep) => {
    if (step.done) return;
    onCompleteStep(step.key);
    navigate(step.route);
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="h2" fontWeight={600} gutterBottom>
            {allDone ? t('setupChecklist.completeTitle') : t('setupChecklist.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {allDone ? t('setupChecklist.completeDescription') : t('setupChecklist.description')}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onDismiss} aria-label={t('common.actions.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ flex: 1, height: 8, borderRadius: 4 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {t('setupChecklist.progress', { completed, total })}
        </Typography>
      </Stack>

      <List disablePadding>
        {steps.map((step) => (
          <ListItem key={step.key} disablePadding>
            <ListItemButton
              onClick={() => handleStepClick(step)}
              disabled={step.done}
              sx={{ borderRadius: 1, py: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox
                  edge="start"
                  checked={step.done}
                  disableRipple
                  tabIndex={-1}
                  size="small"
                  sx={{ p: 0 }}
                />
              </ListItemIcon>
              <ListItemIcon sx={{ minWidth: 32, color: step.done ? 'text.disabled' : 'primary.main' }}>
                {step.icon}
              </ListItemIcon>
              <ListItemText
                primary={t(`setupChecklist.steps.${step.key}`)}
                secondary={step.done ? undefined : t(`setupChecklist.descriptions.${step.key}`)}
                primaryTypographyProps={{
                  variant: 'body2',
                  sx: step.done ? { textDecoration: 'line-through', color: 'text.disabled' } : undefined,
                }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              {!step.done && (
                <Typography variant="caption" color="text.disabled" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                  ~{t(`setupChecklist.estimates.${step.estimateKey}`)}
                </Typography>
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'center' }}>
        {hasSampleContent && onDeleteSamples && (
          <Button variant="text" size="small" color="warning" onClick={onDeleteSamples}>
            {t('setupChecklist.deleteSamples')}
          </Button>
        )}
        {allDone && (
          <Button variant="outlined" size="small" onClick={onDismiss}>
            {t('setupChecklist.dismiss')}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
