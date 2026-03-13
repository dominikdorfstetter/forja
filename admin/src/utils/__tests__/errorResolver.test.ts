import { describe, it, expect } from 'vitest';
import { resolveError, type ResolvedError } from '../errorResolver';

describe('resolveError', () => {
  describe('ProblemDetails with error codes', () => {
    it('resolves known code with user-friendly title and action', () => {
      const error = {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'BLOG_SLUG_TAKEN',
        detail: "Blog with slug 'my-post' already exists",
      };

      const result: ResolvedError = resolveError(error);

      expect(result.title).toBe('Blog slug already in use');
      expect(result.detail).toBe("Blog with slug 'my-post' already exists");
      expect(result.action).toBe('Choose a different slug.');
      expect(result.code).toBe('BLOG_SLUG_TAKEN');
    });

    it('falls back to pattern matching for unknown NOT_FOUND codes', () => {
      const error = {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'WIDGET_NOT_FOUND',
        detail: 'Widget not found',
      };

      const result = resolveError(error);

      expect(result.title).toBe('Resource not found');
      expect(result.detail).toBe('Widget not found');
      expect(result.action).toContain('deleted or moved');
      expect(result.code).toBe('WIDGET_NOT_FOUND');
    });

    it('uses backend title when code has no override or pattern match', () => {
      const error = {
        type: 'about:blank',
        title: 'Server Error',
        status: 500,
        code: 'TOTALLY_UNKNOWN_CODE',
        detail: 'Something went wrong internally',
      };

      const result = resolveError(error);

      expect(result.title).toBe('Server Error');
      expect(result.detail).toBe('Something went wrong internally');
      expect(result.action).toBeUndefined();
      expect(result.code).toBe('TOTALLY_UNKNOWN_CODE');
    });

    it('uses code-resolved title when backend has no detail', () => {
      const error = {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'BLOG_SLUG_TAKEN',
      };

      const result = resolveError(error);

      expect(result.title).toBe('Blog slug already in use');
      expect(result.detail).toBe('Blog slug already in use');
      expect(result.action).toBe('Choose a different slug.');
    });

    it('includes field errors in the result', () => {
      const error = {
        type: 'about:blank',
        title: 'Validation Error',
        status: 422,
        code: 'VALIDATION_ERROR',
        detail: 'Invalid input',
        errors: [
          { field: 'slug', message: 'is required' },
          { field: 'author', message: 'must not be empty' },
        ],
      };

      const result = resolveError(error);

      expect(result.fieldErrors).toHaveLength(2);
      expect(result.fieldErrors![0].field).toBe('slug');
      expect(result.detail).toContain('slug: is required');
    });

    it('resolves AUTH_TOKEN_INVALID with re-auth action', () => {
      const error = {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        code: 'AUTH_TOKEN_INVALID',
      };

      const result = resolveError(error);

      expect(result.title).toBe('Session expired');
      expect(result.action).toBe('Please sign in again.');
      expect(result.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('resolves RATE_LIMIT_EXCEEDED with retry action', () => {
      const error = {
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
      };

      const result = resolveError(error);

      expect(result.title).toBe('Too many requests');
      expect(result.action).toContain('wait');
    });
  });

  describe('Error instances (unchanged behavior)', () => {
    it('handles network errors', () => {
      const result = resolveError(new Error('Network Error'));
      expect(result.title).toBe('Network Error');
      expect(result.detail).toContain('server');
      expect(result.code).toBeUndefined();
      expect(result.action).toBeUndefined();
    });

    it('handles timeout errors', () => {
      const result = resolveError(new Error('Request timeout'));
      expect(result.title).toBe('Timeout');
      expect(result.detail).toContain('timed out');
    });

    it('handles generic Error instances', () => {
      const result = resolveError(new Error('Something broke'));
      expect(result.title).toBe('Error');
      expect(result.detail).toBe('Something broke');
    });
  });

  describe('unknown errors (unchanged behavior)', () => {
    it('handles unknown error types', () => {
      const result = resolveError('string error');
      expect(result.title).toBe('Unknown Error');
      expect(result.detail).toContain('unexpected');
    });

    it('handles null', () => {
      const result = resolveError(null);
      expect(result.title).toBe('Unknown Error');
    });
  });
});
