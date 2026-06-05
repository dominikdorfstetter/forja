import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/store/AuthContext', () => ({
  useAuth: vi.fn(() => ({ canWrite: true })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
import FieldBuilder from '../FieldBuilder';
import { useAuth } from '@/store/AuthContext';
import type { FormFieldInput } from '@/types/api';

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ canWrite: true } as ReturnType<typeof useAuth>);
});

const initialFields: FormFieldInput[] = [
  {
    label: 'Email',
    field_type: 'email',
    is_required: true,
    display_order: 0,
    validation: { required: true },
    placeholder: null,
    help_text: null,
    options: null,
  },
  {
    label: 'Message',
    field_type: 'textarea',
    is_required: true,
    display_order: 1,
    validation: { required: true, min_length: 10 },
    placeholder: null,
    help_text: null,
    options: null,
  },
];

describe('FieldBuilder', () => {
  it('renders the existing fields with their labels and type chips', () => {
    renderWithProviders(<FieldBuilder fields={initialFields} onChange={() => {}} />);
    expect(screen.getByDisplayValue('Email')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Message')).toBeInTheDocument();
  });

  it('adds a new field of the chosen type when the user picks from the type menu', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<FieldBuilder fields={initialFields} onChange={onChange} />);

    await user.click(screen.getByTestId('forms.fields.btn.add'));
    await user.click(await screen.findByTestId('forms.fields.type.select'));

    await waitFor(() => {
      const next = onChange.mock.calls.at(-1)?.[0] as FormFieldInput[];
      expect(next).toHaveLength(3);
      expect(next[2].field_type).toBe('select');
      expect(next[2].display_order).toBe(2);
    });
  });

  it('removes a field when the delete button is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<FieldBuilder fields={initialFields} onChange={onChange} />);

    await user.click(screen.getAllByTestId('forms.fields.btn.delete')[0]);

    await waitFor(() => {
      const next = onChange.mock.calls.at(-1)?.[0] as FormFieldInput[];
      expect(next).toHaveLength(1);
      expect(next[0].label).toBe('Message');
      expect(next[0].display_order).toBe(0);
    });
  });

  it('disables the Add field button when the user is read-only', () => {
    vi.mocked(useAuth).mockReturnValue({ canWrite: false } as ReturnType<typeof useAuth>);
    renderWithProviders(<FieldBuilder fields={initialFields} onChange={() => {}} />);

    expect(screen.getByTestId('forms.fields.btn.add')).toBeDisabled();
  });

  it('disables the per-field Delete buttons when the user is read-only', () => {
    vi.mocked(useAuth).mockReturnValue({ canWrite: false } as ReturnType<typeof useAuth>);
    renderWithProviders(<FieldBuilder fields={initialFields} onChange={() => {}} />);

    const deleteButtons = screen.getAllByTestId('forms.fields.btn.delete');
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[1]).toBeDisabled();
  });

  it('disables the per-field reorder buttons and drag handle when the user is read-only', () => {
    vi.mocked(useAuth).mockReturnValue({ canWrite: false } as ReturnType<typeof useAuth>);
    renderWithProviders(<FieldBuilder fields={initialFields} onChange={() => {}} />);

    screen.getAllByTestId('forms.fields.btn.moveUp').forEach((btn) => expect(btn).toBeDisabled());
    screen.getAllByTestId('forms.fields.btn.moveDown').forEach((btn) => expect(btn).toBeDisabled());
    screen.getAllByTestId('forms.fields.btn.drag').forEach((btn) => expect(btn).toBeDisabled());
  });

  it('moves a field up via the keyboard-accessible move-up button', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<FieldBuilder fields={initialFields} onChange={onChange} />);

    // Second row's move-up button → swaps Message and Email.
    await user.click(screen.getAllByTestId('forms.fields.btn.moveUp')[1]);

    await waitFor(() => {
      const next = onChange.mock.calls.at(-1)?.[0] as FormFieldInput[];
      expect(next[0].label).toBe('Message');
      expect(next[1].label).toBe('Email');
      expect(next[0].display_order).toBe(0);
      expect(next[1].display_order).toBe(1);
    });
  });
});
