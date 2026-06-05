import { describe, it, expect, vi } from 'vitest';
import {
  FormsResource,
  validateSubmission,
  type PublicFormDefinition,
} from '../../resources/forms.js';
import type { HttpClient } from '../../http.js';

function createMockHttp(): HttpClient {
  return {
    get: vi.fn(), getOrNull: vi.fn(),
    getText: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  };
}

const contactForm: PublicFormDefinition = {
  id: 'f-1',
  site_id: 's-1',
  name: 'Contact',
  slug: 'contact',
  description: null,
  consent_required: false,
  consent_text: null,
  bot_protection: 'none',
  fields: [
    {
      id: 'fld-1',
      label: 'Email',
      field_type: 'email',
      placeholder: null,
      help_text: null,
      validation: {},
      options: undefined,
      is_required: true,
      display_order: 0,
    },
  ],
};

describe('FormsResource (#586)', () => {
  it('getForm hits the public form endpoint with the encoded slug', async () => {
    const http = createMockHttp();
    vi.mocked(http.get).mockResolvedValue(contactForm);

    const resource = new FormsResource(http);
    const form = await resource.getForm('contact form');

    expect(http.get).toHaveBeenCalledWith('/public/forms/contact%20form', undefined);
    expect(form.slug).toBe('contact');
  });

  it('getForm passes the locale code as a query param when provided', async () => {
    const http = createMockHttp();
    vi.mocked(http.get).mockResolvedValue(contactForm);

    await new FormsResource(http).getForm('contact', { locale: 'de' });

    expect(http.get).toHaveBeenCalledWith('/public/forms/contact', { locale: 'de' });
  });

  it('submitForm posts data, consent_given, and bot_protection_token', async () => {
    const http = createMockHttp();
    vi.mocked(http.post).mockResolvedValue({
      submission_id: 'sub-1',
      reference_code: 'AAAA-BBBB-CCCC',
    });

    const resource = new FormsResource(http);
    const result = await resource.submitForm(
      'contact',
      { Email: 'v@example.com' },
      { consentGiven: true, botProtectionToken: 'recaptcha-token' },
    );

    expect(http.post).toHaveBeenCalledWith('/public/forms/contact/submit', {
      data: { Email: 'v@example.com' },
      consent_given: true,
      bot_protection_token: 'recaptcha-token',
    });
    expect(result.reference_code).toBe('AAAA-BBBB-CCCC');
  });

  it('submitForm defaults consent_given to false when not provided', async () => {
    const http = createMockHttp();
    vi.mocked(http.post).mockResolvedValue({
      submission_id: 'sub-1',
      reference_code: 'A-B-C',
    });
    await new FormsResource(http).submitForm('contact', { Email: 'v@example.com' });
    expect(http.post).toHaveBeenCalledWith('/public/forms/contact/submit', {
      data: { Email: 'v@example.com' },
      consent_given: false,
      bot_protection_token: undefined,
    });
  });

  it('getAltchaChallenge fetches the per-form challenge with the encoded slug', async () => {
    const http = createMockHttp();
    const challenge = {
      algorithm: 'SHA-256',
      challenge: 'abc123',
      maxnumber: 50000,
      salt: 'deadbeef?expires=1234567890&',
      signature: 'sig',
    };
    vi.mocked(http.get).mockResolvedValue(challenge);

    const result = await new FormsResource(http).getAltchaChallenge('contact form');

    expect(http.get).toHaveBeenCalledWith('/public/forms/contact%20form/altcha-challenge');
    expect(result.salt).toBe('deadbeef?expires=1234567890&');
  });

  it('lookupSubmission POSTs the reference code', async () => {
    const http = createMockHttp();
    vi.mocked(http.post).mockResolvedValue({
      status: 'new',
      created_at: '2026-05-11T00:00:00Z',
    });
    await new FormsResource(http).lookupSubmission('XXXX-YYYY-ZZZZ');
    expect(http.post).toHaveBeenCalledWith('/public/submissions/lookup', {
      reference_code: 'XXXX-YYYY-ZZZZ',
    });
  });

  it('deleteSubmission DELETEs the reference path', async () => {
    const http = createMockHttp();
    await new FormsResource(http).deleteSubmission('XXXX-YYYY-ZZZZ');
    expect(http.delete).toHaveBeenCalledWith('/public/submissions/XXXX-YYYY-ZZZZ');
  });

  it('getSubmission fetches the visitor self-service detail by reference code', async () => {
    const http = createMockHttp();
    vi.mocked(http.get).mockResolvedValue({
      reference_code: 'XXXX-YYYY-ZZZZ',
      status: 'new',
      data: { Email: 'v@example.com' },
      consent_given: true,
      consent_text_at_submission: null,
      created_at: '2026-05-11T00:00:00Z',
    });
    const result = await new FormsResource(http).getSubmission('XXXX-YYYY-ZZZZ');
    expect(http.get).toHaveBeenCalledWith('/public/submissions/XXXX-YYYY-ZZZZ');
    expect(result.reference_code).toBe('XXXX-YYYY-ZZZZ');
  });
});

describe('validateSubmission (#586)', () => {
  it('flags missing required fields', () => {
    const errors = validateSubmission(contactForm, {});
    expect(errors).toEqual({ Email: 'Email is required' });
  });

  it('also flags missing values when only validation.required is true (not is_required)', () => {
    // is_required: false on the field, but validation.required: true — should still error.
    const form: PublicFormDefinition = {
      ...contactForm,
      fields: [{ ...contactForm.fields[0], is_required: false, validation: { required: true } }],
    };
    expect(validateSubmission(form, {})).toEqual({ Email: 'Email is required' });
  });

  it('returns no error for empty optional fields', () => {
    const form: PublicFormDefinition = {
      ...contactForm,
      fields: [{ ...contactForm.fields[0], is_required: false, validation: {} }],
    };
    expect(validateSubmission(form, {})).toEqual({});
    expect(validateSubmission(form, { Email: '' })).toEqual({});
    expect(validateSubmission(form, { Email: null as unknown as string })).toEqual({});
  });

  it('flags invalid email format', () => {
    const errors = validateSubmission(contactForm, { Email: 'notanemail' });
    expect(errors.Email).toBe('Invalid email format');
  });

  it('returns no errors for valid input', () => {
    const errors = validateSubmission(contactForm, { Email: 'v@example.com' });
    expect(errors).toEqual({});
  });

  it('enforces min_length and max_length on text fields', () => {
    const form: PublicFormDefinition = {
      ...contactForm,
      fields: [
        {
          ...contactForm.fields[0],
          label: 'Body',
          field_type: 'textarea',
          validation: { min_length: 10, max_length: 20 },
        },
      ],
    };
    expect(validateSubmission(form, { Body: 'short' }).Body).toContain('at least 10');
    expect(validateSubmission(form, { Body: 'x'.repeat(21) }).Body).toContain('at most 20');
    expect(validateSubmission(form, { Body: 'just enough' })).toEqual({});
  });

  it('enforces numeric bounds', () => {
    const form: PublicFormDefinition = {
      ...contactForm,
      fields: [
        {
          ...contactForm.fields[0],
          label: 'Age',
          field_type: 'number',
          validation: { min: 18, max: 100 },
        },
      ],
    };
    expect(validateSubmission(form, { Age: 10 }).Age).toContain('at least 18');
    expect(validateSubmission(form, { Age: 150 }).Age).toContain('at most 100');
    expect(validateSubmission(form, { Age: 42 })).toEqual({});
  });

  it('enforces pattern on custom fields', () => {
    const form: PublicFormDefinition = {
      ...contactForm,
      fields: [
        {
          ...contactForm.fields[0],
          label: 'ZIP',
          field_type: 'custom',
          validation: { pattern: '^[0-9]{5}$' },
        },
      ],
    };
    expect(validateSubmission(form, { ZIP: 'abcde' }).ZIP).toBeDefined();
    expect(validateSubmission(form, { ZIP: '12345' })).toEqual({});
  });

  it('catches invalid regex patterns and reports a friendly error', () => {
    const form: PublicFormDefinition = {
      ...contactForm,
      fields: [
        {
          ...contactForm.fields[0],
          label: 'Code',
          field_type: 'text',
          // Unclosed character class — RegExp constructor throws.
          validation: { pattern: '[invalid' },
        },
      ],
    };
    expect(validateSubmission(form, { Code: 'whatever' }).Code).toBe(
      'Field has an invalid validation pattern',
    );
  });

  it('validates date fields against ISO and YYYY-MM-DD formats', () => {
    const form: PublicFormDefinition = {
      ...contactForm,
      fields: [
        {
          ...contactForm.fields[0],
          label: 'When',
          field_type: 'date',
          validation: {},
        },
      ],
    };
    expect(validateSubmission(form, { When: 'not a date' }).When).toBe(
      'Invalid date format',
    );
    expect(validateSubmission(form, { When: 12345 }).When).toBe(
      'Invalid date format',
    );
    expect(validateSubmission(form, { When: '2026-05-11' })).toEqual({});
    expect(validateSubmission(form, { When: '2026-05-11T10:00:00Z' })).toEqual({});
  });

  it('rejects non-string values on text/textarea/custom fields', () => {
    const form: PublicFormDefinition = {
      ...contactForm,
      fields: [
        {
          ...contactForm.fields[0],
          label: 'Notes',
          field_type: 'textarea',
          validation: {},
        },
      ],
    };
    expect(validateSubmission(form, { Notes: 42 }).Notes).toBe('Must be a string');
  });

  it('rejects non-string values on email fields', () => {
    expect(validateSubmission(contactForm, { Email: 42 }).Email).toBe('Must be a string');
  });

  it('rejects non-numeric values on number fields', () => {
    const form: PublicFormDefinition = {
      ...contactForm,
      fields: [
        {
          ...contactForm.fields[0],
          label: 'Age',
          field_type: 'number',
          validation: {},
        },
      ],
    };
    expect(validateSubmission(form, { Age: 'not a number' }).Age).toBe('Must be a number');
  });

  it('accepts any value for select / radio / checkbox (server re-checks)', () => {
    const selectForm: PublicFormDefinition = {
      ...contactForm,
      fields: [
        {
          ...contactForm.fields[0],
          label: 'Choice',
          field_type: 'select',
          validation: {},
        },
      ],
    };
    expect(validateSubmission(selectForm, { Choice: 'whatever' })).toEqual({});

    const radioForm: PublicFormDefinition = {
      ...selectForm,
      fields: [{ ...selectForm.fields[0], field_type: 'radio' }],
    };
    expect(validateSubmission(radioForm, { Choice: 'foo' })).toEqual({});

    const checkboxForm: PublicFormDefinition = {
      ...selectForm,
      fields: [{ ...selectForm.fields[0], field_type: 'checkbox' }],
    };
    expect(validateSubmission(checkboxForm, { Choice: ['a', 'b'] })).toEqual({});
  });
});
