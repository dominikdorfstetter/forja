import type { ImprintResponse } from '@/types/api';
import { apiRequest } from './http';

/**
 * Public, unauthenticated imprint endpoint. Callable while signed out — the
 * HTTP layer simply sends no auth header when no token/key is present.
 */
export const getImprint = () => apiRequest<ImprintResponse>('GET', '/imprint');
