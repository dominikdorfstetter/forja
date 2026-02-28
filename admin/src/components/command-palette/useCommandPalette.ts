import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useThemeMode } from '@/theme';
import apiService from '@/services/api';
import type { BlogListItem, PageListItem } from '@/types/api';
import type { ReactNode } from 'react';

export interface Command {
  id: string;
  label: string;
  icon?: ReactNode;
  category: 'navigation' | 'action' | 'blog' | 'page' | 'site';
  action: () => void;
}

interface UseCommandPaletteReturn {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  commands: Command[];
  execute: (command: Command) => void;
}

export function useCommandPalette(
  navCommands: Command[],
): UseCommandPaletteReturn {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const { themeId, setThemeId, options: themeOptions } = useThemeMode();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce the query for entity search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  // Global Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Quick actions
  const actionCommands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];

    // Theme toggle - cycle to next option
    const currentIdx = themeOptions.findIndex((o) => o.id === themeId);
    const nextTheme = themeOptions[(currentIdx + 1) % themeOptions.length];
    cmds.push({
      id: 'action:toggle-theme',
      label: t('commandPalette.actions.toggleTheme'),
      category: 'action',
      action: () => setThemeId(nextTheme.id),
    });

    cmds.push({
      id: 'action:logout',
      label: t('commandPalette.actions.logout'),
      category: 'action',
      action: () => { logout(); navigate('/login'); },
    });

    return cmds;
  }, [t, themeId, themeOptions, setThemeId, logout, navigate]);

  // Entity search queries
  const shouldSearch = open && debouncedQuery.length >= 2 && !!selectedSiteId;

  const { data: blogsData } = useQuery({
    queryKey: ['cmd-search-blogs', selectedSiteId, debouncedQuery],
    queryFn: () => apiService.getBlogs(selectedSiteId, { per_page: 5 }),
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  const { data: pagesData } = useQuery({
    queryKey: ['cmd-search-pages', selectedSiteId, debouncedQuery],
    queryFn: () => apiService.getPages(selectedSiteId, { per_page: 5 }),
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  // Build dynamic entity commands
  const entityCommands = useMemo<Command[]>(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const cmds: Command[] = [];
    const lowerQ = debouncedQuery.toLowerCase();

    // Filter blogs
    if (blogsData?.data) {
      blogsData.data
        .filter((b: BlogListItem) => b.slug?.toLowerCase().includes(lowerQ) || b.author?.toLowerCase().includes(lowerQ))
        .slice(0, 5)
        .forEach((b: BlogListItem) => {
          cmds.push({
            id: `blog:${b.id}`,
            label: b.slug ?? b.id,
            category: 'blog',
            action: () => navigate(`/blogs/${b.id}`),
          });
        });
    }

    // Filter pages
    if (pagesData?.data) {
      pagesData.data
        .filter((p: PageListItem) => p.route.toLowerCase().includes(lowerQ) || p.slug?.toLowerCase().includes(lowerQ))
        .slice(0, 5)
        .forEach((p: PageListItem) => {
          cmds.push({
            id: `page:${p.id}`,
            label: p.route,
            category: 'page',
            action: () => navigate(`/pages/${p.id}`),
          });
        });
    }

    return cmds;
  }, [debouncedQuery, blogsData, pagesData, navigate]);

  // Merge and filter
  const commands = useMemo(() => {
    const all = [...navCommands, ...actionCommands, ...entityCommands];
    if (!query) return all.filter((c) => c.category === 'navigation' || c.category === 'action');
    const lowerQ = query.toLowerCase();
    return all.filter((c) => c.label.toLowerCase().includes(lowerQ));
  }, [navCommands, actionCommands, entityCommands, query]);

  // Keep selection in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [commands.length]);

  const execute = useCallback((command: Command) => {
    command.action();
    setOpen(false);
  }, []);

  return {
    open,
    setOpen,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    commands,
    execute,
  };
}
