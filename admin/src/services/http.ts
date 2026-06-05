import axios, { AxiosRequestConfig } from 'axios';
import { migrateApiKeyStorage, getApiKey } from './apiKeyStorage';

const API_BASE_URL = '/api/v1';

type ClerkTokenGetter = ((options?: { template?: string }) => Promise<string | null>) | null;

let clerkTokenGetter: ClerkTokenGetter = null;

export function setClerkTokenGetter(getter: ClerkTokenGetter): void {
  clerkTokenGetter = getter;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

migrateApiKeyStorage();

apiClient.interceptors.request.use(async (config) => {
  if (clerkTokenGetter) {
    try {
      const token = await clerkTokenGetter();
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
      }
    } catch {
      // fall through to api-key
    }
  }

  const apiKey = getApiKey();
  if (apiKey && config.headers) {
    config.headers['X-API-Key'] = apiKey;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export async function apiRequest<T>(
  method: string,
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const response = await apiClient.request<T>({ method, url, data, ...config });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      throw error.response.data;
    }
    throw error;
  }
}
