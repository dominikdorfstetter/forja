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
import TranslateIcon from '@mui/icons-material/Translate';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

interface SetupChecklistProps {
  hasLocales: boolean;
  hasPages: boolean;
  hasBlogs: boolean;
  hasNavigation: boolean;
  onDismiss: () => void;
}

interface ChecklistStep {
  key: string;
  icon: React.ReactNode;
  done: boolean;
  route: string;
}

export default function SetupChecklist({
  hasLocales,
  hasPages,
  hasBlogs,
  hasNavigation,
  onDismiss,
}: SetupChecklistProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const steps: ChecklistStep[] = useMemo(
    () => [
      { key: 'createSite', icon: <WebIcon fontSize="small" />, done: true, route: '/sites' },
      { key: 'addLanguage', icon: <TranslateIcon fontSize="small" />, done: hasLocales, route: '/locales' },
      { key: 'createPage', icon: <DescriptionIcon fontSize="small" />, done: hasPages, route: '/pages' },
      { key: 'writeBlog', icon: <ArticleIcon fontSize="small" />, done: hasBlogs, route: '/blogs' },
      { key: 'setupNav', icon: <MenuIcon fontSize="small" />, done: hasNavigation, route: '/navigation' },
    ],
    [hasLocales, hasPages, hasBlogs, hasNavigation],
  );

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const progress = Math.round((completed / total) * 100);
  const allDone = completed === total;

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
              onClick={() => !step.done && navigate(step.route)}
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
                primaryTypographyProps={{
                  variant: 'body2',
                  sx: step.done ? { textDecoration: 'line-through', color: 'text.disabled' } : undefined,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {allDone && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button variant="outlined" size="small" onClick={onDismiss}>
            {t('setupChecklist.dismiss')}
          </Button>
        </Box>
      )}
    </Paper>
  );
}
