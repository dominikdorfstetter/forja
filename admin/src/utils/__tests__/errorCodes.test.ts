import { describe, it, expect } from 'vitest';
import { resolveErrorCode } from '../errorCodes';

describe('resolveErrorCode', () => {
  describe('specific code overrides', () => {
    it('returns message and action for AUTH_TOKEN_INVALID', () => {
      const result = resolveErrorCode('AUTH_TOKEN_INVALID');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Session expired');
      expect(result!.action).toBe('Please sign in again.');
    });

    it('returns message and action for BLOG_SLUG_TAKEN', () => {
      const result = resolveErrorCode('BLOG_SLUG_TAKEN');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Blog slug already in use');
      expect(result!.action).toBe('Choose a different slug.');
    });

    it('returns message and action for RATE_LIMIT_EXCEEDED', () => {
      const result = resolveErrorCode('RATE_LIMIT_EXCEEDED');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Too many requests');
      expect(result!.action).toBe('Please wait a moment and try again.');
    });

    it('returns message and action for MEDIA_UPLOAD_TOO_LARGE', () => {
      const result = resolveErrorCode('MEDIA_UPLOAD_TOO_LARGE');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('File too large');
      expect(result!.action).toContain('file size');
    });

    it('returns message and action for AUTH_SITE_ACCESS_DENIED', () => {
      const result = resolveErrorCode('AUTH_SITE_ACCESS_DENIED');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Site access denied');
      expect(result!.action).toContain('site owner');
    });

    it('returns message and action for MODULE_NOT_ENABLED', () => {
      const result = resolveErrorCode('MODULE_NOT_ENABLED');
      expect(result).not.toBeNull();
      expect(result!.action).toContain('site settings');
    });
  });

  describe('pattern-based fallbacks', () => {
    it('matches *_NOT_FOUND pattern for unknown domain', () => {
      const result = resolveErrorCode('SOMETHING_NOT_FOUND');
      expect(result).not.toBeNull();
      expect(result!.message).toContain('not found');
    });

    it('matches *_SLUG_TAKEN pattern for unknown domain', () => {
      const result = resolveErrorCode('WIDGET_SLUG_TAKEN');
      expect(result).not.toBeNull();
      expect(result!.message).toContain('already in use');
    });

    it('matches AUTH_* pattern for unknown auth code', () => {
      const result = resolveErrorCode('AUTH_SOMETHING_NEW');
      expect(result).not.toBeNull();
      expect(result!.message).toContain('uthentication');
    });

    it('matches *_ACCESS_DENIED pattern', () => {
      const result = resolveErrorCode('WIDGET_ACCESS_DENIED');
      expect(result).not.toBeNull();
      expect(result!.message).toContain('denied');
    });

    it('matches VALIDATION_* pattern', () => {
      const result = resolveErrorCode('VALIDATION_SOMETHING');
      expect(result).not.toBeNull();
      expect(result!.message).toContain('alidation');
    });
  });

  describe('specific codes take priority over patterns', () => {
    it('AUTH_TOKEN_INVALID uses specific override, not AUTH_* pattern', () => {
      const result = resolveErrorCode('AUTH_TOKEN_INVALID');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Session expired');
    });

    it('BLOG_SLUG_TAKEN uses specific override, not *_SLUG_TAKEN pattern', () => {
      const result = resolveErrorCode('BLOG_SLUG_TAKEN');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Blog slug already in use');
    });
  });

  describe('unknown codes', () => {
    it('returns null for completely unknown codes', () => {
      const result = resolveErrorCode('TOTALLY_UNKNOWN_CODE');
      expect(result).toBeNull();
    });
  });
});
