import { type Theme } from '@mui/material/styles';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { ListSubheader, Tooltip } from '@mui/material';

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
}

interface MenuSection {
  label?: string;
  items: MenuItem[];
}

interface SidebarNavProps {
  sections: MenuSection[];
  adminSections?: MenuSection[];
  currentPath: string;
  open: boolean;
  theme: Theme;
  onNavigate: (path: string) => void;
}

function SectionList({
  section,
  idx,
  currentPath,
  open,
  theme,
  onNavigate,
  testIdPrefix,
}: {
  section: MenuSection;
  idx: number;
  currentPath: string;
  open: boolean;
  theme: Theme;
  onNavigate: (path: string) => void;
  testIdPrefix?: string;
}) {
  return (
    <List
      key={section.label ?? `section-${idx}`}
      {...(idx === 0 && !testIdPrefix ? { 'data-tour': 'sidebar-nav' } : {})}
      subheader={
        section.label ? (
          <ListSubheader
            sx={{
              lineHeight: '36px',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              opacity: open ? 1 : 0,
              transition: theme.transitions.create('opacity', {
                duration: theme.transitions.duration.shorter,
              }),
              whiteSpace: 'nowrap',
              ...(open ? {} : { px: 0, height: 12 }),
            }}
          >
            {open ? section.label : ''}
          </ListSubheader>
        ) : undefined
      }
    >
      {!open && section.label && <Divider sx={{ mx: 1, my: 0.5 }} />}
      {section.items.map((item) => {
        const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
        return (
          <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
            <Tooltip title={open ? '' : item.text} placement="right" arrow>
              <ListItemButton
                selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`layout.nav.${item.path === '/' ? 'dashboard' : item.path.replace(/^\//, '')}`}
                onClick={() => onNavigate(item.path)}
                sx={{
                  minHeight: 44,
                  px: open ? 1.5 : 2.5,
                  mx: open ? 1 : 1,
                  my: 0.25,
                  justifyContent: open ? 'initial' : 'center',
                  // M3 Expressive shape-morph: pill -> squircle when active.
                  // When collapsed, nav items remain circular.
                  borderRadius: open ? (isActive ? '14px' : '999px') : '50%',
                  transition: 'var(--motion-shape-morph), background 140ms, color 120ms',
                  ...(isActive && {
                    bgcolor: 'var(--primary-container)',
                    color: 'var(--on-primary-container)',
                    '&:hover': { bgcolor: 'var(--primary-container)' },
                    '& .MuiListItemIcon-root': { color: 'var(--on-primary-container)' },
                  }),
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 2.5 : 'auto',
                    justifyContent: 'center',
                    transition: theme.transitions.create('margin', {
                      duration: theme.transitions.duration.shorter,
                    }),
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    opacity: open ? 1 : 0,
                    transition: theme.transitions.create('opacity', {
                      duration: theme.transitions.duration.shorter,
                    }),
                  }}
                  slotProps={{
                    primary: { sx: { fontSize: '0.875rem', fontWeight: isActive ? 600 : 400 } }
                  }}
                />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        );
      })}
    </List>
  );
}

export default function SidebarNav({ sections, adminSections, currentPath, open, theme, onNavigate }: SidebarNavProps) {
  return (
    <>
      {sections.map((section, idx) => (
        <SectionList
          key={section.label ?? `ws-${idx}`}
          section={section}
          idx={idx}
          currentPath={currentPath}
          open={open}
          theme={theme}
          onNavigate={onNavigate}
        />
      ))}
      {adminSections && adminSections.length > 0 && (
        <>
          <Divider sx={{ my: 1 }} data-testid="layout.nav.admin-divider" />
          {adminSections.map((section, idx) => (
            <SectionList
              key={section.label ?? `admin-${idx}`}
              section={section}
              idx={idx}
              currentPath={currentPath}
              open={open}
              theme={theme}
              onNavigate={onNavigate}
              testIdPrefix="admin"
            />
          ))}
        </>
      )}
    </>
  );
}
