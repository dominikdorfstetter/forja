import {
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import type { SectionType } from '@/types/api';

interface SectionSettingsFormProps {
  sectionType: SectionType;
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
}

export default function SectionSettingsForm({ sectionType, settings, onChange }: SectionSettingsFormProps) {
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
          <Typography variant="subtitle2" color="text.secondary">Hero Settings</Typography>
          <FormControlLabel
            control={<Switch checked={getBool('fullWidth')} onChange={(e) => update('fullWidth', e.target.checked)} />}
            label="Full Width"
          />
          <TextField
            label="Gradient"
            fullWidth
            size="small"
            value={getString('gradient')}
            onChange={(e) => update('gradient', e.target.value)}
            helperText="CSS gradient string"
          />
        </Stack>
      );

    case 'Features':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">Features Settings</Typography>
          <TextField
            select
            label="Columns"
            fullWidth
            size="small"
            value={getNumber('columns', 3)}
            onChange={(e) => update('columns', Number(e.target.value))}
          >
            <MenuItem value={2}>2 columns</MenuItem>
            <MenuItem value={3}>3 columns</MenuItem>
            <MenuItem value={4}>4 columns</MenuItem>
          </TextField>
        </Stack>
      );

    case 'Cta':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">CTA Settings</Typography>
          <TextField
            select
            label="Style"
            fullWidth
            size="small"
            value={getString('style', 'banner')}
            onChange={(e) => update('style', e.target.value)}
          >
            <MenuItem value="banner">Banner</MenuItem>
            <MenuItem value="card">Card</MenuItem>
            <MenuItem value="floating">Floating</MenuItem>
          </TextField>
        </Stack>
      );

    case 'Gallery':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">Gallery Settings</Typography>
          <TextField
            select
            label="Columns"
            fullWidth
            size="small"
            value={getNumber('columns', 3)}
            onChange={(e) => update('columns', Number(e.target.value))}
          >
            <MenuItem value={2}>2 columns</MenuItem>
            <MenuItem value={3}>3 columns</MenuItem>
            <MenuItem value={4}>4 columns</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('showCaptions')} onChange={(e) => update('showCaptions', e.target.checked)} />}
            label="Show Captions"
          />
        </Stack>
      );

    case 'Testimonials':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">Testimonials Settings</Typography>
          <TextField
            select
            label="Layout"
            fullWidth
            size="small"
            value={getString('layout', 'carousel')}
            onChange={(e) => update('layout', e.target.value)}
          >
            <MenuItem value="carousel">Carousel</MenuItem>
            <MenuItem value="grid">Grid</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('showAvatar')} onChange={(e) => update('showAvatar', e.target.checked)} />}
            label="Show Avatar"
          />
        </Stack>
      );

    case 'Pricing':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">Pricing Settings</Typography>
          <TextField
            select
            label="Columns"
            fullWidth
            size="small"
            value={getNumber('columns', 3)}
            onChange={(e) => update('columns', Number(e.target.value))}
          >
            <MenuItem value={2}>2 columns</MenuItem>
            <MenuItem value={3}>3 columns</MenuItem>
            <MenuItem value={4}>4 columns</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={getBool('showToggle')} onChange={(e) => update('showToggle', e.target.checked)} />}
            label="Show Monthly/Yearly Toggle"
          />
        </Stack>
      );

    case 'Faq':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">FAQ Settings</Typography>
          <FormControlLabel
            control={<Switch checked={getBool('accordion', true)} onChange={(e) => update('accordion', e.target.checked)} />}
            label="Accordion (collapsible)"
          />
        </Stack>
      );

    case 'Contact':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">Contact Settings</Typography>
          <FormControlLabel
            control={<Switch checked={getBool('showMap')} onChange={(e) => update('showMap', e.target.checked)} />}
            label="Show Map"
          />
          <TextField
            label="Form Fields"
            fullWidth
            size="small"
            value={getString('formFields', 'name,email,message')}
            onChange={(e) => update('formFields', e.target.value)}
            helperText="Comma-separated field names"
          />
        </Stack>
      );

    case 'Custom':
      return (
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">Custom Settings (JSON)</Typography>
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
            helperText="Raw JSON settings"
          />
        </Stack>
      );

    default:
      return null;
  }
}
