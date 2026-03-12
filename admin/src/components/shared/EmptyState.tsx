import { Box, Button, Stack, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <Box role="status" aria-live="polite" data-testid="empty-state" sx={{ textAlign: 'center', py: 8 }}>
      <Box sx={{ color: 'text.disabled', mb: 2 }}>
        {icon || <InboxIcon sx={{ fontSize: 64 }} />}
      </Box>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}
      {(action || secondaryAction) && (
        <Stack direction="row" spacing={2} justifyContent="center">
          {action && (
            <Button variant="outlined" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="text" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
