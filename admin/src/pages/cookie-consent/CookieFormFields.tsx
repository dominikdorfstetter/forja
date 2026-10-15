import { TextField, FormControlLabel, Switch } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import type { CookieFormData } from './cookieForm';

interface CookieFormFieldsProps {
  register: UseFormRegister<CookieFormData>;
  control: Control<CookieFormData>;
  errors: FieldErrors<CookieFormData>;
  /** data-testid prefix, e.g. `cookie-group-form`. */
  testIdPrefix: string;
  /** Groups also expose whether the cookie is on by default for visitors. */
  showDefaultEnabled?: boolean;
}

/** Cookie name + switches shared by the cookie group and cookie item dialogs. */
export default function CookieFormFields({ register, control, errors, testIdPrefix, showDefaultEnabled = false }: CookieFormFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        label={t('legalDetail.dialog.cookieName')}
        fullWidth
        size="small"
        data-testid={`${testIdPrefix}.cookie-name`}
        {...register('cookie_name', { required: t('legalDetail.dialog.cookieNameRequired') })}
        error={!!errors.cookie_name}
        helperText={errors.cookie_name?.message}
      />
      <CookieSwitch name="is_required" control={control} label={t('legalDetail.dialog.required')} testId={`${testIdPrefix}.is-required`} />
      {showDefaultEnabled && (
        <CookieSwitch name="default_enabled" control={control} label={t('legalDetail.dialog.defaultEnabled')} testId={`${testIdPrefix}.default-enabled`} />
      )}
    </>
  );
}

interface CookieSwitchProps {
  name: 'is_required' | 'default_enabled';
  control: Control<CookieFormData>;
  label: string;
  testId: string;
}

function CookieSwitch({ name, control, label, testId }: CookieSwitchProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          control={<Switch checked={field.value} onChange={field.onChange} data-testid={testId} />}
          label={label}
        />
      )}
    />
  );
}
