import { Box, Button, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { Fragment, ReactNode, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Icon } from '@/components/design-system';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface ActionProps {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  hidden?: boolean;
  testId?: string;
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
}

const m3FilledSx = {
  bgcolor: 'var(--primary)',
  color: 'var(--primary-c)',
  borderRadius: '999px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: 14,
  height: 40,
  px: 2.5,
  boxShadow: 'none',
  '&:hover': { bgcolor: 'color-mix(in oklch, var(--primary) 88%, white)', boxShadow: 'none' },
  '&:active': { transform: 'scale(0.97)' },
};

const m3OutlinedSx = {
  bgcolor: 'transparent',
  color: 'var(--on-surface)',
  border: '1px solid var(--outline)',
  borderRadius: '999px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: 14,
  height: 40,
  px: 2.5,
  '&:hover': { bgcolor: 'var(--surface-container-high)', border: '1px solid var(--outline)' },
  '&:active': { transform: 'scale(0.97)' },
};

interface PageHeaderProps {
  icon?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: ActionProps;
  secondaryAction?: ActionProps;
  secondaryActions?: ActionProps[];
  secondaryActionsLabel?: string;
}

export default function PageHeader({ icon, title, subtitle, breadcrumbs, action, secondaryAction, secondaryActions, secondaryActionsLabel }: PageHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const visibleSecondaryActions = secondaryActions?.filter((a) => !a.hidden);

  return (
    <Box sx={{ mb: 3 }} data-testid="page-header">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Box
          component="nav"
          aria-label="Breadcrumb"
          sx={{
            fontSize: 13,
            color: 'var(--on-surface-variant)',
            fontWeight: 500,
            mb: 0.75,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            fontVariationSettings: '"wght" 500, "opsz" 13',
          }}
        >
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            const content = crumb.path ? (
              <Box
                component={RouterLink}
                to={crumb.path}
                sx={{
                  color: 'var(--on-surface-variant)',
                  textDecoration: 'none',
                  '&:hover': { color: 'var(--on-surface)', textDecoration: 'underline' },
                }}
              >
                {crumb.label}
              </Box>
            ) : (
              <Box
                component="span"
                sx={
                  isLast
                    ? {
                        color: 'var(--on-surface)',
                        fontWeight: 600,
                        fontVariationSettings: '"wght" 600, "opsz" 13',
                      }
                    : { color: 'var(--on-surface-variant)' }
                }
              >
                {crumb.label}
              </Box>
            );
            const crumbKey = crumb.path ?? `segment:${crumb.label}`;
            return (
              <Fragment key={crumbKey}>
                {content}
                {!isLast && (
                  <Box component="span" aria-hidden="true" sx={{ mx: 0.75, color: 'var(--on-surface-variant)' }}>
                    /
                  </Box>
                )}
              </Fragment>
            );
          })}
        </Box>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
            {icon && (
              <Box
                aria-hidden="true"
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '14px',
                  bgcolor: 'var(--primary-container)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name={icon} size={26} color="var(--on-primary-container)" />
              </Box>
            )}
            <Typography
              variant="h4"
              component="h1"
              data-testid="page-header.title"
              sx={{
                fontWeight: 700,
                letterSpacing: -0.5,
                fontVariationSettings: '"wght" 700, "opsz" 32',
              }}
            >
              {title}
            </Typography>
          </Box>
          {subtitle && (
            <Typography
              component="div"
              data-testid="page-header.subtitle"
              sx={{
                mt: 1,
                fontSize: 13.5,
                lineHeight: 1.5,
                fontWeight: 400,
                color: 'var(--on-surface-variant)',
                fontVariationSettings: '"wght" 400, "opsz" 14',
              }}
            >
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
                aria-haspopup="menu"
                aria-expanded={Boolean(anchorEl)}
                sx={m3OutlinedSx}
              >
                {secondaryActionsLabel || 'More'}
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                slotProps={{
                  paper: {
                    sx: {
                      bgcolor: 'var(--surface-container-high)',
                      color: 'var(--on-surface)',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '14px',
                      mt: 0.5,
                    },
                  },
                }}
              >
                {visibleSecondaryActions.map((item) => (
                  <MenuItem
                    key={item.label}
                    onClick={() => {
                      setAnchorEl(null);
                      item.onClick();
                    }}
                    sx={{
                      fontSize: 14,
                      borderRadius: '10px',
                      mx: 0.5,
                      my: 0.25,
                      '&:hover': { bgcolor: 'var(--surface-container-highest)' },
                    }}
                  >
                    {item.icon && <ListItemIcon sx={{ color: 'var(--on-surface-variant)' }}>{item.icon}</ListItemIcon>}
                    <ListItemText>{item.label}</ListItemText>
                  </MenuItem>
                ))}
              </Menu>
            </>
          ) : secondaryAction && !secondaryAction.hidden ? (
            <Button
              variant="outlined"
              color={secondaryAction.color}
              startIcon={secondaryAction.icon}
              onClick={secondaryAction.onClick}
              data-testid={secondaryAction.testId || 'page-header.btn.secondary'}
              sx={m3OutlinedSx}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
          {action && !action.hidden && (
            <Button
              variant="contained"
              startIcon={action.icon}
              onClick={action.onClick}
              data-testid={action.testId || 'page-header.btn.primary'}
              sx={m3FilledSx}
            >
              {action.label}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
