import type {
  AuthInfo,
  GuestTokenResponse,
  ProfileResponse,
  UserDataExportResponse,
  UserPreferencesResponse,
  UpdateUserPreferencesRequest,
  OnboardingResponse,
  CompleteOnboardingRequest,
  HelpStateResponse,
  UpdateHelpStateRequest,
  MembershipSummary,
} from '@/types/api';
import { apiRequest } from './http';

export const getAuthMe = () => apiRequest<AuthInfo>('GET', '/auth/me');
export const getGuestToken = () => apiRequest<GuestTokenResponse>('GET', '/auth/guest');
export const getProfile = () => apiRequest<ProfileResponse>('GET', '/auth/profile');
export const exportUserData = () => apiRequest<UserDataExportResponse>('GET', '/auth/export');
export const deleteAccount = () => apiRequest<void>('DELETE', '/auth/account');

export const getUserPreferences = () => apiRequest<UserPreferencesResponse>('GET', '/auth/preferences');
export const updateUserPreferences = (data: UpdateUserPreferencesRequest) =>
  apiRequest<UserPreferencesResponse>('PUT', '/auth/preferences', data);

export const getOnboarding = () => apiRequest<OnboardingResponse>('GET', '/auth/onboarding');
export const completeOnboarding = (data: CompleteOnboardingRequest) =>
  apiRequest<OnboardingResponse>('PUT', '/auth/onboarding', data);

export const getHelpState = () => apiRequest<HelpStateResponse>('GET', '/auth/help-state');
export const updateHelpState = (data: UpdateHelpStateRequest) =>
  apiRequest<HelpStateResponse>('PATCH', '/auth/help-state', data);
export const resetHelpState = () => apiRequest<HelpStateResponse>('POST', '/auth/help-state/reset');

export const joinDemoSite = () => apiRequest<AuthInfo>('POST', '/auth/demo/join');
export const getMyMemberships = () => apiRequest<MembershipSummary[]>('GET', '/my/memberships');
