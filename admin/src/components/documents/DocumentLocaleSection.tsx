import {
  Box,
  Stack,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import type { UseFormRegister, FieldErrors, FieldArrayWithId } from 'react-hook-form';
import type { Locale } from '@/types/api';

interface DocumentLocaleSectionProps {
  activeTab: number;
  onTabChange: (index: number) => void;
  activeLocales: Locale[];
  fields: FieldArrayWithId[];
  register: UseFormRegister<never>;
  errors: FieldErrors;
}

export default function DocumentLocaleSection({
  activeTab,
  onTabChange,
  activeLocales,
  fields,
  register,
  errors,
}: DocumentLocaleSectionProps) {
  if (activeLocales.length === 0) return null;

  const locErrors = (errors as Record<string, unknown>).localizations as Array<Record<string, { message?: string }>> | undefined;

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue: number) => onTabChange(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Locale tabs"
        >
          {activeLocales.map((locale) => (
            <Tab key={locale.id} label={locale.code.toUpperCase()} />
          ))}
        </Tabs>
      </Box>
      {fields.map((field, index) => {
        const locale = activeLocales[index];
        if (!locale) return null;
        return (
          <Box
            key={field.id}
            role="tabpanel"
            hidden={activeTab !== index}
            sx={{ px: 0, py: 2 }}
          >
            {activeTab === index && (
              <Stack spacing={2}>
                <TextField
                  label={`Name (${locale.code})`}
                  fullWidth
                  {...register(`localizations.${index}.name` as never)}
                  error={!!locErrors?.[index]?.name}
                  helperText={locErrors?.[index]?.name?.message}
                />
                <TextField
                  label={`Description (${locale.code})`}
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={4}
                  {...register(`localizations.${index}.description` as never)}
                  error={!!locErrors?.[index]?.description}
                  helperText={locErrors?.[index]?.description?.message}
                />
              </Stack>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
