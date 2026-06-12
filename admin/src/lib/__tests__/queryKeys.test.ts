import { describe, expect, it } from 'vitest';
import { matchQuery, type Query } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';

const SITE_A = 'site-aaaa';
const SITE_B = 'site-bbbb';

/** Minimal Query stub for matchQuery — only queryKey is consulted for key filters. */
const asQuery = (queryKey: readonly unknown[]) =>
  ({ queryKey, queryHash: JSON.stringify(queryKey) }) as unknown as Query;

describe('queryKeys factory', () => {
  describe('site-scoped keys', () => {
    it('embeds the siteId in every site-scoped key', () => {
      expect(queryKeys.blogs(SITE_A)).toEqual(['blogs', SITE_A]);
      expect(queryKeys.siteSettings(SITE_A)).toEqual(['site-settings', SITE_A]);
      expect(queryKeys.media(SITE_A)).toEqual(['media', SITE_A]);
      expect(queryKeys.members(SITE_A)).toEqual(['members', SITE_A]);
      expect(queryKeys.trashCount(SITE_A)).toEqual(['trash-count', SITE_A]);
    });

    it('produces different keys for different sites', () => {
      expect(queryKeys.blogs(SITE_A)).not.toEqual(queryKeys.blogs(SITE_B));
      expect(queryKeys.documents(SITE_A)).not.toEqual(queryKeys.documents(SITE_B));
      expect(queryKeys.navigationMenus(SITE_A)).not.toEqual(queryKeys.navigationMenus(SITE_B));
    });

    it('appends trailing filters after the siteId', () => {
      expect(queryKeys.blogs(SITE_A, 2, 25, 'search')).toEqual(['blogs', SITE_A, 2, 25, 'search']);
      expect(queryKeys.trash(SITE_A, 1, 10)).toEqual(['trash', SITE_A, 1, 10]);
    });
  });

  describe('entity-scoped keys', () => {
    it('embeds the entity id', () => {
      expect(queryKeys.form('form-1')).toEqual(['form', 'form-1']);
      expect(queryKeys.legalItems('group-1')).toEqual(['legalItems', 'group-1']);
      expect(queryKeys.pageSections('page-1')).toEqual(['page-sections', 'page-1']);
      expect(queryKeys.submission('sub-1')).toEqual(['submission', 'sub-1']);
    });

    it('produces different keys for different entities', () => {
      expect(queryKeys.form('form-1')).not.toEqual(queryKeys.form('form-2'));
    });

    it('omits the id for prefix invalidation when called without one', () => {
      expect(queryKeys.blogDetail()).toEqual(['blog-detail']);
      expect(queryKeys.navigationItems()).toEqual(['navigation-items']);
      expect(queryKeys.documentDetails()).toEqual(['document-details']);
    });
  });

  describe('global keys', () => {
    it('keeps the historical string values verbatim and stable', () => {
      expect(queryKeys.sites()).toEqual(['sites']);
      expect(queryKeys.sitesDeleted()).toEqual(['sites', 'deleted']);
      expect(queryKeys.localesAll()).toEqual(['locales', 'all']);
      expect(queryKeys.profile()).toEqual(['profile']);
      expect(queryKeys.clerkUserNames()).toEqual(['clerkUsers']);
      expect(queryKeys.onboarding()).toEqual(['onboarding']);
      expect(queryKeys.systemStorageOverview()).toEqual(['system-storage-overview']);
      // repeated calls are structurally identical
      expect(queryKeys.sites()).toEqual(queryKeys.sites());
    });
  });

  describe('scoped prefix invalidation', () => {
    it('the base site-scoped call prefix-matches its paginated read keys', () => {
      const readKey = queryKeys.blogs(SITE_A, 3, 25, 'hello', 'Published');
      const invalidationPrefix = queryKeys.blogs(SITE_A);

      expect(matchQuery({ queryKey: invalidationPrefix }, asQuery(readKey))).toBe(true);
    });

    it('does not match another site\'s read keys', () => {
      const siteBReadKey = queryKeys.blogs(SITE_B, 1, 10);

      expect(matchQuery({ queryKey: queryKeys.blogs(SITE_A) }, asQuery(siteBReadKey))).toBe(false);
    });

    it('entity-list root prefix-matches adapter list keys for the same site only', () => {
      const readKey = [...queryKeys.entityList('legal', SITE_A), 1, 25, '', '', '', '', ''];

      expect(matchQuery({ queryKey: queryKeys.entityList('legal', SITE_A) }, asQuery(readKey))).toBe(true);
      expect(matchQuery({ queryKey: queryKeys.entityList('legal', SITE_B) }, asQuery(readKey))).toBe(false);
    });
  });
});
