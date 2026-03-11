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
  currentPath: string;
  open: boolean;
  theme: Theme;
  onNavigate: (path: string) => void;
}

export default function SidebarNav({ sections, currentPath, open, theme, onNavigate }: SidebarNavProps) {
  return (
    <>
      {sections.map((section, idx) => (
        <List
          key={section.label ?? `section-${idx}`}
          {...(idx === 0 ? { 'data-tour': 'sidebar-nav' } : {})}
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
                    data-testid={`layout.nav.${item.path.replace(/^\//, '')}`}
                    onClick={() => onNavigate(item.path)}
                    sx={{
                      minHeight: 44,
                      px: 2.5,
                      justifyContent: open ? 'initial' : 'center',
                      borderRadius: open ? '0 24px 24px 0' : '50%',
                      mx: open ? 0 : 1,
                      my: 0.25,
                      ...(isActive && {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': { bgcolor: 'primary.dark' },
                        '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
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
                      primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 400 }}
                      sx={{
                        opacity: open ? 1 : 0,
                        transition: theme.transitions.create('opacity', {
                          duration: theme.transitions.duration.shorter,
                        }),
                      }}
                    />
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      ))}
    </>
  );
}
