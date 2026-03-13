export interface ErrorCodeInfo {
  message: string;
  action?: string;
}

/**
 * Specific error code overrides — keyed by the exact `{DOMAIN}_{ACTION}_{REASON}` code
 * from ProblemDetails.code. Add entries here when the backend message isn't
 * user-friendly enough or when an action hint is needed.
 */
const ERROR_CODE_MAP: Record<string, ErrorCodeInfo> = {
  // Auth
  AUTH_MISSING_CREDENTIALS: { message: 'Authentication required', action: 'Please sign in to continue.' },
  AUTH_TOKEN_INVALID: { message: 'Session expired', action: 'Please sign in again.' },
  AUTH_INSUFFICIENT_ROLE: { message: 'Insufficient permissions', action: 'Contact an admin for elevated access.' },
  AUTH_SITE_ACCESS_DENIED: { message: 'Site access denied', action: 'Contact the site owner for access.' },
  AUTH_API_KEY_INVALID: { message: 'Invalid API key', action: 'Check your API key configuration.' },
  AUTH_ACCOUNT_SOLE_OWNER: { message: 'Cannot delete account', action: 'Transfer site ownership first.' },

  // Slug conflicts
  BLOG_SLUG_TAKEN: { message: 'Blog slug already in use', action: 'Choose a different slug.' },
  PAGE_SLUG_TAKEN: { message: 'Page slug already in use', action: 'Choose a different slug.' },
  SITE_SLUG_TAKEN: { message: 'Site slug already in use', action: 'Choose a different slug.' },
  TAG_SLUG_TAKEN: { message: 'Tag slug already in use', action: 'Choose a different slug.' },
  CATEGORY_SLUG_TAKEN: { message: 'Category slug already in use', action: 'Choose a different slug.' },
  LOCALE_CODE_TAKEN: { message: 'Locale code already exists', action: 'Use a different locale code.' },

  // Rate limiting
  RATE_LIMIT_EXCEEDED: { message: 'Too many requests', action: 'Please wait a moment and try again.' },

  // Membership
  MEMBER_ALREADY_EXISTS: { message: 'Member already exists', action: 'This user is already a member of the site.' },
  MEMBER_CANNOT_REMOVE_OWNER: { message: 'Cannot remove owner', action: 'Transfer ownership before removing this member.' },

  // Media uploads
  MEDIA_UPLOAD_TOO_LARGE: { message: 'File too large', action: 'Reduce the file size or adjust site settings.' },
  MEDIA_UPLOAD_INVALID_TYPE: { message: 'Unsupported file type', action: 'Check the allowed file types.' },

  // AI
  AI_NOT_CONFIGURED: { message: 'AI not configured', action: 'Set up an AI provider in site settings.' },
  AI_PROVIDER_UNAVAILABLE: { message: 'AI provider unavailable', action: 'Check your AI configuration or try again later.' },

  // Workflow
  WORKFLOW_REVIEW_REQUIRED: { message: 'Review required', action: 'Submit content for review before publishing.' },
  WORKFLOW_NO_PERMISSION: { message: 'Workflow permission denied', action: "You don't have permission for this workflow action." },

  // Modules
  MODULE_NOT_ENABLED: { message: 'Module not enabled', action: 'Enable this module in site settings.' },

  // Locale
  LOCALE_DELETE_IN_USE: { message: 'Locale in use', action: 'Remove all content using this locale first.' },
  SITE_LOCALE_LAST_LANGUAGE: { message: 'Cannot remove last locale', action: 'Sites must have at least one locale.' },

  // Redirect
  REDIRECT_SAME_PATH: { message: 'Redirect loop detected', action: 'Source and destination paths must be different.' },
};

/**
 * Pattern-based fallbacks — tried in order when no exact match is found.
 * These handle the `{DOMAIN}_{ACTION}_{REASON}` convention so new backend
 * codes automatically get reasonable messages without frontend changes.
 */
const PATTERN_FALLBACKS: Array<{ pattern: RegExp; info: ErrorCodeInfo }> = [
  { pattern: /_NOT_FOUND$/, info: { message: 'Resource not found', action: 'It may have been deleted or moved.' } },
  { pattern: /_SLUG_TAKEN$/, info: { message: 'Slug already in use', action: 'Choose a different slug.' } },
  { pattern: /_ACCESS_DENIED$/, info: { message: 'Access denied', action: "You don't have permission for this action." } },
  { pattern: /^AUTH_/, info: { message: 'Authentication error', action: 'Try signing in again.' } },
  { pattern: /^VALIDATION_/, info: { message: 'Validation error', action: 'Check the form fields and try again.' } },
  { pattern: /^MEDIA_UPLOAD_/, info: { message: 'Upload failed', action: 'Check the file and try again.' } },
];

/** Resolve a ProblemDetails error code to a user-friendly message and optional action hint. */
export function resolveErrorCode(code: string): ErrorCodeInfo | null {
  const exact = ERROR_CODE_MAP[code];
  if (exact) return exact;

  for (const { pattern, info } of PATTERN_FALLBACKS) {
    if (pattern.test(code)) return info;
  }

  return null;
}
