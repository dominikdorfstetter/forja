import { Avatar, Box, ButtonBase, IconButton, Tooltip, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { SiteRole } from '@/types/api';

export interface SidebarUserFooterProps {
  userFullName: string | null;
  userImageUrl: string | null;
  currentRole: SiteRole | null;
  isGuest: boolean;
  open: boolean;
  onLogout: () => void;
}

const initialsFrom = (name: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
};

/**
 * Sidebar footer: identity block anchored to the drawer bottom with the
 * signed-in user's avatar, name, current site role, and a logout action.
 * Mirrors the design cue that the role tag ("Owner") belongs to the user
 * rather than to the site badge at the top.
 */
export default function SidebarUserFooter({
  userFullName,
  userImageUrl,
  currentRole,
  isGuest,
  open,
  onLogout,
}: SidebarUserFooterProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const roleLabel = currentRole ? t(`members.roles.${currentRole}`) : null;
  const logoutLabel = isGuest ? t('layout.sidebar.leaveDemo') : t('layout.sidebar.logout');
  const profileLabel = t('layout.toolbar.profile');
  // Guests don't have a profile surface to land on, so the identity
  // block stays static for them and only the logout icon is live.
  const profileClickable = !isGuest;
  const handleProfileClick = profileClickable ? () => navigate('/profile') : undefined;
  const avatar = (
    <Avatar
      src={userImageUrl ?? undefined}
      alt={userFullName ?? ''}
      sx={{
        width: 36,
        height: 36,
        bgcolor: 'var(--primary-container)',
        color: 'var(--on-primary-container)',
        fontSize: 13,
        fontWeight: 700,
        fontVariationSettings: '"wght" 700, "opsz" 13',
      }}
    >
      {initialsFrom(userFullName)}
    </Avatar>
  );

  if (!open) {
    return (
      <Box
        sx={{
          px: 1,
          py: 1.25,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Tooltip title={logoutLabel} placement="right" arrow>
          <IconButton
            onClick={onLogout}
            data-testid="layout.btn.logout"
            size="small"
            sx={{ color: 'var(--on-surface-variant)' }}
          >
            <LogoutIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <Tooltip
        title={profileClickable ? profileLabel : ''}
        placement="top"
        arrow
        disableHoverListener={!profileClickable}
      >
        <ButtonBase
          focusRipple={profileClickable}
          disabled={!profileClickable}
          onClick={handleProfileClick}
          data-testid="layout.btn.profile"
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            p: 0.5,
            mx: -0.5,
            borderRadius: '12px',
            textAlign: 'left',
            transition: 'background-color 120ms',
            '&:hover': profileClickable
              ? { bgcolor: 'var(--surface-container-high)' }
              : undefined,
            '&:focus-visible': profileClickable
              ? { outline: '2px solid var(--primary)', outlineOffset: 1 }
              : undefined,
          }}
        >
          {avatar}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              component="div"
              noWrap
              sx={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--on-surface)',
                fontVariationSettings: '"wght" 600, "opsz" 13',
                letterSpacing: -0.1,
                lineHeight: 1.2,
              }}
            >
              {userFullName ?? ''}
            </Typography>
            {roleLabel && (
              <Typography
                component="div"
                noWrap
                data-testid="layout.role-chip"
                sx={{
                  mt: 0.15,
                  fontSize: 11,
                  color: 'var(--on-surface-variant)',
                  fontVariationSettings: '"wght" 500, "opsz" 11',
                  textTransform: 'capitalize',
                  letterSpacing: 0.2,
                }}
              >
                {roleLabel}
              </Typography>
            )}
          </Box>
        </ButtonBase>
      </Tooltip>
      <Tooltip title={logoutLabel} placement="top" arrow>
        <IconButton
          onClick={onLogout}
          data-testid="layout.btn.logout"
          size="small"
          sx={{
            color: 'var(--on-surface-variant)',
            width: 32,
            height: 32,
            '&:hover': {
              color: 'var(--on-surface)',
              bgcolor: 'var(--surface-container-high)',
            },
          }}
        >
          <LogoutIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
