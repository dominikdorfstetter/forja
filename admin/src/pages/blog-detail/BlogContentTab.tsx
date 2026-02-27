import { Grid, List, ListItem, ListItemText, Paper, TextField, Typography } from '@mui/material';
import { Controller, type Control, type UseFormGetValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import MDEditor, { commands } from '@uiw/react-md-editor';
import type { BlogContentFormData } from './blogDetailSchema';
import { parseToc } from './blogDetailSchema';

interface BlogContentTabProps {
  control: Control<BlogContentFormData>;
  getValues: UseFormGetValues<BlogContentFormData>;
  onSnapshot: () => void;
}

export default function BlogContentTab({ control, getValues, onSnapshot }: BlogContentTabProps) {
  const { t } = useTranslation();
  const body = getValues('body');
  const tocItems = parseToc(body);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={tocItems.length > 0 ? 9 : 12}>
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

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('blogDetail.fields.body')}
        </Typography>
        <Controller
          name="body"
          control={control}
          render={({ field }) => (
            <div data-color-mode="light">
              <MDEditor
                value={field.value}
                onChange={(val) => field.onChange(val || '')}
                onBlur={() => { field.onBlur(); onSnapshot(); }}
                height={500}
                commands={[
                  commands.bold, commands.italic, commands.strikethrough,
                  commands.divider,
                  commands.heading, commands.quote, commands.link, commands.image,
                  commands.divider,
                  commands.unorderedListCommand, commands.orderedListCommand, commands.checkedListCommand,
                  commands.divider,
                  commands.code, commands.codeBlock,
                  commands.divider,
                  commands.table, commands.hr,
                ]}
                extraCommands={[
                  commands.codeEdit, commands.codeLive, commands.codePreview,
                  commands.divider,
                  commands.fullscreen,
                ]}
              />
            </div>
          )}
        />
      </Grid>

      {tocItems.length > 0 && (
        <Grid item xs={12} md={3}>
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
