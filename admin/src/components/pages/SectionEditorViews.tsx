import { Box, Button, Chip, Divider, Grid, IconButton, Stack, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import type { PageSectionResponse } from '@/types/api';
import SectionSettingsForm from './SectionSettingsForm';
import {
  SectionCoverImageField,
  SectionEditorOverlays,
  SectionItemsBlock,
  SectionLocalizedContent,
} from './SectionEditorFields';
import type { SectionEditorModel } from './useSectionEditor';

interface SectionEditorViewProps {
  section: PageSectionResponse;
  editor: SectionEditorModel;
}

function SectionTypeChip({ section }: { section: PageSectionResponse }) {
  const { t } = useTranslation();
  return <Chip label={t(`sectionEditor.typeNames.${section.section_type}`)} size="small" color="primary" variant="outlined" />;
}

/** Embedded layout: editor content without the Dialog wrapper (for use inside a Drawer). */
export function SectionEditorPanel({ section, editor }: SectionEditorViewProps) {
  const { t } = useTranslation();
  const { state, dispatch, isSaving } = editor;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }} data-testid="section-editor.panel">
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">{t('forms.section.title')}</Typography>
          <SectionTypeChip section={section} />
        </Box>
        <IconButton onClick={editor.handleClose} aria-label={t('common.actions.close')}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 3 }, py: 3 }}>
        <SectionLocalizedContent editor={editor} editorHeight={200} />
        <Divider sx={{ my: 2 }} />
        <SectionSettingsForm sectionType={section.section_type} settings={state.settings} onChange={(s) => dispatch({ type: 'SET_SETTINGS', value: s })} />
        <SectionItemsBlock editor={editor} section={section} dividerSx={{ my: 2 }} />
      </Box>
      <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: 1, borderColor: 'divider' }}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={editor.handleSave} disabled={isSaving}>
          {isSaving ? t('common.actions.saving') : t('common.actions.save')}
        </Button>
      </Box>
      <SectionEditorOverlays editor={editor} />
    </Box>
  );
}

/** Standalone layout: localized content beside the section configuration, in a dialog. */
export function SectionEditorModal({ open, section, editor }: SectionEditorViewProps & { open: boolean }) {
  const { t } = useTranslation();
  const { state, dispatch, isSaving } = editor;

  return (
    <FormDialog
      open={open}
      onClose={editor.handleClose}
      icon="view_quilt"
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {t('forms.section.title')}
          <SectionTypeChip section={section} />
        </Box>
      }
      maxWidth="lg"
      data-testid="section-editor.dialog"
      actions={
        <>
          <M3Button variant="ghost" size="sm" onClick={editor.handleClose} disabled={isSaving} data-testid="section-editor.btn.close">
            {t('common.actions.close')}
          </M3Button>
          <Box sx={{ flex: 1 }} />
          <M3Button
            variant="filled"
            size="sm"
            icon="save"
            onClick={editor.handleSave}
            disabled={isSaving}
            data-testid="section-editor.btn.submit"
          >
            {isSaving ? t('common.actions.saving') : t('common.actions.save')}
          </M3Button>
        </>
      }
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>{t('forms.section.localizedContent')}</Typography>
          <SectionLocalizedContent editor={editor} editorHeight={250} showTabStatus />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>{t('forms.section.sectionConfiguration')}</Typography>
          <Stack spacing={2}>
            <SectionCoverImageField editor={editor} />
            <TextField label={t('forms.section.fields.ctaRoute')} fullWidth size="small" value={state.ctaRoute} onChange={(e) => dispatch({ type: 'SET_CTA_ROUTE', value: e.target.value })} helperText={t('forms.section.fields.ctaHelperText')} />
            <Divider />
            <SectionSettingsForm sectionType={section.section_type} settings={state.settings} onChange={(val) => dispatch({ type: 'SET_SETTINGS', value: val })} />
            <SectionItemsBlock editor={editor} section={section} />
          </Stack>
        </Grid>
      </Grid>
      <SectionEditorOverlays editor={editor} />
    </FormDialog>
  );
}
