import type { HttpClient } from '../http.js';

// ── Field & form definition types ───────────────────────────────────────

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'custom';

export type FormBotProtection = 'none' | 'mandatory';

/**
 * Field-level validation rules. All optional — the form builder picks
 * the rules that apply to the field's type.
 */
export interface FormFieldValidation {
  required?: boolean;
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  /** ECMAScript regex pattern. Server uses Rust's `regex` crate, which
   *  supports most ECMAScript syntax but not lookbehind/lookahead. */
  pattern?: string;
}

export interface FormFieldDefinition {
  id: string;
  /** Technical key used as the submission JSONB key. Never localized. */
  label: string;
  /** Visitor-facing label. Set by the public endpoint when ?locale= matches a
   *  localization; defaults to `label` when no translation applies. */
  display_label?: string;
  field_type: FormFieldType;
  placeholder?: string | null;
  help_text?: string | null;
  validation: FormFieldValidation;
  options?: unknown;
  is_required: boolean;
  display_order: number;
}

export interface PublicFormDefinition {
  id: string;
  site_id: string;
  name: string;
  slug: string;
  description?: string | null;
  consent_required: boolean;
  consent_text?: string | null;
  bot_protection: FormBotProtection;
  fields: FormFieldDefinition[];
}

/**
 * A self-hosted ALTCHA challenge (#770), issued per form when the site uses
 * ALTCHA bot protection. Passed verbatim to the `<altcha-widget>` via its
 * `challenge` attribute (altcha v3; a JSON string is treated as inline
 * challenge data, a URL as an endpoint to fetch from). The widget solves it
 * client-side; the solved payload is submitted as
 * {@link SubmitFormOptions.botProtectionToken}.
 */
export interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

// ── Submission types ────────────────────────────────────────────────────

export interface FormSubmitData {
  [fieldLabel: string]: unknown;
}

export interface FormSubmitResponse {
  submission_id: string;
  reference_code: string;
}

export interface SubmitFormOptions {
  consentGiven?: boolean;
  botProtectionToken?: string;
}

export interface SelfServiceLookup {
  status: string;
  created_at: string;
}

export interface SelfServiceSubmission {
  reference_code: string;
  status: string;
  data: FormSubmitData;
  consent_given: boolean;
  consent_text_at_submission?: string | null;
  created_at: string;
}

/**
 * Client-side validation error map — keyed by field label, mirroring the
 * server's field-keyed error shape.
 */
export type ValidationErrorMap = Record<string, string>;

// ── Resource ────────────────────────────────────────────────────────────

/**
 * Forms module client (#586). Unauthenticated public endpoints; the site
 * is resolved by the `X-Site-Domain` header set on the `ForjaClient`
 * config — make sure `siteDomain` is set before calling these.
 */
export class FormsResource {
  constructor(private readonly http: HttpClient) {}

  /** Fetch a form definition by slug for rendering. */
  /**
   * Fetch a form definition for rendering. Pass `locale` (code or UUID) to
   * receive localized text in `name` / `description` / `consent_text` and
   * each field's `display_label` / `placeholder` / `help_text`. Unknown
   * locales fall through to the form's canonical/default-locale values.
   */
  async getForm(
    slug: string,
    opts?: { locale?: string },
  ): Promise<PublicFormDefinition> {
    const params = opts?.locale ? { locale: opts.locale } : undefined;
    return this.http.get<PublicFormDefinition>(
      `/public/forms/${encodeURIComponent(slug)}`,
      params,
    );
  }

  /**
   * Fetch a fresh self-hosted ALTCHA challenge for a form (#770). Call this
   * only when {@link PublicFormDefinition.bot_protection} is `'mandatory'`
   * and the site uses ALTCHA mode; the server returns 409 otherwise. Each
   * call yields a fresh, single-use challenge.
   */
  async getAltchaChallenge(slug: string): Promise<AltchaChallenge> {
    return this.http.get<AltchaChallenge>(
      `/public/forms/${encodeURIComponent(slug)}/altcha-challenge`,
    );
  }

  /**
   * Submit a form. Throws a {@link ForjaValidationError} if the server
   * rejects the payload with field-level errors.
   */
  async submitForm(
    slug: string,
    data: FormSubmitData,
    opts: SubmitFormOptions = {},
  ): Promise<FormSubmitResponse> {
    return this.http.post<FormSubmitResponse>(
      `/public/forms/${encodeURIComponent(slug)}/submit`,
      {
        data,
        consent_given: opts.consentGiven ?? false,
        bot_protection_token: opts.botProtectionToken,
      },
    );
  }

  /** Privacy-preserving lookup: status + submitted-at only. */
  async lookupSubmission(referenceCode: string): Promise<SelfServiceLookup> {
    return this.http.post<SelfServiceLookup>('/public/submissions/lookup', {
      reference_code: referenceCode,
    });
  }

  /** Visitor's own full view of their submission. */
  async getSubmission(referenceCode: string): Promise<SelfServiceSubmission> {
    return this.http.get<SelfServiceSubmission>(
      `/public/submissions/${encodeURIComponent(referenceCode)}`,
    );
  }

  /** Idempotent self-service delete. Throws on 404/410. */
  async deleteSubmission(referenceCode: string): Promise<void> {
    return this.http.delete(
      `/public/submissions/${encodeURIComponent(referenceCode)}`,
    );
  }
}

// ── Validation helper ───────────────────────────────────────────────────

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

/**
 * Validate a submission payload against a form definition. Mirrors the
 * server-side rules in {@link `models/form_submission.rs:validate_submission`}.
 * Returns an empty object on success; otherwise a `{ label: message }` map.
 *
 * Template authors call this before {@link FormsResource.submitForm} so
 * visitors get inline feedback without a round-trip — but the server
 * always re-validates, so this is purely a UX accelerator.
 */
export function validateSubmission(
  form: PublicFormDefinition,
  data: FormSubmitData,
): ValidationErrorMap {
  const errors: ValidationErrorMap = {};
  for (const field of form.fields) {
    const value = data[field.label];
    const msg = validateField(field, value);
    if (msg) errors[field.label] = msg;
  }
  return errors;
}

function validateField(field: FormFieldDefinition, value: unknown): string | null {
  const v = value;
  const isEmpty =
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v === '') ||
    (Array.isArray(v) && v.length === 0);

  if ((field.is_required || field.validation.required) && isEmpty) {
    return `${field.label} is required`;
  }
  if (isEmpty) return null;

  switch (field.field_type) {
    case 'text':
    case 'textarea':
    case 'custom':
      if (typeof v !== 'string') return 'Must be a string';
      if (
        field.validation.min_length !== undefined &&
        v.length < field.validation.min_length
      ) {
        return `Must be at least ${field.validation.min_length} characters`;
      }
      if (
        field.validation.max_length !== undefined &&
        v.length > field.validation.max_length
      ) {
        return `Must be at most ${field.validation.max_length} characters`;
      }
      if (field.validation.pattern) {
        try {
          if (!new RegExp(field.validation.pattern).test(v)) {
            return 'Value does not match the required pattern';
          }
        } catch {
          return 'Field has an invalid validation pattern';
        }
      }
      return null;
    case 'email':
      if (typeof v !== 'string') return 'Must be a string';
      if (!EMAIL_RE.test(v)) return 'Invalid email format';
      return null;
    case 'number': {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isNaN(n)) return 'Must be a number';
      if (field.validation.min !== undefined && n < field.validation.min) {
        return `Must be at least ${field.validation.min}`;
      }
      if (field.validation.max !== undefined && n > field.validation.max) {
        return `Must be at most ${field.validation.max}`;
      }
      return null;
    }
    case 'date':
      if (typeof v !== 'string' || (Number.isNaN(Date.parse(v)) && !/^\d{4}-\d{2}-\d{2}$/.test(v))) {
        return 'Invalid date format';
      }
      return null;
    case 'select':
    case 'radio':
    case 'checkbox':
      // Option-membership check requires the form's `options` schema; this
      // client-side helper falls back to "accept anything" so it doesn't
      // get out of sync with rapidly-evolving form configurations. The
      // server re-checks against the canonical options list.
      return null;
  }
}
