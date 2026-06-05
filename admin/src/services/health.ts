import type { HealthResponse } from '@/types/api';
import { apiClient } from './http';

// `/health/detailed` is mounted at root, not under /api/v1. The public
// `/health` strips version + storage internals; the dashboard needs them.
export async function getHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health/detailed', { baseURL: '' });
  return response.data;
}
