import type { Dispatch } from 'react';
import { FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useTranslation } from 'react-i18next';
import PasswordAdornment from './PasswordAdornment';
import { validatePassword, type PasswordPolicy } from './passwordUtils';
import type { DocFormAction, DocFormState } from './documentFormState';

interface DocumentPrivacyFieldsProps {
  state: Pick<DocFormState, 'isPrivate' | 'password' | 'confirmPassword' | 'showPassword'>;
  dispatch: Dispatch<DocFormAction>;
  passwordPolicy?: PasswordPolicy;
}

/** "Password-protect this file" toggle plus the password/confirmation inputs. */
export default function DocumentPrivacyFields({ state, dispatch, passwordPolicy }: DocumentPrivacyFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <FormControlLabel
        control={
          <Switch
            checked={state.isPrivate}
            onChange={(e) => dispatch({ type: 'SET_IS_PRIVATE', value: e.target.checked, policy: passwordPolicy })}
          />
        }
        label={
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <LockIcon fontSize="small" />
            <span>{t('documents.privacy.setTitle')}</span>
          </Stack>
        }
      />
      {state.isPrivate && (
        <PasswordInputs state={state} dispatch={dispatch} passwordPolicy={passwordPolicy} />
      )}
    </>
  );
}

function PasswordInputs({ state, dispatch, passwordPolicy }: DocumentPrivacyFieldsProps) {
  const { t } = useTranslation();
  const pwError = validatePassword(state.password, passwordPolicy);
  const mismatch = state.confirmPassword.length > 0 && state.password !== state.confirmPassword;
  const inputType = state.showPassword ? 'text' : 'password';

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
        {t('documents.privacy.setDescription')}
      </Typography>
      <TextField
        label={t('documents.privacy.password')}
        type={inputType}
        fullWidth
        size="small"
        value={state.password}
        onChange={(e) => dispatch({ type: 'SET_PASSWORD', value: e.target.value })}
        error={!!pwError}
        helperText={pwError ?? undefined}
        slotProps={{
          input: {
            endAdornment: (
              <PasswordAdornment
                visible={state.showPassword}
                onToggleVisible={() => dispatch({ type: 'SET_SHOW_PASSWORD', value: !state.showPassword })}
                onGenerate={() => dispatch({ type: 'GENERATE_PASSWORD', policy: passwordPolicy })}
              />
            ),
          },
        }}
      />
      <TextField
        label={t('documents.privacy.confirmPassword')}
        type={inputType}
        fullWidth
        size="small"
        value={state.confirmPassword}
        onChange={(e) => dispatch({ type: 'SET_CONFIRM_PASSWORD', value: e.target.value })}
        error={mismatch}
        helperText={mismatch ? t('documents.privacy.mismatch') : undefined}
      />
    </Stack>
  );
}
