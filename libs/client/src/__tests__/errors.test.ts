import { describe, expect, it } from 'vitest';
import {
  ForjaAuthError,
  ForjaError,
  ForjaNetworkError,
  ForjaNotFoundError,
  ForjaPermissionError,
  ForjaRateLimitError,
  ForjaServerError,
  ForjaValidationError,
} from '../errors.js';

describe('ForjaError', () => {
  it('sets message and code', () => {
    const err = new ForjaError('test', 'TEST_CODE');
    expect(err.message).toBe('test');
    expect(err.code).toBe('TEST_CODE');
    expect(err.name).toBe('ForjaError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ForjaAuthError', () => {
  it('has default message', () => {
    const err = new ForjaAuthError();
    expect(err.message).toBe('Invalid or missing API key');
    expect(err.code).toBe('AUTH_ERROR');
    expect(err.name).toBe('ForjaAuthError');
  });

  it('accepts custom message', () => {
    const err = new ForjaAuthError('custom');
    expect(err.message).toBe('custom');
  });
});

describe('ForjaPermissionError', () => {
  it('has default message', () => {
    const err = new ForjaPermissionError();
    expect(err.code).toBe('PERMISSION_ERROR');
    expect(err.name).toBe('ForjaPermissionError');
  });
});

describe('ForjaNotFoundError', () => {
  it('has default message', () => {
    const err = new ForjaNotFoundError();
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('ForjaNotFoundError');
  });
});

describe('ForjaRateLimitError', () => {
  it('includes retryAfter', () => {
    const err = new ForjaRateLimitError('limit', 60);
    expect(err.retryAfter).toBe(60);
    expect(err.code).toBe('RATE_LIMIT');
  });

  it('defaults retryAfter to undefined', () => {
    const err = new ForjaRateLimitError();
    expect(err.retryAfter).toBeUndefined();
  });
});

describe('ForjaValidationError', () => {
  it('includes details', () => {
    const err = new ForjaValidationError('bad input', 'field is required');
    expect(err.details).toBe('field is required');
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

describe('ForjaServerError', () => {
  it('includes status', () => {
    const err = new ForjaServerError('down', 503);
    expect(err.status).toBe(503);
    expect(err.code).toBe('SERVER_ERROR');
  });

  it('defaults to 500', () => {
    const err = new ForjaServerError();
    expect(err.status).toBe(500);
  });
});

describe('ForjaNetworkError', () => {
  it('includes cause', () => {
    const cause = new TypeError('fetch failed');
    const err = new ForjaNetworkError('offline', cause);
    expect(err.cause).toBe(cause);
    expect(err.code).toBe('NETWORK_ERROR');
  });
});
