import { describe, it, expect } from 'vitest';
import {
  draftFromConfig,
  upsertRequest,
  validateDraft,
  type BotProtectionDraft,
} from '../botProtectionModel';

const remote: BotProtectionDraft = {
  mode: 'remote',
  providerLabel: ' Turnstile ',
  verifyUrl: ' https://challenges.cloudflare.com/turnstile/v0/siteverify ',
  secret: ' s3cret ',
};
const editing = { isDirty: true, editing: true };

describe('botProtectionModel', () => {
  it('defaults an unconfigured site to an empty ALTCHA draft', () => {
    expect(draftFromConfig(null)).toEqual({ mode: 'altcha', providerLabel: '', verifyUrl: '', secret: '' });
  });

  it('sends ALTCHA as zero-config and remote with trimmed vendor fields', () => {
    expect(upsertRequest({ ...remote, mode: 'altcha' })).toEqual({ mode: 'altcha' });
    expect(upsertRequest(remote)).toEqual({
      mode: 'remote',
      provider_label: 'Turnstile',
      verify_url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      secret: 's3cret',
    });
  });

  it('never blocks ALTCHA or an untouched remote summary', () => {
    expect(validateDraft({ ...remote, mode: 'altcha', providerLabel: '' }, editing)).toBeNull();
    expect(validateDraft({ ...remote, providerLabel: '' }, { isDirty: false, editing: false })).toBeNull();
  });

  it('reports the first missing or malformed remote field', () => {
    expect(validateDraft(remote, editing)).toBeNull();
    expect(validateDraft({ ...remote, providerLabel: ' ' }, editing)).toBe('labelRequired');
    expect(validateDraft({ ...remote, verifyUrl: '' }, editing)).toBe('urlRequired');
    expect(validateDraft({ ...remote, verifyUrl: 'not a url' }, editing)).toBe('urlInvalid');
    expect(validateDraft({ ...remote, verifyUrl: 'ftp://example.com' }, editing)).toBe('urlScheme');
    expect(validateDraft({ ...remote, secret: '' }, editing)).toBe('secretRequired');
  });
});
