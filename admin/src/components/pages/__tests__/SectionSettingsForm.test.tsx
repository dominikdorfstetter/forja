import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import type { SectionType } from '@/types/api';
import SectionSettingsForm from '../SectionSettingsForm';
import { SECTION_SETTINGS_FIELDS, readBool, readNumber, readString } from '../sectionSettingsFields';

const ALL_TYPES: SectionType[] = [
  'Hero', 'Features', 'Cta', 'Gallery', 'Testimonials', 'Pricing', 'Faq', 'Contact', 'Custom',
  'Stats', 'Team', 'Timeline', 'LogoCloud', 'Newsletter', 'Video', 'Divider', 'Text',
];

describe('SECTION_SETTINGS_FIELDS', () => {
  it('describes a settings form for every section type', () => {
    for (const type of ALL_TYPES) {
      expect(SECTION_SETTINGS_FIELDS[type]?.fields.length).toBeGreaterThan(0);
    }
  });
});

describe('settings readers', () => {
  it('return the stored value only when it has the expected type', () => {
    const settings = { flag: true, name: 'x', count: 5, wrong: 'true' };
    expect(readBool(settings, 'flag', false)).toBe(true);
    expect(readBool(settings, 'wrong', false)).toBe(false);
    expect(readString(settings, 'name', 'd')).toBe('x');
    expect(readString(settings, 'count', 'd')).toBe('d');
    expect(readNumber(settings, 'count', 3)).toBe(5);
    expect(readNumber(settings, 'missing', 3)).toBe(3);
  });
});

describe('SectionSettingsForm', () => {
  it('renders nothing for a section type without settings', () => {
    const { container } = renderWithProviders(
      <SectionSettingsForm sectionType={'Bogus' as SectionType} settings={{}} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the type heading and its fields with fallbacks', () => {
    renderWithProviders(<SectionSettingsForm sectionType="Contact" settings={{}} onChange={vi.fn()} />);

    expect(screen.getByText('Contact Settings')).toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('textbox')).toHaveValue('name,email,message');
  });

  it('merges a toggled switch into the existing settings', async () => {
    const onChange = vi.fn();
    renderWithProviders(<SectionSettingsForm sectionType="Faq" settings={{ other: 1 }} onChange={onChange} />);

    // Faq's accordion defaults to on.
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith({ other: 1, accordion: false });
  });

  it('writes column selections as numbers', async () => {
    const onChange = vi.fn();
    renderWithProviders(<SectionSettingsForm sectionType="Features" settings={{}} onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: '4 columns' }));

    expect(onChange).toHaveBeenCalledWith({ columns: 4 });
  });

  it('writes string selections as-is', async () => {
    const onChange = vi.fn();
    renderWithProviders(<SectionSettingsForm sectionType="Video" settings={{ provider: 'vimeo' }} onChange={onChange} />);

    const [, aspectRatio] = screen.getAllByRole('combobox');
    await userEvent.click(aspectRatio);
    await userEvent.click(screen.getByRole('option', { name: '4:3' }));

    expect(onChange).toHaveBeenCalledWith({ provider: 'vimeo', aspectRatio: '4:3' });
  });

  it('replaces the settings with valid custom JSON and ignores invalid JSON', () => {
    const onChange = vi.fn();
    renderWithProviders(<SectionSettingsForm sectionType="Custom" settings={{ a: 1 }} onChange={onChange} />);
    const editor = screen.getByRole('textbox');

    fireEvent.change(editor, { target: { value: '{"b": 2' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(editor, { target: { value: '{"b": 2}' } });
    expect(onChange).toHaveBeenCalledWith({ b: 2 });
  });
});
