import {
  Grid,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import { Controller, type Control, type UseFormWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { PageResponse } from '@/types/api';
import type { PageDetailFormData } from './pageDetailSchema';

interface PageInfoTabProps {
  control: Control<PageDetailFormData>;
  watch: UseFormWatch<PageDetailFormData>;
  page: PageResponse;
  onSnapshot: () => void;
}

const PAGE_TYPES = ['Static', 'Landing', 'Contact', 'BlogIndex', 'Custom'] as const;

export default function PageInfoTab({ control, watch, page, onSnapshot }: PageInfoTabProps) {
  const { t } = useTranslation();
  const isInNavigation = watch('is_in_navigation');

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="route"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('pageDetail.fields.route')}
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                onBlur={() => { field.onBlur(); onSnapshot(); }}
                InputProps={{ sx: { fontFamily: 'monospace' } }}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="slug"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('pageDetail.fields.slug')}
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                onBlur={() => { field.onBlur(); onSnapshot(); }}
                InputProps={{ sx: { fontFamily: 'monospace' } }}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="page_type"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label={t('pageDetail.fields.pageType')}
                fullWidth
                onBlur={onSnapshot}
              >
                {PAGE_TYPES.map((pt) => (
                  <MenuItem key={pt} value={pt}>{pt}</MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="template"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                label={t('pageDetail.template')}
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                onBlur={() => { field.onBlur(); onSnapshot(); }}
              />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="is_in_navigation"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(e) => { field.onChange(e.target.checked); onSnapshot(); }}
                  />
                }
                label={t('pageDetail.fields.inNavigation')}
              />
            )}
          />
        </Grid>
        {isInNavigation && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="navigation_order"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label={t('pageDetail.fields.navOrder')}
                  type="number"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  onBlur={() => { field.onBlur(); onSnapshot(); }}
                />
              )}
            />
          </Grid>
        )}

        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            name="parent_page_id"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                label={t('pageDetail.parentPageId')}
                fullWidth
                onBlur={onSnapshot}
                InputProps={{ sx: { fontFamily: 'monospace' } }}
              />
            )}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {t('pageDetail.metadata')}
      </Typography>
      <Grid container spacing={1}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">{t('pageDetail.fields.id')}</Typography>
          <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
            {page.id}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">{t('pageDetail.contentId')}</Typography>
          <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
            {page.content_id}
          </Typography>
        </Grid>
        {page.published_at && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">{t('pageDetail.fields.published')}</Typography>
            <Typography variant="body2">{format(new Date(page.published_at), 'PPpp')}</Typography>
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">{t('pageDetail.fields.created')}</Typography>
          <Typography variant="body2">{format(new Date(page.created_at), 'PPpp')}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant="caption" color="text.secondary">{t('pageDetail.fields.updated')}</Typography>
          <Typography variant="body2">{format(new Date(page.updated_at), 'PPpp')}</Typography>
        </Grid>
      </Grid>
    </Box>
  );
}
