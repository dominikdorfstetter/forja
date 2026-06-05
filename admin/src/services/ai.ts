import type {
  AiConfigResponse,
  CreateAiConfigRequest,
  AiTestResponse,
  AiGenerateRequest,
  AiGenerateResponse,
  AiUsageResponse,
  AiUsageGroupBy,
  ListModelsRequest,
  ListModelsResponse,
} from '@/types/api';
import { apiRequest } from './http';

export const getAiConfig = (siteId: string) =>
  apiRequest<AiConfigResponse | null>('GET', `/sites/${siteId}/ai/config`);

export const upsertAiConfig = (siteId: string, data: CreateAiConfigRequest) =>
  apiRequest<AiConfigResponse>('PUT', `/sites/${siteId}/ai/config`, data);

export const deleteAiConfig = (siteId: string) =>
  apiRequest<void>('DELETE', `/sites/${siteId}/ai/config`);

export const testAiConnection = (siteId: string) =>
  apiRequest<AiTestResponse>('POST', `/sites/${siteId}/ai/test`);

export const generateAiContent = (siteId: string, data: AiGenerateRequest) =>
  apiRequest<AiGenerateResponse>('POST', `/sites/${siteId}/ai/generate`, data);

export const listAiModels = (siteId: string, data: ListModelsRequest) =>
  apiRequest<ListModelsResponse>('POST', `/sites/${siteId}/ai/models`, data);

export const getAiUsage = (
  siteId: string,
  params: { from?: string; to?: string; action?: string; provider?: string; groupBy?: AiUsageGroupBy } = {},
) => apiRequest<AiUsageResponse>('GET', `/sites/${siteId}/ai-usage`, undefined, {
  params: {
    from: params.from,
    to: params.to,
    action: params.action,
    provider: params.provider,
    group_by: params.groupBy,
  },
});

/**
 * Returns the CSV body as text. Caller is responsible for the browser download
 * (Blob + anchor click). Keeping the response as a string lets tests assert on
 * content without faking a download flow.
 */
export const exportAiUsageCsv = (
  siteId: string,
  params: { from?: string; to?: string; action?: string; provider?: string } = {},
) => apiRequest<string>('GET', `/sites/${siteId}/ai-usage/export`, undefined, {
  params: { from: params.from, to: params.to, action: params.action, provider: params.provider },
  responseType: 'text',
});
