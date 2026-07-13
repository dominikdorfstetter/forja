import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Card,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import MediaPickerDialog from '@/components/media/MediaPickerDialog';
import type { SectionType } from '@/types/api';

interface ItemField {
  key: string;
  labelKey: string;
  type: 'text' | 'media';
  multiline?: boolean;
  placeholder?: string;
}

const SECTION_ITEM_FIELDS: Partial<Record<SectionType, { labelKey: string; fields: ItemField[] }>> = {
  Features: {
    labelKey: 'sectionEditor.items.feature.label',
    fields: [
      { key: 'title', labelKey: 'sectionEditor.items.feature.title', type: 'text' },
      { key: 'text', labelKey: 'sectionEditor.items.feature.description', type: 'text', multiline: true },
      { key: 'icon', labelKey: 'sectionEditor.items.feature.icon', type: 'text', placeholder: '⚡' },
    ],
  },
  Gallery: {
    labelKey: 'sectionEditor.items.gallery.label',
    fields: [
      { key: 'mediaId', labelKey: 'sectionEditor.items.gallery.image', type: 'media' },
      { key: 'alt', labelKey: 'sectionEditor.items.gallery.alt', type: 'text' },
      { key: 'caption', labelKey: 'sectionEditor.items.gallery.caption', type: 'text' },
    ],
  },
  Testimonials: {
    labelKey: 'sectionEditor.items.testimonial.label',
    fields: [
      { key: 'quote', labelKey: 'sectionEditor.items.testimonial.quote', type: 'text', multiline: true },
      { key: 'author', labelKey: 'sectionEditor.items.testimonial.author', type: 'text' },
      { key: 'role', labelKey: 'sectionEditor.items.testimonial.role', type: 'text' },
      { key: 'avatarMediaId', labelKey: 'sectionEditor.items.testimonial.avatar', type: 'media' },
    ],
  },
  Pricing: {
    labelKey: 'sectionEditor.items.pricing.label',
    fields: [
      { key: 'name', labelKey: 'sectionEditor.items.pricing.planName', type: 'text' },
      { key: 'price', labelKey: 'sectionEditor.items.pricing.price', type: 'text', placeholder: '$29' },
      { key: 'period', labelKey: 'sectionEditor.items.pricing.period', type: 'text', placeholder: '/month' },
      { key: 'description', labelKey: 'sectionEditor.items.pricing.description', type: 'text' },
      { key: 'features', labelKey: 'sectionEditor.items.pricing.features', type: 'text', multiline: true },
      { key: 'buttonText', labelKey: 'sectionEditor.items.pricing.buttonText', type: 'text' },
      { key: 'buttonHref', labelKey: 'sectionEditor.items.pricing.buttonHref', type: 'text' },
    ],
  },
  Faq: {
    labelKey: 'sectionEditor.items.faq.label',
    fields: [
      { key: 'question', labelKey: 'sectionEditor.items.faq.question', type: 'text' },
      { key: 'answer', labelKey: 'sectionEditor.items.faq.answer', type: 'text', multiline: true },
    ],
  },
  Stats: {
    labelKey: 'sectionEditor.items.stat.label',
    fields: [
      { key: 'value', labelKey: 'sectionEditor.items.stat.value', type: 'text', placeholder: '10,000+' },
      { key: 'label', labelKey: 'sectionEditor.items.stat.statLabel', type: 'text', placeholder: 'Active users' },
    ],
  },
  Team: {
    labelKey: 'sectionEditor.items.team.label',
    fields: [
      { key: 'name', labelKey: 'sectionEditor.items.team.name', type: 'text' },
      { key: 'role', labelKey: 'sectionEditor.items.team.role', type: 'text' },
      { key: 'bio', labelKey: 'sectionEditor.items.team.bio', type: 'text', multiline: true },
      { key: 'photoMediaId', labelKey: 'sectionEditor.items.team.photo', type: 'media' },
    ],
  },
  Timeline: {
    labelKey: 'sectionEditor.items.timeline.label',
    fields: [
      { key: 'date', labelKey: 'sectionEditor.items.timeline.date', type: 'text', placeholder: '2024-01' },
      { key: 'title', labelKey: 'sectionEditor.items.timeline.title', type: 'text' },
      { key: 'text', labelKey: 'sectionEditor.items.timeline.description', type: 'text', multiline: true },
    ],
  },
  LogoCloud: {
    labelKey: 'sectionEditor.items.logoCloud.label',
    fields: [
      { key: 'logoMediaId', labelKey: 'sectionEditor.items.logoCloud.logo', type: 'media' },
      { key: 'alt', labelKey: 'sectionEditor.items.logoCloud.companyName', type: 'text' },
      { key: 'href', labelKey: 'sectionEditor.items.logoCloud.link', type: 'text' },
    ],
  },
};

/** Inline media preview with picker button */
function MediaField({ mediaId, label, onSelect }: { mediaId: string | undefined; label: string; onSelect: (id: string | null) => void }) {
  const { selectedSiteId } = useSiteContext();
  const imageUrl = useMediaUrl(mediaId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>{label}</Typography>
      {mediaId && imageUrl ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Card variant="outlined" sx={{ width: 64, height: 64, overflow: 'hidden', flexShrink: 0 }}>
            <Box component="img" src={imageUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Card>
          <Stack spacing={0.5}>
            <Button size="small" variant="outlined" onClick={() => setPickerOpen(true)}>{t('blogDetail.images.changeImage')}</Button>
            <Button size="small" color="error" onClick={() => onSelect(null)}>{t('blogDetail.images.removeImage')}</Button>
          </Stack>
        </Box>
      ) : (
        <Card
          variant="outlined"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56, cursor: 'pointer', bgcolor: 'action.hover' }}
          onClick={() => setPickerOpen(true)}
        >
          <Stack spacing={0.5} direction="row" sx={{ alignItems: "center" }}>
            <ImageIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary">{t('blogDetail.images.selectImage')}</Typography>
          </Stack>
        </Card>
      )}
      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        siteId={selectedSiteId}
        currentValue={mediaId || null}
        onSelect={(id) => { onSelect(id); setPickerOpen(false); }}
      />
    </Box>
  );
}

interface SectionItemsEditorProps {
  sectionType: SectionType;
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
  /** Render the items as a non-editable preview (no add/move/delete). */
  readOnly?: boolean;
}

export default function SectionItemsEditor({ sectionType, items, onChange, readOnly }: SectionItemsEditorProps) {
  const { t } = useTranslation();
  const config = SECTION_ITEM_FIELDS[sectionType];

  const addItem = useCallback(() => {
    const empty: Record<string, unknown> = {};
    config?.fields.forEach((f) => { empty[f.key] = ''; });
    onChange([...items, empty]);
  }, [items, onChange, config]);

  const updateItem = useCallback((index: number, key: string, value: unknown) => {
    const updated = items.map((item, i) => i === index ? { ...item, [key]: value } : item);
    onChange(updated);
  }, [items, onChange]);

  const removeItem = useCallback((index: number) => {
    onChange(items.filter((_, i) => i !== index));
  }, [items, onChange]);

  const moveItem = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const updated = [...items];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  }, [items, onChange]);

  if (!config) return null;

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {t('sectionEditor.items.count', { label: t(config.labelKey), count: items.length })}
      </Typography>
      <Stack spacing={2}>
        {items.map((item, index) => (
          <Box
            // Items are fully controlled inputs without stable IDs; reorder
            // via moveItem swaps values in-place so index keys are accurate.
            // react-doctor-disable-next-line react-doctor/no-array-index-as-key
            key={index}
            sx={{
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.default',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {t('sectionEditor.items.itemNumber', { label: t(config.labelKey), number: index + 1 })}
              </Typography>
              {!readOnly && <Box>
                <Tooltip title={t('common.actions.moveUp', 'Move up')}>
                  <span>
                    <IconButton size="small" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                      <KeyboardArrowUpIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('common.actions.moveDown', 'Move down')}>
                  <span>
                    <IconButton size="small" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}>
                      <KeyboardArrowDownIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('common.actions.delete')}>
                  <IconButton size="small" color="error" onClick={() => removeItem(index)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>}
            </Box>
            <Stack spacing={1.5}>
              {config.fields.map((field) => {
                if (field.type === 'media') {
                  if (readOnly) return null;
                  return (
                    <MediaField
                      key={field.key}
                      label={t(field.labelKey)}
                      mediaId={(item[field.key] as string) || undefined}
                      onSelect={(id) => updateItem(index, field.key, id || '')}
                    />
                  );
                }

                // Special handling for pricing features (newline-separated list)
                const value = field.key === 'features' && Array.isArray(item[field.key])
                  ? (item[field.key] as string[]).join('\n')
                  : (item[field.key] as string) || '';

                return (
                  <TextField
                    key={field.key}
                    label={t(field.labelKey)}
                    size="small"
                    fullWidth
                    disabled={readOnly}
                    multiline={field.multiline}
                    minRows={field.multiline ? 2 : undefined}
                    maxRows={field.multiline ? 6 : undefined}
                    placeholder={field.placeholder}
                    value={value}
                    onChange={(e) => {
                      const newValue = field.key === 'features'
                        ? e.target.value.split('\n')
                        : e.target.value;
                      updateItem(index, field.key, newValue);
                    }}
                  />
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
      {!readOnly && (
        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={addItem}
          sx={{ mt: 1 }}
        >
          {t('common.actions.add')} {t(config.labelKey)}
        </Button>
      )}
    </Box>
  );
}

/** Check if a section type supports structured items */
export function hasItemsEditor(sectionType: SectionType): boolean {
  return sectionType in SECTION_ITEM_FIELDS;
}
