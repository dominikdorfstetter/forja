import { Grid, List, ListItem, ListItemText, Paper, TextField, Typography } from '@mui/material';
import { Controller, type Control, type UseFormGetValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import type { BlogContentFormData } from './blogDetailSchema';
import { parseToc } from './blogDetailSchema';

interface BlogContentTabProps {
  control: Control<BlogContentFormData>;
  getValues: UseFormGetValues<BlogContentFormData>;
  onSnapshot: () => void;
  siteId?: string;
}

export default function BlogContentTab({ control, getValues, onSnapshot, siteId }: BlogContentTabProps) {
  const { t } = useTranslation();
  const body = getValues('body');
  const tocItems = parseToc(body);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: tocItems.length > 0 ? 9 : 12 }}>
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('blogDetail.fields.title')}
              fullWidth
              required
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              sx={{ mb: 2 }}
            />
          )}
        />

        <Controller
          name="subtitle"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('blogDetail.fields.subtitle')}
              fullWidth
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              sx={{ mb: 2 }}
            />
          )}
        />

        <Controller
          name="excerpt"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('blogDetail.fields.excerpt')}
              fullWidth
              multiline
              rows={2}
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              sx={{ mb: 2 }}
            />
          )}
        />

        <Controller
          name="body"
          control={control}
          render={({ field }) => (
            <ForjaEditor
              value={field.value}
              onChange={(val) => field.onChange(val)}
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              height={500}
              placeholder={t('editor.placeholder')}
              siteId={siteId}
            />
          )}
        />
      </Grid>

      {tocItems.length > 0 && (
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper sx={{ p: 2, position: 'sticky', top: 140 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('blogDetail.toc')}
            </Typography>
            <List dense>
              {tocItems.map((item, idx) => (
                <ListItem key={idx} sx={{ pl: (item.level - 1) * 2 }}>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: item.level === 1 ? 600 : 400,
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      )}
    </Grid>
  );
}
