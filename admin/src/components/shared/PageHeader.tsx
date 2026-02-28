import { Box, Breadcrumbs, Button, Link, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { ReactNode, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface ActionProps {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  hidden?: boolean;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: ActionProps;
  secondaryAction?: ActionProps;
  secondaryActions?: ActionProps[];
  secondaryActionsLabel?: string;
}

export default function PageHeader({ title, subtitle, breadcrumbs, action, secondaryAction, secondaryActions, secondaryActionsLabel }: PageHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const visibleSecondaryActions = secondaryActions?.filter((a) => !a.hidden);

  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1 }}>
          {breadcrumbs.map((crumb, idx) =>
            crumb.path ? (
              <Link
                key={idx}
                component={RouterLink}
                to={crumb.path}
                underline="hover"
                color="inherit"
                sx={{ fontSize: '0.875rem' }}
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography key={idx} color="text.primary" sx={{ fontSize: '0.875rem' }}>
                {crumb.label}
              </Typography>
            )
          )}
        </Breadcrumbs>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold">{title}</Typography>
          {subtitle && (
            <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {visibleSecondaryActions && visibleSecondaryActions.length > 0 ? (
            <>
              <Button
                variant="outlined"
                endIcon={<ArrowDropDownIcon />}
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                {secondaryActionsLabel || 'More'}
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
              >
                {visibleSecondaryActions.map((item, idx) => (
                  <MenuItem
                    key={idx}
                    onClick={() => {
                      setAnchorEl(null);
                      item.onClick();
                    }}
                  >
                    {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                    <ListItemText>{item.label}</ListItemText>
                  </MenuItem>
                ))}
              </Menu>
            </>
          ) : secondaryAction && !secondaryAction.hidden ? (
            <Button variant="outlined" startIcon={secondaryAction.icon} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          {action && !action.hidden && (
            <Button variant="contained" startIcon={action.icon} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
