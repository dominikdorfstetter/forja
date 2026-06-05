import { describe, it, expect, beforeEach } from 'vitest';
import { migrateApiKeyStorage, getApiKey } from '../apiKeyStorage';

describe('migrateApiKeyStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('migrates API key from localStorage to sessionStorage', () => {
    localStorage.setItem('api_key', 'dk_test_secret_key');

    migrateApiKeyStorage();

    expect(sessionStorage.getItem('api_key')).toBe('dk_test_secret_key');
    expect(localStorage.getItem('api_key')).toBeNull();
  });

  it('does nothing when no API key exists in localStorage', () => {
    migrateApiKeyStorage();

    expect(sessionStorage.getItem('api_key')).toBeNull();
    expect(localStorage.getItem('api_key')).toBeNull();
  });

  it('overwrites sessionStorage with localStorage value during migration', () => {
    sessionStorage.setItem('api_key', 'dk_existing_session_key');
    localStorage.setItem('api_key', 'dk_old_local_key');

    migrateApiKeyStorage();

    expect(sessionStorage.getItem('api_key')).toBe('dk_old_local_key');
    expect(localStorage.getItem('api_key')).toBeNull();
  });
});

describe('getApiKey', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns API key from sessionStorage', () => {
    sessionStorage.setItem('api_key', 'dk_my_key');
    expect(getApiKey()).toBe('dk_my_key');
  });

  it('returns null when no key exists', () => {
    expect(getApiKey()).toBeNull();
  });
});
