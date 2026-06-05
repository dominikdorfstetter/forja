import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { buildWorkspaceSections, buildAdminSections } from '../navConfig';

// Minimal TFunction stub that echoes the key back.
const t: TFunction = ((k: string) => k) as unknown as TFunction;

const commonIcons = {
  trashBadge: null,
  dashboardIcon: null,
  contentIcons: {
    blog: null,
    pages: null,
    legal: null,
    portfolio: null,
    documents: null,
    forms: null,
    collections: null,
    assets: null,
  },
  personalIcons: { myDrafts: null, trash: null },
  structureIcons: { navigation: null, taxonomy: null, socialLinks: null, redirects: null },
  analyticsIcon: null,
};

describe('navConfig.buildWorkspaceSections', () => {
  it('filters out sections whose items are empty after feature-flag checks', () => {
    const sections = buildWorkspaceSections({
      t,
      modules: {},
      features: {},
      isAdmin: false,
      ...commonIcons,
    });
    // Content section drops every item except Assets (which is unconditional).
    const contentSection = sections.find((s) => s.label === 'layout.sidebar.content');
    expect(contentSection?.items.map((i) => i.path)).toEqual(['/media']);
  });

  it('never adds a standalone Documents nav item — documents live under Assets', () => {
    // Regression: documents had their own /documents sidebar entry that
    // duplicated the Assets > Documents tab and drifted out of sync.
    const sections = buildWorkspaceSections({
      t,
      modules: { documents: true, blog: true, pages: true },
      features: {},
      isAdmin: true,
      ...commonIcons,
    });
    const allPaths = sections.flatMap((sec) => sec.items.map((i) => i.path));
    expect(allPaths).not.toContain('/documents');
    expect(allPaths).toContain('/media');
  });

  it('hides the trash row when the user is not admin', () => {
    const sections = buildWorkspaceSections({
      t,
      modules: { blog: true, pages: true },
      features: {},
      isAdmin: false,
      ...commonIcons,
    });
    const personal = sections.find((s) =>
      s.items.some((i) => i.path === '/my-drafts'),
    );
    expect(personal?.items.map((i) => i.path)).toEqual(['/my-drafts']);
  });

  it('shows the Forms nav item when modules.forms is true and hides it when false', () => {
    const enabled = buildWorkspaceSections({
      t,
      modules: { forms: true },
      features: {},
      isAdmin: false,
      ...commonIcons,
    });
    const disabled = buildWorkspaceSections({
      t,
      modules: { forms: false },
      features: {},
      isAdmin: false,
      ...commonIcons,
    });
    const paths = (s: ReturnType<typeof buildWorkspaceSections>) =>
      s.flatMap((sec) => sec.items.map((i) => i.path));
    expect(paths(enabled)).toContain('/forms');
    expect(paths(disabled)).not.toContain('/forms');
  });

  it('includes analytics only when the feature flag is on', () => {
    const off = buildWorkspaceSections({
      t,
      modules: { blog: true },
      features: {},
      isAdmin: true,
      ...commonIcons,
    });
    const on = buildWorkspaceSections({
      t,
      modules: { blog: true },
      features: { analytics: true },
      isAdmin: true,
      ...commonIcons,
    });
    const paths = (s: ReturnType<typeof buildWorkspaceSections>) =>
      s.flatMap((sec) => sec.items.map((i) => i.path));
    expect(paths(off)).not.toContain('/analytics');
    expect(paths(on)).toContain('/analytics');
  });
});

describe('navConfig.buildAdminSections', () => {
  it('returns an empty array when the user is not admin', () => {
    const sections = buildAdminSections({
      t,
      isAdmin: false,
      icons: { siteSettings: null, activity: null },
    });
    expect(sections).toEqual([]);
  });

  it('returns a single administration section with the expected paths when admin', () => {
    const sections = buildAdminSections({
      t,
      isAdmin: true,
      icons: { siteSettings: null, activity: null },
    });
    expect(sections).toHaveLength(1);
    // Members, Webhooks, and API keys moved under /site-settings/* — they
    // intentionally no longer appear in the main admin sidebar.
    expect(sections[0].items.map((i) => i.path)).toEqual([
      '/site-settings',
      '/activity',
    ]);
  });
});
