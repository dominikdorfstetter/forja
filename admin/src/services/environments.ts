import type { Environment } from '@/types/api';
import { apiRequest } from './http';

export const getEnvironments = () => apiRequest<Environment[]>('GET', '/environments');
