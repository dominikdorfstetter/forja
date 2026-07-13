import { type ReactNode } from 'react';
import type { TFunction } from 'i18next';

/**
 * Data-first nav configuration for the admin sidebar. Builders take
 * the minimal feature-flag + role + localisation deps needed to filter
 * items; they return plain data that SidebarNav renders. Keeping this
 * as data (not JSX arrays inlined into Layout.tsx) means the shell
 * file stays focused on layout, and a future nav-filter input can
 * search across labels without traversing rendered nodes.
 */

export interface NavMenuItem {
  text: string;
  icon: ReactNode;
  path: string;
}

export interface NavMenuSection {
  label?: string;
  items: NavMenuItem[];
}

export interface WorkspaceDeps {
  t: TFunction;
  modules: {
    blog?: boolean;
    pages?: boolean;
    legal?: boolean;
    portfolio?: boolean;
    documents?: boolean;
    forms?: boolean;
    collections?: boolean;
  };
  features: {
    analytics?: boolean;
  };
  isAdmin: boolean;
  trashBadge: ReactNode;
  dashboardIcon: ReactNode;
  contentIcons: {
    blog: ReactNode;
    pages: ReactNode;
    legal: ReactNode;
    portfolio: ReactNode;
    documents: ReactNode;
    forms: ReactNode;
    collections: ReactNode;
    assets: ReactNode;
  };
  personalIcons: {
    myDrafts: ReactNode;
    trash: ReactNode;
  };
  structureIcons: {
    navigation: ReactNode;
    taxonomy: ReactNode;
    uiStrings: ReactNode;
    socialLinks: ReactNode;
    redirects: ReactNode;
  };
  analyticsIcon: ReactNode;
}

export function buildWorkspaceSections(deps: WorkspaceDeps): NavMenuSection[] {
  const { t, modules, features, isAdmin, trashBadge } = deps;

  const sections: NavMenuSection[] = [
    { items: [{ text: t('layout.sidebar.dashboard'), icon: deps.dashboardIcon, path: '/' }] },
    {
      label: t('layout.sidebar.content'),
      items: [
        ...(modules.blog
          ? [{ text: t('layout.sidebar.blogs'), icon: deps.contentIcons.blog, path: '/blogs' }]
          : []),
        ...(modules.pages
          ? [{ text: t('layout.sidebar.pages'), icon: deps.contentIcons.pages, path: '/pages' }]
          : []),
        ...(modules.legal
          ? [{ text: t('layout.sidebar.legal'), icon: deps.contentIcons.legal, path: '/legal' }]
          : []),
        ...(modules.portfolio
          ? [
              {
                text: t('layout.sidebar.portfolio'),
                icon: deps.contentIcons.portfolio,
                path: '/portfolio',
              },
            ]
          : []),
        // Documents are not a standalone nav entry — they live as the
        // "Documents" tab inside Assets (/media/documents). Keeping a
        // top-level Documents item duplicated the surface and drifted
        // out of sync with the Assets tab.
        ...(modules.forms
          ? [{ text: t('layout.sidebar.forms'), icon: deps.contentIcons.forms, path: '/forms' }]
          : []),
        ...(modules.collections
          ? [
              {
                text: t('layout.sidebar.collections'),
                icon: deps.contentIcons.collections,
                path: '/collections',
              },
            ]
          : []),
        { text: t('layout.sidebar.assets'), icon: deps.contentIcons.assets, path: '/media' },
      ],
    },
    {
      items: [
        { text: t('layout.sidebar.myDrafts'), icon: deps.personalIcons.myDrafts, path: '/my-drafts' },
        ...(isAdmin
          ? [{ text: t('layout.sidebar.trash'), icon: trashBadge, path: '/trash' }]
          : []),
      ],
    },
    {
      label: t('layout.sidebar.structure'),
      items: [
        {
          text: t('layout.sidebar.navigation'),
          icon: deps.structureIcons.navigation,
          path: '/navigation',
        },
        {
          text: t('layout.sidebar.taxonomy'),
          icon: deps.structureIcons.taxonomy,
          path: '/taxonomy',
        },
        {
          text: t('layout.sidebar.uiStrings'),
          icon: deps.structureIcons.uiStrings,
          path: '/ui-strings',
        },
        {
          text: t('layout.sidebar.socialLinks'),
          icon: deps.structureIcons.socialLinks,
          path: '/social-links',
        },
        {
          text: t('layout.sidebar.redirects'),
          icon: deps.structureIcons.redirects,
          path: '/redirects',
        },
      ],
    },
    ...(features.analytics
      ? [
          {
            items: [
              { text: t('layout.sidebar.analytics'), icon: deps.analyticsIcon, path: '/analytics' },
            ],
          },
        ]
      : []),
  ];

  return sections.filter((s) => s.items.length > 0);
}

export interface AdminSectionDeps {
  t: TFunction;
  isAdmin: boolean;
  icons: {
    siteSettings: ReactNode;
    activity: ReactNode;
  };
}

export function buildAdminSections(deps: AdminSectionDeps): NavMenuSection[] {
  const { t, isAdmin } = deps;
  if (!isAdmin) return [];

  // Members, Webhooks, API keys moved into /site-settings/* sub-routes so
  // they live inside a single cohesive Settings surface. They intentionally
  // do not appear here anymore.
  return [
    {
      label: t('layout.sidebar.administration'),
      items: [
        { text: t('siteSettings.title'), icon: deps.icons.siteSettings, path: '/site-settings' },
        { text: t('layout.sidebar.activity'), icon: deps.icons.activity, path: '/activity' },
      ],
    },
  ];
}
