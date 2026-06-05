import {
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SectionType } from '@/types/api';

interface SectionSettingsFormProps {
  sectionType: SectionType;
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
}

// react-doctor-disable-next-line large-component — form renders per-section-type fields; splitting would fragment field definitions
export default function SectionSettingsForm({ sectionType, settings, onChange }: SectionSettingsFormProps) {
  const { t } = useTranslation();

  const update = (key: string, value: unknown) => {
    onChange({ ...settings, [key]: value });
  };

  const getBool = (key: string, fallback = false): boolean => {
    return typeof settings[key] === 'boolean' ? (settings[key] as boolean) : fallback;
  };

  const getString = (key: string, fallback = ''): string => {
    return typeof settings[key] === 'string' ? (settings[key] as string) : fallback;
  };

  const getNumber = (key: string, fallback = 3): number => {
    return typeof settings[key] === 'number' ? (settings[key] as number) : fallback;
  };

  switch (sectionType) {
    case 'Hero':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.hero.title')}</Typography>
          <FormControlLabel
            control={<Switch checked={getBool('fullWidth')} onChange={(e) => update('fullWidth', e.target.checked)} />}
            label={t('sectionEditor.fullWidth')}
          />
          <TextField
            label={t('sectionEditor.settings.hero.gradient')}
            fullWidth
            size="small"
            value={getString('gradient')}
            onChange={(e) => update('gradient', e.target.value)}
            helperText={t('sectionEditor.settings.hero.gradientHint')}
          />
        </Stack>
      );

    case 'Features':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.features.title')}</Typography>
          <TextField
            select
            label={t('sectionEditor.columns')}
            fullWidth
            size="small"
            value={getNumber('columns', 3)}
            onChange={(e) => update('columns', Number(e.target.value))}
          >
            <MenuItem value={2}>{t('sectionEditor.nColumns', { n: 2 })}</MenuItem>
            <MenuItem value={3}>{t('sectionEditor.nColumns', { n: 3 })}</MenuItem>
            <MenuItem value={4}>{t('sectionEditor.nColumns', { n: 4 })}</MenuItem>
          </TextField>
        </Stack>
      );

    case 'Cta':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.cta.title')}</Typography>
          <TextField
            select
            label={t('sectionEditor.style')}
            fullWidth
            size="small"
            value={getString('style', 'banner')}
            onChange={(e) => update('style', e.target.value)}
          >
            <MenuItem value="banner">{t('sectionEditor.settings.cta.banner')}</MenuItem>
            <MenuItem value="card">{t('sectionEditor.settings.cta.card')}</MenuItem>
            <MenuItem value="floating">{t('sectionEditor.settings.cta.floating')}</MenuItem>
          </TextField>
        </Stack>
      );

    case 'Gallery':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.gallery.title')}</Typography>
          <TextField
            select
            label={t('sectionEditor.columns')}
            fullWidth
            size="small"
            value={getNumber('columns', 3)}
            onChange={(e) => update('columns', Number(e.target.value))}
          >
            <MenuItem value={2}>{t('sectionEditor.nColumns', { n: 2 })}</MenuItem>
            <MenuItem value={3}>{t('sectionEditor.nColumns', { n: 3 })}</MenuItem>
            <MenuItem value={4}>{t('sectionEditor.nColumns', { n: 4 })}</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('showCaptions')} onChange={(e) => update('showCaptions', e.target.checked)} />}
            label={t('sectionEditor.settings.gallery.showCaptions')}
          />
        </Stack>
      );

    case 'Testimonials':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.testimonials.title')}</Typography>
          <TextField
            select
            label={t('sectionEditor.layout')}
            fullWidth
            size="small"
            value={getString('layout', 'carousel')}
            onChange={(e) => update('layout', e.target.value)}
          >
            <MenuItem value="carousel">{t('sectionEditor.settings.testimonials.carousel')}</MenuItem>
            <MenuItem value="grid">{t('sectionEditor.settings.testimonials.grid')}</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('showAvatar')} onChange={(e) => update('showAvatar', e.target.checked)} />}
            label={t('sectionEditor.settings.testimonials.showAvatar')}
          />
        </Stack>
      );

    case 'Pricing':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.pricing.title')}</Typography>
          <TextField
            select
            label={t('sectionEditor.columns')}
            fullWidth
            size="small"
            value={getNumber('columns', 3)}
            onChange={(e) => update('columns', Number(e.target.value))}
          >
            <MenuItem value={2}>{t('sectionEditor.nColumns', { n: 2 })}</MenuItem>
            <MenuItem value={3}>{t('sectionEditor.nColumns', { n: 3 })}</MenuItem>
            <MenuItem value={4}>{t('sectionEditor.nColumns', { n: 4 })}</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('showToggle')} onChange={(e) => update('showToggle', e.target.checked)} />}
            label={t('sectionEditor.settings.pricing.showToggle')}
          />
        </Stack>
      );

    case 'Faq':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.faq.title')}</Typography>
          <FormControlLabel
            control={<Switch checked={getBool('accordion', true)} onChange={(e) => update('accordion', e.target.checked)} />}
            label={t('sectionEditor.settings.faq.accordion')}
          />
        </Stack>
      );

    case 'Contact':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.contact.title')}</Typography>
          <FormControlLabel
            control={<Switch checked={getBool('showMap')} onChange={(e) => update('showMap', e.target.checked)} />}
            label={t('sectionEditor.settings.contact.showMap')}
          />
          <TextField
            label={t('sectionEditor.settings.contact.formFields')}
            fullWidth
            size="small"
            value={getString('formFields', 'name,email,message')}
            onChange={(e) => update('formFields', e.target.value)}
            helperText={t('sectionEditor.settings.contact.formFieldsHint')}
          />
        </Stack>
      );

    case 'Custom':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.custom.title')}</Typography>
          <TextField
            multiline
            minRows={4}
            maxRows={12}
            fullWidth
            size="small"
            value={JSON.stringify(settings, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                // Allow intermediate invalid JSON while typing
              }
            }}
            helperText={t('sectionEditor.settings.custom.jsonHint')}
          />
        </Stack>
      );

    case 'Stats':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.stats.title')}</Typography>
          <TextField
            select label={t('sectionEditor.columns')} fullWidth size="small"
            value={getNumber('columns', 3)}
            onChange={(e) => update('columns', Number(e.target.value))}
          >
            <MenuItem value={2}>{t('sectionEditor.nColumns', { n: 2 })}</MenuItem>
            <MenuItem value={3}>{t('sectionEditor.nColumns', { n: 3 })}</MenuItem>
            <MenuItem value={4}>{t('sectionEditor.nColumns', { n: 4 })}</MenuItem>
          </TextField>
          <TextField
            select label={t('sectionEditor.style')} fullWidth size="small"
            value={getString('style', 'card')}
            onChange={(e) => update('style', e.target.value)}
          >
            <MenuItem value="card">{t('sectionEditor.settings.stats.cardStyle')}</MenuItem>
            <MenuItem value="inline">{t('sectionEditor.settings.stats.inlineStyle')}</MenuItem>
          </TextField>
        </Stack>
      );

    case 'Team':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.team.title')}</Typography>
          <TextField
            select label={t('sectionEditor.columns')} fullWidth size="small"
            value={getNumber('columns', 3)}
            onChange={(e) => update('columns', Number(e.target.value))}
          >
            <MenuItem value={2}>{t('sectionEditor.nColumns', { n: 2 })}</MenuItem>
            <MenuItem value={3}>{t('sectionEditor.nColumns', { n: 3 })}</MenuItem>
            <MenuItem value={4}>{t('sectionEditor.nColumns', { n: 4 })}</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('showRole', true)} onChange={(e) => update('showRole', e.target.checked)} />}
            label={t('sectionEditor.settings.team.showRole')}
          />
          <FormControlLabel
            control={<Switch checked={getBool('showBio', true)} onChange={(e) => update('showBio', e.target.checked)} />}
            label={t('sectionEditor.settings.team.showBio')}
          />
        </Stack>
      );

    case 'Timeline':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.timeline.title')}</Typography>
          <TextField
            select label={t('sectionEditor.layout')} fullWidth size="small"
            value={getString('layout', 'vertical')}
            onChange={(e) => update('layout', e.target.value)}
          >
            <MenuItem value="vertical">{t('sectionEditor.settings.timeline.vertical')}</MenuItem>
            <MenuItem value="horizontal">{t('sectionEditor.settings.timeline.horizontal')}</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('showDates', true)} onChange={(e) => update('showDates', e.target.checked)} />}
            label={t('sectionEditor.settings.timeline.showDates')}
          />
        </Stack>
      );

    case 'LogoCloud':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.logoCloud.title')}</Typography>
          <TextField
            select label={t('sectionEditor.columns')} fullWidth size="small"
            value={getNumber('columns', 4)}
            onChange={(e) => update('columns', Number(e.target.value))}
          >
            <MenuItem value={3}>{t('sectionEditor.nColumns', { n: 3 })}</MenuItem>
            <MenuItem value={4}>{t('sectionEditor.nColumns', { n: 4 })}</MenuItem>
            <MenuItem value={5}>{t('sectionEditor.nColumns', { n: 5 })}</MenuItem>
            <MenuItem value={6}>{t('sectionEditor.nColumns', { n: 6 })}</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('grayscale')} onChange={(e) => update('grayscale', e.target.checked)} />}
            label={t('sectionEditor.settings.logoCloud.grayscale')}
          />
        </Stack>
      );

    case 'Newsletter':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.newsletter.title')}</Typography>
          <TextField
            select label={t('sectionEditor.provider')} fullWidth size="small"
            value={getString('provider', 'generic')}
            onChange={(e) => update('provider', e.target.value)}
          >
            <MenuItem value="generic">{t('sectionEditor.settings.newsletter.generic')}</MenuItem>
            <MenuItem value="mailchimp">{t('sectionEditor.settings.newsletter.mailchimp')}</MenuItem>
            <MenuItem value="custom">{t('sectionEditor.settings.newsletter.customProvider')}</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('showName')} onChange={(e) => update('showName', e.target.checked)} />}
            label={t('sectionEditor.settings.newsletter.showName')}
          />
        </Stack>
      );

    case 'Video':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.video.title')}</Typography>
          <TextField
            select label={t('sectionEditor.provider')} fullWidth size="small"
            value={getString('provider', 'youtube')}
            onChange={(e) => update('provider', e.target.value)}
          >
            <MenuItem value="youtube">{t('sectionEditor.settings.video.youtube')}</MenuItem>
            <MenuItem value="vimeo">{t('sectionEditor.settings.video.vimeo')}</MenuItem>
            <MenuItem value="self-hosted">{t('sectionEditor.settings.video.selfHosted')}</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('autoplay')} onChange={(e) => update('autoplay', e.target.checked)} />}
            label={t('sectionEditor.settings.video.autoplay')}
          />
          <TextField
            select label={t('sectionEditor.settings.video.aspectRatio')} fullWidth size="small"
            value={getString('aspectRatio', '16:9')}
            onChange={(e) => update('aspectRatio', e.target.value)}
          >
            <MenuItem value="16:9">16:9</MenuItem>
            <MenuItem value="4:3">4:3</MenuItem>
            <MenuItem value="1:1">1:1</MenuItem>
          </TextField>
        </Stack>
      );

    case 'Divider':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.divider.title')}</Typography>
          <TextField
            select label={t('sectionEditor.style')} fullWidth size="small"
            value={getString('style', 'line')}
            onChange={(e) => update('style', e.target.value)}
          >
            <MenuItem value="line">{t('sectionEditor.settings.divider.line')}</MenuItem>
            <MenuItem value="dots">{t('sectionEditor.settings.divider.dots')}</MenuItem>
            <MenuItem value="space">{t('sectionEditor.settings.divider.space')}</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('label')} onChange={(e) => update('label', e.target.checked)} />}
            label={t('sectionEditor.settings.divider.showLabel')}
          />
        </Stack>
      );

    case 'Text':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">{t('sectionEditor.settings.text.title')}</Typography>
          <TextField
            select label={t('sectionEditor.settings.text.width')} fullWidth size="small"
            value={getString('width', 'default')}
            onChange={(e) => update('width', e.target.value)}
          >
            <MenuItem value="narrow">{t('sectionEditor.settings.text.narrow')}</MenuItem>
            <MenuItem value="default">{t('sectionEditor.settings.text.default')}</MenuItem>
            <MenuItem value="wide">{t('sectionEditor.settings.text.wide')}</MenuItem>
          </TextField>
          <TextField
            select label={t('sectionEditor.settings.text.alignment')} fullWidth size="small"
            value={getString('alignment', 'left')}
            onChange={(e) => update('alignment', e.target.value)}
          >
            <MenuItem value="left">{t('sectionEditor.settings.text.left')}</MenuItem>
            <MenuItem value="center">{t('sectionEditor.settings.text.center')}</MenuItem>
          </TextField>
        </Stack>
      );

    default:
      return null;
  }
}
