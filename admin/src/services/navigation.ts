import type {
  NavigationMenu,
  CreateNavigationMenuRequest,
  UpdateNavigationMenuRequest,
  NavigationItem,
  CreateNavigationItemRequest,
  UpdateNavigationItemRequest,
  NavigationItemLocalizationInput,
  NavigationItemLocalizationResponse,
  NavigationTreeNode,
  ReorderItem,
  ReorderTreeItem,
} from '@/types/api';
import { apiRequest } from './http';

export const getNavigationMenus = (siteId: string) =>
  apiRequest<NavigationMenu[]>('GET', `/sites/${siteId}/menus`);

export const createNavigationMenu = (siteId: string, data: CreateNavigationMenuRequest) =>
  apiRequest<NavigationMenu>('POST', `/sites/${siteId}/menus`, data);

export const updateNavigationMenu = (id: string, data: UpdateNavigationMenuRequest) =>
  apiRequest<NavigationMenu>('PUT', `/menus/${id}`, data);

export const deleteNavigationMenu = (id: string) =>
  apiRequest<void>('DELETE', `/menus/${id}`);

export const getNavigationTree = (menuId: string, locale?: string) => {
  const params = locale ? `?locale=${locale}` : '';
  return apiRequest<NavigationTreeNode[]>('GET', `/menus/${menuId}/tree${params}`);
};

export const getNavigationItems = (siteId: string) =>
  apiRequest<NavigationItem[]>('GET', `/sites/${siteId}/navigation`);

export const getMenuItems = (menuId: string) =>
  apiRequest<NavigationItem[]>('GET', `/menus/${menuId}/items`);

export const createNavigationItem = (siteId: string, data: CreateNavigationItemRequest) =>
  apiRequest<NavigationItem>('POST', `/sites/${siteId}/navigation`, data);

export const createMenuItem = (menuId: string, data: CreateNavigationItemRequest) =>
  apiRequest<NavigationItem>('POST', `/menus/${menuId}/items`, data);

export const updateNavigationItem = (id: string, data: UpdateNavigationItemRequest) =>
  apiRequest<NavigationItem>('PUT', `/navigation/${id}`, data);

export const deleteNavigationItem = (id: string) =>
  apiRequest<void>('DELETE', `/navigation/${id}`);

export const reorderNavigationItems = (siteId: string, items: ReorderItem[]) =>
  apiRequest<void>('POST', `/sites/${siteId}/navigation/reorder`, { items });

export const reorderMenuItems = (menuId: string, items: ReorderTreeItem[]) =>
  apiRequest<void>('POST', `/menus/${menuId}/items/reorder`, { items });

export const getNavigationItemLocalizations = (id: string) =>
  apiRequest<NavigationItemLocalizationResponse[]>(
    'GET',
    `/navigation/${id}/localizations`,
  );

export const upsertNavigationItemLocalizations = (
  id: string,
  data: NavigationItemLocalizationInput[],
) => apiRequest<NavigationItemLocalizationResponse[]>(
  'PUT',
  `/navigation/${id}/localizations`,
  data,
);
