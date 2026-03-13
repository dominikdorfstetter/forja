import i18n from '@/i18n';

export interface ErrorCodeInfo {
  message: string;
  action?: string;
}

/** i18n key pair for lazy translation resolution */
interface ErrorCodeKeys {
  messageKey: string;
  actionKey: string;
}

/**
 * Specific error code overrides — keyed by the exact `{DOMAIN}_{ACTION}_{REASON}` code
 * from ProblemDetails.code. Values are i18n key paths under `errorCodes.*`.
 */
const ERROR_CODE_MAP: Record<string, ErrorCodeKeys> = {
  AUTH_MISSING_CREDENTIALS: { messageKey: 'errorCodes.AUTH_MISSING_CREDENTIALS.message', actionKey: 'errorCodes.AUTH_MISSING_CREDENTIALS.action' },
  AUTH_TOKEN_INVALID: { messageKey: 'errorCodes.AUTH_TOKEN_INVALID.message', actionKey: 'errorCodes.AUTH_TOKEN_INVALID.action' },
  AUTH_INSUFFICIENT_ROLE: { messageKey: 'errorCodes.AUTH_INSUFFICIENT_ROLE.message', actionKey: 'errorCodes.AUTH_INSUFFICIENT_ROLE.action' },
  AUTH_SITE_ACCESS_DENIED: { messageKey: 'errorCodes.AUTH_SITE_ACCESS_DENIED.message', actionKey: 'errorCodes.AUTH_SITE_ACCESS_DENIED.action' },
  AUTH_API_KEY_INVALID: { messageKey: 'errorCodes.AUTH_API_KEY_INVALID.message', actionKey: 'errorCodes.AUTH_API_KEY_INVALID.action' },
  AUTH_ACCOUNT_SOLE_OWNER: { messageKey: 'errorCodes.AUTH_ACCOUNT_SOLE_OWNER.message', actionKey: 'errorCodes.AUTH_ACCOUNT_SOLE_OWNER.action' },
  BLOG_SLUG_TAKEN: { messageKey: 'errorCodes.BLOG_SLUG_TAKEN.message', actionKey: 'errorCodes.BLOG_SLUG_TAKEN.action' },
  PAGE_SLUG_TAKEN: { messageKey: 'errorCodes.PAGE_SLUG_TAKEN.message', actionKey: 'errorCodes.PAGE_SLUG_TAKEN.action' },
  SITE_SLUG_TAKEN: { messageKey: 'errorCodes.SITE_SLUG_TAKEN.message', actionKey: 'errorCodes.SITE_SLUG_TAKEN.action' },
  TAG_SLUG_TAKEN: { messageKey: 'errorCodes.TAG_SLUG_TAKEN.message', actionKey: 'errorCodes.TAG_SLUG_TAKEN.action' },
  CATEGORY_SLUG_TAKEN: { messageKey: 'errorCodes.CATEGORY_SLUG_TAKEN.message', actionKey: 'errorCodes.CATEGORY_SLUG_TAKEN.action' },
  LOCALE_CODE_TAKEN: { messageKey: 'errorCodes.LOCALE_CODE_TAKEN.message', actionKey: 'errorCodes.LOCALE_CODE_TAKEN.action' },
  RATE_LIMIT_EXCEEDED: { messageKey: 'errorCodes.RATE_LIMIT_EXCEEDED.message', actionKey: 'errorCodes.RATE_LIMIT_EXCEEDED.action' },
  MEMBER_ALREADY_EXISTS: { messageKey: 'errorCodes.MEMBER_ALREADY_EXISTS.message', actionKey: 'errorCodes.MEMBER_ALREADY_EXISTS.action' },
  MEMBER_CANNOT_REMOVE_OWNER: { messageKey: 'errorCodes.MEMBER_CANNOT_REMOVE_OWNER.message', actionKey: 'errorCodes.MEMBER_CANNOT_REMOVE_OWNER.action' },
  MEDIA_UPLOAD_TOO_LARGE: { messageKey: 'errorCodes.MEDIA_UPLOAD_TOO_LARGE.message', actionKey: 'errorCodes.MEDIA_UPLOAD_TOO_LARGE.action' },
  MEDIA_UPLOAD_INVALID_TYPE: { messageKey: 'errorCodes.MEDIA_UPLOAD_INVALID_TYPE.message', actionKey: 'errorCodes.MEDIA_UPLOAD_INVALID_TYPE.action' },
  AI_NOT_CONFIGURED: { messageKey: 'errorCodes.AI_NOT_CONFIGURED.message', actionKey: 'errorCodes.AI_NOT_CONFIGURED.action' },
  AI_PROVIDER_UNAVAILABLE: { messageKey: 'errorCodes.AI_PROVIDER_UNAVAILABLE.message', actionKey: 'errorCodes.AI_PROVIDER_UNAVAILABLE.action' },
  WORKFLOW_REVIEW_REQUIRED: { messageKey: 'errorCodes.WORKFLOW_REVIEW_REQUIRED.message', actionKey: 'errorCodes.WORKFLOW_REVIEW_REQUIRED.action' },
  WORKFLOW_NO_PERMISSION: { messageKey: 'errorCodes.WORKFLOW_NO_PERMISSION.message', actionKey: 'errorCodes.WORKFLOW_NO_PERMISSION.action' },
  MODULE_NOT_ENABLED: { messageKey: 'errorCodes.MODULE_NOT_ENABLED.message', actionKey: 'errorCodes.MODULE_NOT_ENABLED.action' },
  LOCALE_DELETE_IN_USE: { messageKey: 'errorCodes.LOCALE_DELETE_IN_USE.message', actionKey: 'errorCodes.LOCALE_DELETE_IN_USE.action' },
  SITE_LOCALE_LAST_LANGUAGE: { messageKey: 'errorCodes.SITE_LOCALE_LAST_LANGUAGE.message', actionKey: 'errorCodes.SITE_LOCALE_LAST_LANGUAGE.action' },
  REDIRECT_SAME_PATH: { messageKey: 'errorCodes.REDIRECT_SAME_PATH.message', actionKey: 'errorCodes.REDIRECT_SAME_PATH.action' },
};

/**
 * Pattern-based fallbacks — tried in order when no exact match is found.
 * These handle the `{DOMAIN}_{ACTION}_{REASON}` convention so new backend
 * codes automatically get reasonable messages without frontend changes.
 */
const PATTERN_FALLBACKS: Array<{ pattern: RegExp; keys: ErrorCodeKeys }> = [
  { pattern: /_NOT_FOUND$/, keys: { messageKey: 'errorCodes.patterns.notFound.message', actionKey: 'errorCodes.patterns.notFound.action' } },
  { pattern: /_SLUG_TAKEN$/, keys: { messageKey: 'errorCodes.patterns.slugTaken.message', actionKey: 'errorCodes.patterns.slugTaken.action' } },
  { pattern: /_ACCESS_DENIED$/, keys: { messageKey: 'errorCodes.patterns.accessDenied.message', actionKey: 'errorCodes.patterns.accessDenied.action' } },
  { pattern: /^AUTH_/, keys: { messageKey: 'errorCodes.patterns.auth.message', actionKey: 'errorCodes.patterns.auth.action' } },
  { pattern: /^VALIDATION_/, keys: { messageKey: 'errorCodes.patterns.validation.message', actionKey: 'errorCodes.patterns.validation.action' } },
  { pattern: /^MEDIA_UPLOAD_/, keys: { messageKey: 'errorCodes.patterns.mediaUpload.message', actionKey: 'errorCodes.patterns.mediaUpload.action' } },
];

function translate(keys: ErrorCodeKeys): ErrorCodeInfo {
  return {
    message: i18n.t(keys.messageKey),
    action: i18n.t(keys.actionKey),
  };
}

/** Resolve a ProblemDetails error code to a translated, user-friendly message and action hint. */
export function resolveErrorCode(code: string): ErrorCodeInfo | null {
  const exact = ERROR_CODE_MAP[code];
  if (exact) return translate(exact);

  for (const { pattern, keys } of PATTERN_FALLBACKS) {
    if (pattern.test(code)) return translate(keys);
  }

  return null;
}
