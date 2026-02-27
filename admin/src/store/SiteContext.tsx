import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { Site } from '@/types/api';
import { useAuth, notifySelectedSiteChanged } from '@/store/AuthContext';

interface SiteContextValue {
  selectedSiteId: string;
  setSelectedSiteId: (id: string) => void;
  selectedSite: Site | undefined;
  sites: Site[] | undefined;
  isLoading: boolean;
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

const STORAGE_KEY = 'selectedSiteId';

export function SiteProvider({ children }: { children: ReactNode }) {
  const [selectedSiteId, setSelectedSiteIdState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || ''
  );
  const { siteId: authSiteId, permission, memberships, isSystemAdmin } = useAuth();
  const isAuthenticated = permission !== null;
  const isSiteScoped = !!authSiteId;
  const isClerkUser = memberships.length > 0 || isSystemAdmin;

  const { data: allSites, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiService.getSites(),
    enabled: isAuthenticated,
  });

  // Filter sites: API key scope > Clerk memberships > all
  const sites = useMemo(() => {
    if (!allSites) return undefined;
    if (authSiteId) return allSites.filter((s) => s.id === authSiteId);
    if (isClerkUser && !isSystemAdmin) {
      const memberSiteIds = new Set(memberships.map((m) => m.site_id));
      return allSites.filter((s) => memberSiteIds.has(s.id));
    }
    return allSites;
  }, [allSites, authSiteId, isClerkUser, isSystemAdmin, memberships]);

  // For site-scoped keys, the selected site is always the scoped site
  const effectiveSiteId = isSiteScoped ? authSiteId : selectedSiteId;

  // Notify AuthContext whenever the effective site changes
  useEffect(() => {
    notifySelectedSiteChanged(effectiveSiteId);
  }, [effectiveSiteId]);

  // Auto-select first site when no site is selected and sites are available
  useEffect(() => {
    if (!isSiteScoped && sites && sites.length > 0 && !selectedSiteId) {
      const firstId = sites[0].id;
      setSelectedSiteIdState(firstId);
      localStorage.setItem(STORAGE_KEY, firstId);
    }
  }, [sites, selectedSiteId, isSiteScoped]);

  // Clear stored siteId if it no longer exists in the sites list (only for non-scoped keys)
  useEffect(() => {
    if (!isSiteScoped && sites && selectedSiteId && !sites.find((s) => s.id === selectedSiteId)) {
      setSelectedSiteIdState('');
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [sites, selectedSiteId, isSiteScoped]);

  const setSelectedSiteId = (id: string) => {
    if (isSiteScoped) return; // Cannot change site when key is scoped
    setSelectedSiteIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const selectedSite = sites?.find((s) => s.id === effectiveSiteId);

  return (
    <SiteContext.Provider value={{ selectedSiteId: effectiveSiteId, setSelectedSiteId, selectedSite, sites, isLoading }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteContext(): SiteContextValue {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error('useSiteContext must be used within a SiteProvider');
  }
  return context;
}
