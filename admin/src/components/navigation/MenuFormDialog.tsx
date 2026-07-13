import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Tab,
  Tabs,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import type {
  NavigationMenu,
  CreateNavigationMenuRequest,
  UpdateNavigationMenuRequest,
  MenuLocalizationInput,
  Locale,
} from '@/types/api';
import { useTranslation } from 'react-i18next';
import { formResolver } from '@/utils/validation';
import FormDialog from '@/components/shared/FormDialog';

const menuSchema = z.object({
  slug: z.string()
    .min(1, 'Slug is required')
    .max(50, 'Slug cannot exceed 50 characters')
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(255).optional().or(z.literal('')),
  max_depth: z.coerce.number().int().min(1).max(10),
  is_active: z.boolean(),
});

type MenuFormData = z.infer<typeof menuSchema>;

interface MenuFormDialogProps {
  open: boolean;
  menu?: NavigationMenu | null;
  locales?: Locale[];
  onSubmitCreate: (data: CreateNavigationMenuRequest) => void;
  onSubmitUpdate: (data: UpdateNavigationMenuRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

const EMPTY_LOCALES: Locale[] = [];

/** Per-locale display names keyed by locale id, from a menu's localizations. */
function toDisplayNames(menu?: NavigationMenu | null): Record<string, string> {
  return Object.fromEntries(
    (menu?.localizations ?? []).map((l) => [l.locale_id, l.name]),
  );
}

export default function MenuFormDialog({ open, menu, locales = EMPTY_LOCALES, onSubmitCreate, onSubmitUpdate, onClose, loading }: MenuFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors, isValid } } = useForm<MenuFormData>({
    resolver: formResolver(menuSchema),
    defaultValues: { slug: '', description: '', max_depth: 3, is_active: true },
    mode: 'onChange',
  });

  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [activeLocaleTab, setActiveLocaleTab] = useState(0);

  // A cleared, previously-persisted display name is an explicit removal:
  // its locale id rides in `removed_locale_ids` on the update payload.
  const persistedNames = useMemo(() => toDisplayNames(menu), [menu]);
  const clearedLocaleIds = useMemo(
    () =>
      locales
        .filter(
          (locale) =>
            (persistedNames[locale.id] ?? '') !== '' &&
            (displayNames[locale.id] ?? '').trim() === '',
        )
        .map((locale) => locale.id),
    [locales, persistedNames, displayNames],
  );

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      reset(menu ? {
        slug: menu.slug,
        description: menu.description || '',
        max_depth: menu.max_depth,
        is_active: menu.is_active,
      } : { slug: '', description: '', max_depth: 3, is_active: true });
      setDisplayNames(toDisplayNames(menu));
      setActiveLocaleTab(0);
    }
    prevOpenRef.current = open;
  }, [open, menu, reset]);

  const handleDisplayNameChange = useCallback((localeId: string, value: string) => {
    setDisplayNames((prev) => ({ ...prev, [localeId]: value }));
  }, []);

  const onFormSubmit = (data: MenuFormData) => {
    const localizationInputs: MenuLocalizationInput[] = locales.flatMap((locale) => {
      const name = displayNames[locale.id]?.trim();
      return name ? [{ locale_id: locale.id, name }] : [];
    });
    const localizations = localizationInputs.length > 0 ? localizationInputs : undefined;

    if (menu) {
      onSubmitUpdate({
        slug: data.slug,
        description: data.description || undefined,
        max_depth: data.max_depth,
        is_active: data.is_active,
        localizations,
        removed_locale_ids: clearedLocaleIds.length > 0 ? clearedLocaleIds : undefined,
      });
    } else {
      onSubmitCreate({
        slug: data.slug,
        description: data.description || undefined,
        max_depth: data.max_depth,
        localizations,
      });
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="menu_book"
      title={menu ? t('navigation.menus.editTitle', 'Edit Menu') : t('navigation.menus.createTitle', 'Create Menu')}
      submitLabel={menu ? t('common.actions.save') : t('common.actions.create')}
      submitDisabled={!isValid}
      submitTestId="menu-form.btn.submit"
      cancelTestId="menu-form.btn.cancel"
      loading={loading}
      data-testid="menu-form.dialog"
    >
      <TextField
        autoFocus
        label={t('navigation.menus.fields.slug', 'Slug')}
        fullWidth
        required
        size="small"
        {...register('slug')}
        error={!!errors.slug}
        helperText={errors.slug?.message || t('navigation.menus.fields.slugHelp', 'e.g. primary, footer, sidebar')}
      />
      <TextField
        label={t('navigation.menus.fields.description', 'Description')}
        fullWidth
        size="small"
        {...register('description')}
        error={!!errors.description}
        helperText={errors.description?.message}
      />
      <TextField
        label={t('navigation.menus.fields.maxDepth', 'Max Depth')}
        type="number"
        fullWidth
        size="small"
        {...register('max_depth')}
        error={!!errors.max_depth}
        helperText={errors.max_depth?.message || t('navigation.menus.fields.maxDepthHelp', 'Maximum nesting depth (1-10)')}
      />
      <DisplayNamesSection
        locales={locales}
        displayNames={displayNames}
        clearedLocaleIds={clearedLocaleIds}
        activeTab={activeLocaleTab}
        onTabChange={setActiveLocaleTab}
        onNameChange={handleDisplayNameChange}
      />
      {menu && (
        <Controller name="is_active" control={control} render={({ field }) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={field.onChange} />}
            label={t('navigation.menus.fields.active', 'Active')}
          />
        )} />
      )}
    </FormDialog>
  );
}

function DisplayNamesSection({
  locales,
  displayNames,
  clearedLocaleIds,
  activeTab,
  onTabChange,
  onNameChange,
}: {
  locales: Locale[];
  displayNames: Record<string, string>;
  clearedLocaleIds: string[];
  activeTab: number;
  onTabChange: (tab: number) => void;
  onNameChange: (localeId: string, value: string) => void;
}) {
  const { t } = useTranslation();

  if (locales.length === 0) return null;

  const currentLocale = locales[activeTab] ?? locales[0];
  const currentCleared = clearedLocaleIds.includes(currentLocale.id);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('navigation.menus.fields.displayNames', 'Display names')}
      </Typography>
      {locales.length > 1 && (
        <Tabs
          value={activeTab}
          onChange={(_, v) => onTabChange(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 1 }}
        >
          {locales.map((locale) => (
            <Tab
              key={locale.id}
              label={locale.code.toUpperCase()}
              aria-label={locale.code}
            />
          ))}
        </Tabs>
      )}
      <TextField
        label={`${t('navigation.menus.fields.displayName', 'Display name')} (${currentLocale.code})`}
        fullWidth
        size="small"
        value={displayNames[currentLocale.id] ?? ''}
        onChange={(e) => onNameChange(currentLocale.id, e.target.value)}
        helperText={
          currentCleared
            ? t('navigation.menus.fields.displayNameClearHint', 'Clearing removes this translation when you save')
            : t('navigation.menus.fields.displayNamesHelp', 'Optional menu name shown to visitors in this language (e.g. as a footer heading)')
        }
        slotProps={{ htmlInput: { 'data-testid': 'menu-form.input.display-name', maxLength: 200 } }}
      />
    </Box>
  );
}
