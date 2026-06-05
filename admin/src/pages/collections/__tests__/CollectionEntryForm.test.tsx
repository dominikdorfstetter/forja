import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionEntryForm } from '../CollectionEntryForm';
import type { CustomEntryRequest, CustomFieldResponse, CustomTypeResponse } from '@/types/customTypes';

function field(partial: Partial<CustomFieldResponse> & { key: string }): CustomFieldResponse {
  return {
    id: `f-${partial.key}`,
    label: partial.key,
    labels: null,
    field_type: 'text',
    required: false,
    localized: false,
    is_title: false,
    is_pii: false,
    data_category: null,
    processing_purpose: null,
    legal_basis: null,
    enum_options: null,
    min: null,
    max: null,
    min_length: null,
    max_length: null,
    pattern: null,
    is_unique: false,
    display_order: 0,
    deprecated_at: null,
    ...partial,
  };
}

function schema(fields: CustomFieldResponse[]): CustomTypeResponse {
  return {
    id: 'ct-1',
    site_id: 'site-1',
    key: 'recipe',
    name: 'Recipe',
    retention_days: null,
    is_publicly_readable: true,
    content_kind: 'page',
    schema_version: 1,
    fields,
    created_at: '',
    updated_at: '',
  };
}

const recipe = schema([
  field({ key: 'title', label: 'Title', is_title: true, required: true }),
  field({ key: 'servings', label: 'Servings', field_type: 'number' }),
  field({ key: 'agree', label: 'Agree', field_type: 'boolean' }),
  field({ key: 'when', label: 'When', field_type: 'date' }),
  field({ key: 'spice', label: 'Spice', field_type: 'enum', enum_options: ['mild', 'hot'] }),
  field({ key: 'photo', label: 'Photo', field_type: 'media' }),
  field({ key: 'notes', label: 'Notes', field_type: 'richtext', localized: true }),
]);

describe('CollectionEntryForm (tracer)', () => {
  it('renders a control for each of the 7 field types', () => {
    render(<CollectionEntryForm schema={recipe} locales={['en']} onSubmit={vi.fn()} />);
    for (const key of ['title', 'servings', 'agree', 'when', 'spice', 'photo', 'notes']) {
      expect(screen.getByTestId(`field-${key}`)).toBeInTheDocument();
    }
    // Localized field surfaces the locale tab.
    expect(screen.getByTestId('locale-tabs')).toBeInTheDocument();
  });

  it('fills shared + localized values and submits a matching payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CollectionEntryForm schema={recipe} locales={['en']} onSubmit={onSubmit} />);

    await user.type(screen.getByTestId('field-title'), 'Spaghetti');
    await user.type(screen.getByTestId('field-servings'), '4');
    await user.click(screen.getByTestId('field-agree'));
    await user.type(screen.getByTestId('field-notes'), 'Boil water');

    await user.click(screen.getByTestId('save-entry'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as CustomEntryRequest;
    expect(payload.shared.title).toBe('Spaghetti');
    expect(payload.shared.servings).toBe(4);
    expect(payload.shared.agree).toBe(true);
    expect(payload.localized.en.notes).toBe('Boil water');
  });

  it('renders fields in display_order even when an earlier field is localized', () => {
    // Regression: a localized title (order 0) used to sink below a shared
    // description (order 1) because the form grouped shared-then-localized.
    const ordered = schema([
      field({ key: 'title', label: 'Title', is_title: true, localized: true, display_order: 0 }),
      field({ key: 'description', label: 'Description', display_order: 1 }),
    ]);
    render(<CollectionEntryForm schema={ordered} locales={['en', 'de']} onSubmit={vi.fn()} />);

    const controls = screen.getAllByTestId(/^field-/);
    expect(controls.map((el) => el.getAttribute('data-testid'))).toEqual([
      'field-title',
      'field-description',
    ]);
  });

  it('renders a redacted, read-only control for server-redacted PII', () => {
    const piiSchema = schema([
      field({ key: 'title', label: 'Title', is_title: true }),
      field({ key: 'email', label: 'Email', is_pii: true }),
    ]);
    render(
      <CollectionEntryForm
        schema={piiSchema}
        locales={['en']}
        initialShared={{ title: 'X', email: null }}
        onSubmit={vi.fn()}
      />,
    );
    const emailInput = screen.getByTestId('field-email') as HTMLInputElement;
    expect(emailInput).toBeDisabled();
  });
});
