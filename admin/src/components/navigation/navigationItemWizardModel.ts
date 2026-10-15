import type {
  CreateNavigationItemRequest,
  Locale,
  NavigationItem,
  NavigationItemLocalizationInput,
  SiteContextResponse,
} from '@/types/api';

export type LinkType = 'page' | 'blog' | 'cv' | 'legal' | 'external';

/** Step 1 — where the item points. Only the field matching `linkType` is submitted. */
export interface LinkTargetFields {
  linkType: LinkType;
  pageId: string;
  blogSlug: string;
  legalDocumentId: string;
  externalUrl: string;
}

/** Step 3 — placement and presentation options. */
export interface ItemOptionFields {
  parentId: string;
  icon: string;
  openInNewTab: boolean;
}

export interface ParentOption {
  value: string;
  label: string;
  depth: number;
}

export const LAST_WIZARD_STEP = 2;

type LinkModules = Pick<SiteContextResponse['modules'], 'pages' | 'blog' | 'portfolio' | 'legal'>;

/** Link types offered for the site's active modules; external is always available. */
export function getAvailableLinkTypes(modules: LinkModules): LinkType[] {
  const moduleTypes: [boolean, LinkType][] = [
    [modules.pages, 'page'],
    [modules.blog, 'blog'],
    [modules.portfolio, 'cv'],
    [modules.legal, 'legal'],
  ];
  return [...moduleTypes.filter(([enabled]) => enabled).map(([, type]) => type), 'external'];
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function detectLinkType(item: NavigationItem, fallback: LinkType): LinkType {
  if (item.legal_document_id) return 'legal';
  if (item.page_id) return 'page';
  if (item.external_url === '/cv') return 'cv';
  if (item.external_url?.startsWith('/blog/')) return 'blog';
  if (item.external_url) return 'external';
  return fallback; // broken link (no target) — repair by picking a new one
}

/** Step-1 fields for a fresh item, or decoded from an existing item's target. */
export function getInitialLinkTarget(item: NavigationItem | null | undefined, fallback: LinkType): LinkTargetFields {
  if (!item) {
    return { linkType: fallback, pageId: '', blogSlug: '', legalDocumentId: '', externalUrl: '' };
  }
  const url = item.external_url ?? '';
  const isBlogLink = url.startsWith('/blog/');
  const isCvLink = url === '/cv';
  return {
    linkType: detectLinkType(item, fallback),
    pageId: item.page_id || '',
    blogSlug: isBlogLink ? url.replace('/blog/', '') : '',
    legalDocumentId: item.legal_document_id || '',
    externalUrl: isBlogLink || isCvLink ? '' : url,
  };
}

export function getInitialItemOptions(item: NavigationItem | null | undefined): ItemOptionFields {
  return {
    parentId: item?.parent_id || '',
    icon: item?.icon || '',
    openInNewTab: item?.open_in_new_tab ?? false,
  };
}

export function isLinkTargetValid(target: LinkTargetFields): boolean {
  switch (target.linkType) {
    case 'page':
      return !!target.pageId;
    case 'blog':
      return !!target.blogSlug;
    case 'legal':
      return !!target.legalDocumentId;
    case 'cv':
      return true;
    default:
      return !!target.externalUrl && isValidUrl(target.externalUrl);
  }
}

/** Translations are optional only when the site has no locales configured. */
export function hasRequiredTitles(localeCount: number, titles: Record<string, string>): boolean {
  return localeCount === 0 || Object.values(titles).some((title) => title.trim());
}

/** Whether the wizard may leave `step`: step 1 needs a valid target, step 2 a title. */
export function canAdvanceWizardStep(
  step: number,
  target: LinkTargetFields,
  localeCount: number,
  titles: Record<string, string>,
): boolean {
  if (step === 0) return isLinkTargetValid(target);
  if (step === 1) return hasRequiredTitles(localeCount, titles);
  return true;
}

function collectSubtreeIds(allItems: NavigationItem[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  const visit = (parentId: string) => {
    allItems.filter((i) => i.parent_id === parentId).forEach((child) => {
      ids.add(child.id);
      visit(child.id);
    });
  };
  visit(rootId);
  return ids;
}

/**
 * Parent picker options: every item except the edited item's own subtree and
 * items already at the deepest level that may still take children.
 */
export function buildParentOptions(
  allItems: NavigationItem[],
  item: NavigationItem | null | undefined,
  maxDepth: number,
): ParentOption[] {
  if (!allItems.length) return [];

  const excludeIds = item ? collectSubtreeIds(allItems, item.id) : new Set<string>();

  const depthMap = new Map<string, number>();
  const calculateDepth = (itemId: string): number => {
    if (depthMap.has(itemId)) return depthMap.get(itemId)!;
    const i = allItems.find((x) => x.id === itemId);
    if (!i || !i.parent_id) { depthMap.set(itemId, 0); return 0; }
    const depth = calculateDepth(i.parent_id) + 1;
    depthMap.set(itemId, depth);
    return depth;
  };

  return allItems.flatMap<ParentOption>((i) => {
    if (excludeIds.has(i.id)) return [];
    const depth = calculateDepth(i.id);
    if (depth >= maxDepth - 1) return [];
    const indent = '  '.repeat(depth);
    const label = `${indent}${i.title || i.page_id || i.external_url || i.id}`;
    return [{ value: i.id, label, depth }];
  });
}

export function titlesFromLocalizations(
  localizations: { locale_id: string; title: string }[],
): Record<string, string> {
  return Object.fromEntries(localizations.map((l) => [l.locale_id, l.title]));
}

function resolveExternalUrl({ linkType, blogSlug, externalUrl }: LinkTargetFields): string | undefined {
  if (linkType === 'cv') return '/cv';
  if (linkType === 'blog') return blogSlug ? `/blog/${blogSlug}` : undefined;
  if (linkType === 'external') return externalUrl || undefined;
  return undefined;
}

function buildLocalizationInputs(
  locales: Locale[],
  titles: Record<string, string>,
): NavigationItemLocalizationInput[] {
  return locales
    .filter((locale) => titles[locale.id]?.trim())
    .map((locale) => ({ locale_id: locale.id, title: titles[locale.id].trim() }));
}

interface NavigationItemRequestInput {
  target: LinkTargetFields;
  options: ItemOptionFields;
  titles: Record<string, string>;
  locales: Locale[];
  siteId: string;
  menuId: string;
  displayOrder: number;
}

/** Wizard state → API payload; only the selected link type's target is sent. */
export function buildNavigationItemRequest({
  target,
  options,
  titles,
  locales,
  siteId,
  menuId,
  displayOrder,
}: NavigationItemRequestInput): CreateNavigationItemRequest {
  const localizations = buildLocalizationInputs(locales, titles);
  return {
    page_id: target.linkType === 'page' && target.pageId ? target.pageId : undefined,
    external_url: resolveExternalUrl(target),
    legal_document_id: target.linkType === 'legal' && target.legalDocumentId ? target.legalDocumentId : undefined,
    icon: options.icon || undefined,
    display_order: displayOrder,
    open_in_new_tab: options.openInNewTab,
    parent_id: options.parentId || undefined,
    site_id: siteId,
    menu_id: menuId,
    localizations: localizations.length > 0 ? localizations : undefined,
  };
}
