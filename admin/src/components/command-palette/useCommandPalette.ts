import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import apiService from '@/services/api';
import type { BlogListItem, PageListItem } from '@/types/api';
import type { ReactNode } from 'react';

export interface Command {
  id: string;
  label: string;
  icon?: ReactNode;
  category: 'context' | 'navigation' | 'action' | 'blog' | 'page' | 'site';
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

// Route → related nav command IDs for relevance scoring
const ROUTE_RELEVANCE: Record<string, string[]> = {
  '/dashboard': ['nav:blogs', 'nav:pages', 'nav:media', 'nav:my-drafts'],
  '/my-drafts': ['nav:blogs', 'nav:pages', 'nav:dashboard'],
  '/blogs': ['nav:pages', 'nav:media', 'nav:taxonomy', 'nav:content-templates'],
  '/pages': ['nav:blogs', 'nav:media', 'nav:taxonomy', 'nav:navigation'],
  '/content-templates': ['nav:blogs', 'nav:pages'],
  '/media': ['nav:blogs', 'nav:pages'],
  '/cv': ['nav:dashboard', 'nav:blogs'],
  '/navigation': ['nav:pages', 'nav:dashboard'],
  '/taxonomy': ['nav:blogs', 'nav:pages'],
  '/social-links': ['nav:navigation', 'nav:settings'],
  '/redirects': ['nav:pages', 'nav:navigation'],
  '/webhooks': ['nav:settings', 'nav:api-keys'],
  '/activity': ['nav:dashboard', 'nav:settings'],
  '/members': ['nav:settings', 'nav:activity'],
  '/settings': ['nav:dashboard', 'nav:members'],
  '/sites': ['nav:settings', 'nav:dashboard'],
  '/locales': ['nav:settings', 'nav:sites'],
  '/legal': ['nav:settings', 'nav:sites'],
  '/api-keys': ['nav:webhooks', 'nav:settings'],
};

const TOP_N = 5;

export function useCommandPalette(
  navCommands: Command[],
  contextCommands: Command[],
  currentPath: string,
): UseCommandPaletteReturn {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { selectedSiteId } = useSiteContext();

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

    cmds.push({
      id: 'action:logout',
      label: t('commandPalette.actions.logout'),
      category: 'action',
      action: () => { logout(); navigate('/login'); },
    });

    return cmds;
  }, [t, logout, navigate]);

  // Entity search queries
  const shouldSearch = open && debouncedQuery.length >= 2 && !!selectedSiteId;

  const { data: blogsData } = useQuery({
    queryKey: ['cmd-search-blogs', selectedSiteId, debouncedQuery],
    queryFn: () => apiService.getBlogs(selectedSiteId, { page_size: 5 }),
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  const { data: pagesData } = useQuery({
    queryKey: ['cmd-search-pages', selectedSiteId, debouncedQuery],
    queryFn: () => apiService.getPages(selectedSiteId, { page_size: 5 }),
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

  // Resolve parent route for detail pages (e.g. /blogs/123 → /blogs)
  const parentRoute = useMemo(() => {
    const segments = currentPath.split('/').filter(Boolean);
    return segments.length > 0 ? `/${segments[0]}` : currentPath;
  }, [currentPath]);

  // Merge and filter
  const commands = useMemo(() => {
    const all = [...contextCommands, ...navCommands, ...actionCommands, ...entityCommands];

    if (!query) {
      // Score-based top-N selection
      const relevantIds = ROUTE_RELEVANCE[parentRoute] ?? [];
      const scored = all
        .filter((c) => c.category === 'context' || c.category === 'navigation' || c.category === 'action')
        .map((c) => {
          let score = 1;
          if (c.category === 'context') score = 3;
          else if (relevantIds.includes(c.id)) score = 2;
          return { cmd: c, score };
        })
        .sort((a, b) => b.score - a.score);
      return scored.slice(0, TOP_N).map((s) => s.cmd);
    }

    const lowerQ = query.toLowerCase();
    return all.filter((c) => c.label.toLowerCase().includes(lowerQ));
  }, [contextCommands, navCommands, actionCommands, entityCommands, query, parentRoute]);

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
