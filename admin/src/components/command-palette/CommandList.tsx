import { useMemo } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
  Box,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Command } from './useCommandPalette';

const CATEGORY_ORDER = ['context', 'navigation', 'action', 'blog', 'page', 'site'] as const;

function groupByCategory(commands: Command[]): Map<string, Command[]> {
  const map = new Map<string, Command[]>();
  for (const cmd of commands) {
    const list = map.get(cmd.category) || [];
    list.push(cmd);
    map.set(cmd.category, list);
  }
  return map;
}

interface CommandListProps {
  commands: Command[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onExecute: (cmd: Command) => void;
  uniqueId: string;
}

export default function CommandList({ commands, selectedIndex, onSelect, onExecute, uniqueId }: CommandListProps) {
  const { t } = useTranslation();

  const grouped = groupByCategory(commands);

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case 'context': return t('commandPalette.categories.context');
      case 'navigation': return t('commandPalette.categories.navigation');
      case 'action': return t('commandPalette.categories.actions');
      case 'blog': return t('commandPalette.categories.blogs');
      case 'page': return t('commandPalette.categories.pages');
      case 'site': return t('commandPalette.categories.sites');
      default: return cat;
    }
  };

  // Pre-compute flat index mapping so we don't mutate during render
  const flatIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const cat of CATEGORY_ORDER) {
      const group = grouped.get(cat);
      if (!group || group.length === 0) continue;
      for (const cmd of group) {
        map.set(cmd.id, idx++);
      }
    }
    return map;
  }, [grouped]);

  if (commands.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {t('commandPalette.noResults')}
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ overflow: 'auto', py: 0 }} role="listbox" id="command-palette-listbox">
      {CATEGORY_ORDER.map((cat) => {
        const group = grouped.get(cat);
        if (!group || group.length === 0) return null;
        const groupLabelId = `${uniqueId}-group-${cat}`;
        return (
          <li key={cat} role="group" aria-labelledby={groupLabelId}>
            <ListSubheader
              id={groupLabelId}
              component="div"
              role="presentation"
              sx={{
                lineHeight: '32px',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {categoryLabel(cat)}
            </ListSubheader>
            <List disablePadding role="presentation">
              {group.map((cmd) => {
                const idx = flatIndexMap.get(cmd.id) ?? 0;
                return (
                  <ListItem
                    key={cmd.id}
                    disablePadding
                    role="option"
                    id={`command-palette-option-${cmd.id}`}
                    aria-selected={idx === selectedIndex}
                  >
                    <ListItemButton
                      tabIndex={-1}
                      selected={idx === selectedIndex}
                      onClick={() => onExecute(cmd)}
                      onMouseEnter={() => onSelect(idx)}
                      sx={{ py: 0.75 }}
                    >
                      {cmd.icon && <ListItemIcon sx={{ minWidth: 36 }}>{cmd.icon}</ListItemIcon>}
                      <ListItemText
                        primary={cmd.label}
                        primaryTypographyProps={{ fontSize: '0.875rem' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </li>
        );
      })}
    </List>
  );
}
