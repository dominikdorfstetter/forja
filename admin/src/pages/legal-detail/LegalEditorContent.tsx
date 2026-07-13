import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import InlineEditField from '@/components/shared/InlineEditField';
import type { LegalContentFormData } from './legalDetailSchema';

interface LegalEditorContentProps {
  control: Control<LegalContentFormData>;
  onSnapshot: () => void;
  canWrite: boolean;
  siteId: string;
  slug: string;
  slugLocked: boolean;
  onSaveSlug: (slug: string) => Promise<void>;
}

export default function LegalEditorContent({
  control,
  onSnapshot,
  canWrite,
  siteId,
  slug,
  slugLocked,
  onSaveSlug,
}: LegalEditorContentProps) {
  const { t } = useTranslation();
  const [seoExpanded, setSeoExpanded] = useState(false);

  return (
    <Box data-testid="legal-detail.content">
      <Paper sx={{ p: 3, mb: 2 }}>
        <Controller
          name="title"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label={t('legalDetail.fields.title')}
              fullWidth
              required
              disabled={!canWrite}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              sx={{ mb: 2 }}
              data-testid="legal-detail.field-title"
            />
          )}
        />

        <Controller
          name="intro"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('legalDetail.fields.intro')}
              fullWidth
              multiline
              minRows={2}
              disabled={!canWrite}
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              sx={{ mb: 2 }}
              data-testid="legal-detail.field-intro"
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
      </Paper>

      {/* Collapsible SEO section */}
      <Accordion
        expanded={seoExpanded}
        onChange={(_, expanded) => setSeoExpanded(expanded)}
        sx={{ mb: 2 }}
        data-testid="legal-detail.seo-section"
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">{t('legalDetail.seo.title')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Controller
            name="meta_title"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('legalDetail.fields.metaTitle')}
                fullWidth
                disabled={!canWrite}
                error={!!fieldState.error}
                helperText={fieldState.error?.message || `${field.value?.length ?? 0}/60`}
                onBlur={() => { field.onBlur(); onSnapshot(); }}
                sx={{ mb: 2 }}
                data-testid="legal-detail.field-meta-title"
              />
            )}
          />
          <Controller
            name="meta_description"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('legalDetail.fields.metaDescription')}
                fullWidth
                multiline
                minRows={2}
                disabled={!canWrite}
                error={!!fieldState.error}
                helperText={fieldState.error?.message || `${field.value?.length ?? 0}/160`}
                onBlur={() => { field.onBlur(); onSnapshot(); }}
                data-testid="legal-detail.field-meta-description"
              />
            )}
          />
          <Box sx={{ mt: 2 }} data-testid="legal-detail.field-slug">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t('legalDetail.fields.slug')}
              </Typography>
              <InlineEditField
                value={slug}
                variant="body2"
                disabled={!canWrite || slugLocked}
                onSave={onSaveSlug}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {slugLocked ? t('legalDetail.slugLockedHint') : t('legalDetail.slugHint')}
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
