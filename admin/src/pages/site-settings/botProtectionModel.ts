import type {
  BotProtectionMode,
  SiteBotProtectionResponse,
  UpsertSiteBotProtectionRequest,
} from '@/types/api';

export const ALTCHA: BotProtectionMode = 'altcha';
export const REMOTE: BotProtectionMode = 'remote';

/** Path the ALTCHA widget fetches a challenge from (per form, on the public
 *  API host). Shown to admins so they can wire up their widget. */
export const ALTCHA_CHALLENGE_URL_TEMPLATE = '/api/v1/public/forms/<form-slug>/altcha-challenge';

/** Editable bot-protection inputs. The secret is never read back from the
 * server, so it always starts empty. */
export interface BotProtectionDraft {
  mode: BotProtectionMode;
  providerLabel: string;
  verifyUrl: string;
  secret: string;
}

export function draftFromConfig(config: SiteBotProtectionResponse | null | undefined): BotProtectionDraft {
  return {
    mode: config?.mode ?? ALTCHA,
    providerLabel: config?.provider_label ?? '',
    verifyUrl: config?.verify_url ?? '',
    secret: '',
  };
}

/** ALTCHA is zero-config; remote mode sends the trimmed vendor fields. */
export function upsertRequest(draft: BotProtectionDraft): UpsertSiteBotProtectionRequest {
  if (draft.mode === ALTCHA) return { mode: ALTCHA };
  return {
    mode: REMOTE,
    provider_label: draft.providerLabel.trim(),
    verify_url: draft.verifyUrl.trim(),
    secret: draft.secret.trim(),
  };
}

export type BotProtectionValidationError =
  | 'labelRequired'
  | 'urlRequired'
  | 'urlScheme'
  | 'urlInvalid'
  | 'secretRequired';

function verifyUrlError(raw: string): BotProtectionValidationError | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? null : 'urlScheme';
  } catch {
    return 'urlInvalid';
  }
}

/** First validation problem of the remote-vendor fields, or null. Only remote
 * mode has required fields, and only while the admin is editing. */
export function validateDraft(
  draft: BotProtectionDraft,
  { isDirty, editing }: { isDirty: boolean; editing: boolean },
): BotProtectionValidationError | null {
  if (draft.mode === ALTCHA) return null;
  if (!isDirty && !editing) return null;
  if (!draft.providerLabel.trim()) return 'labelRequired';
  const url = draft.verifyUrl.trim();
  if (!url) return 'urlRequired';
  const urlError = verifyUrlError(url);
  if (urlError) return urlError;
  if (!draft.secret.trim()) return 'secretRequired';
  return null;
}
