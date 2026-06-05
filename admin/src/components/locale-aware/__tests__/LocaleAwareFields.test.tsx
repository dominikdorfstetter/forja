import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
import { useForm } from 'react-hook-form';
import LocaleAwareFields, { type LocaleFieldSpec } from '../LocaleAwareFields';

const FIELDS: LocaleFieldSpec[] = [
  { name: 'meta_title', label: 'Meta title', maxLength: 70, counterMax: 60, testId: 'seo.meta-title' },
  {
    name: 'meta_description',
    label: 'Meta description',
    maxLength: 200,
    counterMax: 160,
    multiline: true,
    rows: 3,
    testId: 'seo.meta-description',
  },
];

interface HarnessProps {
  isDefault: boolean;
  locale?: { id: string; code: string };
  localization?: { id: string; [k: string]: unknown };
  createLocalization?: (localeId: string, values: Record<string, string>) => Promise<unknown>;
  updateLocalization?: (locId: string, values: Record<string, string>) => Promise<unknown>;
  onDefaultBlur?: () => void;
}

function Harness({
  isDefault,
  locale = { id: 'locale-de', code: 'de' },
  localization,
  createLocalization = vi.fn().mockResolvedValue({}),
  updateLocalization = vi.fn().mockResolvedValue({}),
  onDefaultBlur = vi.fn(),
}: HarnessProps) {
  const { control } = useForm<{ meta_title: string; meta_description: string }>({
    defaultValues: { meta_title: '', meta_description: '' },
  });
  return (
    <LocaleAwareFields
      fields={FIELDS}
      control={control}
      isDefault={isDefault}
      onDefaultBlur={onDefaultBlur}
      locale={locale}
      localization={localization}
      createLocalization={createLocalization}
      updateLocalization={updateLocalization}
      invalidateKey={['locs', 'entity-1']}
    />
  );
}

describe('LocaleAwareFields', () => {
  it('labels every field and exposes a testid on the default path', () => {
    renderWithProviders(<Harness isDefault />);
    // Semantic query by accessible name (label), not CSS selectors.
    expect(screen.getByLabelText('Meta title')).toBeInTheDocument();
    expect(screen.getByLabelText('Meta description')).toBeInTheDocument();
    expect(screen.getByTestId('seo.meta-title')).toBeInTheDocument();
  });

  it('default locale field blur fires the form snapshot (RHF path)', async () => {
    const onDefaultBlur = vi.fn();
    renderWithProviders(<Harness isDefault onDefaultBlur={onDefaultBlur} />);
    const input = screen.getByLabelText('Meta title');
    await userEvent.click(input);
    await userEvent.tab();
    expect(onDefaultBlur).toHaveBeenCalled();
  });

  it('non-default locale edit saves through the component via create mutation', async () => {
    const createLocalization = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <Harness isDefault={false} createLocalization={createLocalization} />,
    );
    // The non-default path renders distinct testids.
    const input = screen.getByTestId('seo.meta-title.localized');
    await userEvent.type(input, 'Titel DE');
    await userEvent.tab();
    await waitFor(() =>
      expect(createLocalization).toHaveBeenCalledWith(
        'locale-de',
        expect.objectContaining({ meta_title: 'Titel DE' }),
      ),
    );
  });

  it('non-default locale edit updates the existing localization row when present', async () => {
    const updateLocalization = vi.fn().mockResolvedValue({});
    renderWithProviders(
      <Harness
        isDefault={false}
        localization={{ id: 'loc-7', meta_title: 'Alt', meta_description: '' }}
        updateLocalization={updateLocalization}
      />,
    );
    const input = screen.getByTestId('seo.meta-description.localized');
    await userEvent.type(input, 'Beschreibung');
    await userEvent.tab();
    await waitFor(() =>
      expect(updateLocalization).toHaveBeenCalledWith(
        'loc-7',
        expect.objectContaining({ meta_description: 'Beschreibung' }),
      ),
    );
  });
});
