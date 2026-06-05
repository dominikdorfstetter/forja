import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionTypeBuilder } from '../CollectionTypeBuilder';
import type { CreateCustomTypeRequest, CustomTypeResponse } from '@/types/customTypes';

// Assertions target data-testid + payload shape, not translated copy.

describe('CollectionTypeBuilder (tracer)', () => {
  it('adds a PII field and emits a payload matching the entered values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CollectionTypeBuilder onSubmit={onSubmit} />);

    // Type-level
    await user.type(screen.getByTestId('type-name'), 'Contact');
    await user.type(screen.getByTestId('type-key'), 'contact');

    // The first (title) field row.
    const rows = () => screen.getAllByTestId('field-row');
    const titleRow = rows()[0];
    await user.type(within(titleRow).getByTestId('field-key'), 'name');
    await user.type(within(titleRow).getByTestId('field-label'), 'Name');

    // Add a second field, mark it PII, give it a legal basis.
    await user.click(screen.getByTestId('add-field'));
    const piiRow = rows()[1];
    await user.type(within(piiRow).getByTestId('field-key'), 'email');
    await user.type(within(piiRow).getByTestId('field-label'), 'Email');
    await user.click(within(piiRow).getByTestId('field-pii'));
    await user.type(within(piiRow).getByTestId('field-legal-basis'), 'consent');

    await user.click(screen.getByTestId('save-type'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as CreateCustomTypeRequest;
    expect(payload.key).toBe('contact');
    expect(payload.name).toBe('Contact');
    expect(payload.fields).toHaveLength(2);

    const [f0, f1] = payload.fields;
    expect(f0.key).toBe('name');
    expect(f0.is_title).toBe(true);
    expect(f1.key).toBe('email');
    expect(f1.is_pii).toBe(true);
    expect(f1.legal_basis).toBe('consent');
    expect(f1.is_title).toBe(false);
    // display_order is assigned by position.
    expect(f0.display_order).toBe(0);
    expect(f1.display_order).toBe(1);
  });

  it('keeps exactly one title field when toggling another', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CollectionTypeBuilder onSubmit={onSubmit} />);
    await user.type(screen.getByTestId('type-name'), 'T');
    await user.type(screen.getByTestId('type-key'), 't');

    await user.click(screen.getByTestId('add-field'));
    const rows = screen.getAllByTestId('field-row');
    await user.type(within(rows[0]).getByTestId('field-key'), 'a');
    await user.type(within(rows[0]).getByTestId('field-label'), 'A');
    await user.type(within(rows[1]).getByTestId('field-key'), 'b');
    await user.type(within(rows[1]).getByTestId('field-label'), 'B');

    // Make the second row the title; the first should lose it.
    await user.click(within(rows[1]).getByTestId('field-title'));
    await user.click(screen.getByTestId('save-type'));

    const payload = onSubmit.mock.calls[0][0] as CreateCustomTypeRequest;
    const titles = payload.fields.filter((f) => f.is_title);
    expect(titles).toHaveLength(1);
    expect(titles[0].key).toBe('b');
  });

  it('edit mode: prefills, locks the key, and carries field ids on save', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const initial: CustomTypeResponse = {
      id: 'type-1',
      site_id: 'site-1',
      key: 'recipe',
      name: 'Recipe',
      retention_days: null,
      is_publicly_readable: true,
      content_kind: 'page',
      schema_version: 2,
      created_at: '',
      updated_at: '',
      fields: [
        {
          id: 'field-1',
          key: 'title',
          label: 'Title',
          labels: null,
          field_type: 'text',
          required: true,
          localized: false,
          is_title: true,
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
        },
      ],
    };

    render(<CollectionTypeBuilder mode="edit" initial={initial} onSubmit={onSubmit} />);

    // Prefilled name + locked key.
    expect(screen.getByTestId('type-name')).toHaveValue('Recipe');
    expect(screen.getByTestId('type-key')).toBeDisabled();

    // Rename the existing field's label and save.
    const titleRow = screen.getAllByTestId('field-row')[0];
    await user.clear(within(titleRow).getByTestId('field-label'));
    await user.type(within(titleRow).getByTestId('field-label'), 'Recipe name');
    await user.click(screen.getByTestId('save-type'));

    const payload = onSubmit.mock.calls[0][0] as CreateCustomTypeRequest;
    expect(payload.name).toBe('Recipe');
    expect(payload.content_kind).toBe('page');
    // The id rides along so the backend treats this as an evolve, not a new field.
    expect(payload.fields[0].id).toBe('field-1');
    expect(payload.fields[0].label).toBe('Recipe name');
    expect(payload.fields[0].is_title).toBe(true);
  });
});
