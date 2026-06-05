import axios from 'axios';
import type {
  SiteBotProtectionResponse,
  UpsertSiteBotProtectionRequest,
} from '@/types/api';
import { apiRequest } from './http';

// 404 → null lets the caller render the "no config yet" empty state without
// having to introspect axios errors. Other failures propagate (#608).
export async function getSiteBotProtection(
  siteId: string,
): Promise<SiteBotProtectionResponse | null> {
  try {
    return await apiRequest<SiteBotProtectionResponse>(
      'GET',
      `/sites/${siteId}/bot-protection`,
    );
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

export const upsertSiteBotProtection = (
  siteId: string,
  data: UpsertSiteBotProtectionRequest,
) => apiRequest<SiteBotProtectionResponse>(
  'PUT',
  `/sites/${siteId}/bot-protection`,
  data,
);

export const deleteSiteBotProtection = (siteId: string) =>
  apiRequest<void>('DELETE', `/sites/${siteId}/bot-protection`);
