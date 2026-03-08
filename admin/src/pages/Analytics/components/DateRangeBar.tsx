import { useRef, useState } from 'react';
import { Chip, Popover, Stack, Button, Box } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { useTranslation } from 'react-i18next';

export type DatePreset = '7d' | '30d' | '90d' | 'all';

export interface DateRangeValue {
  preset?: DatePreset;
  startDate?: Date;
  endDate?: Date;
}

export function presetToDays(preset: DatePreset): number | undefined {
  switch (preset) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case 'all': return 365;
  }
}

const PRESETS: { value: DatePreset; labelKey: string }[] = [
  { value: '7d', labelKey: 'analytics.dateRange.7days' },
  { value: '30d', labelKey: 'analytics.dateRange.30days' },
  { value: '90d', labelKey: 'analytics.dateRange.90days' },
  { value: 'all', labelKey: 'analytics.dateRange.allTime' },
];

interface DateRangeBarProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

export default function DateRangeBar({ value, onChange }: DateRangeBarProps) {
  const { t } = useTranslation();
  const customRef = useRef<HTMLDivElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(
    value.startDate ?? null,
  );
  const [endDate, setEndDate] = useState<Date | null>(
    value.endDate ?? null,
  );

  const isCustom = !value.preset && (value.startDate || value.endDate);

  const handleApply = () => {
    if (startDate && endDate) {
      onChange({ startDate, endDate });
    }
    setAnchorEl(null);
  };

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {PRESETS.map(({ value: preset, labelKey }) => (
        <Chip
          key={preset}
          label={t(labelKey)}
          aria-pressed={value.preset === preset}
          onClick={() => onChange({ preset })}
          variant={value.preset === preset ? 'filled' : 'outlined'}
          color={value.preset === preset ? 'primary' : 'default'}
        />
      ))}
      <Chip
        ref={customRef}
        label={t('analytics.dateRange.custom')}
        aria-pressed={!!isCustom}
        onClick={() => setAnchorEl(customRef.current)}
        variant={isCustom ? 'filled' : 'outlined'}
        color={isCustom ? 'primary' : 'default'}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DatePicker
            label={t('analytics.dateRange.start')}
            value={startDate}
            onChange={setStartDate}
            slotProps={{ textField: { size: 'small' } }}
          />
          <DatePicker
            label={t('analytics.dateRange.end')}
            value={endDate}
            onChange={setEndDate}
            slotProps={{ textField: { size: 'small' } }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleApply}
            disabled={!startDate || !endDate}
          >
            {t('analytics.dateRange.apply')}
          </Button>
        </Box>
      </Popover>
    </Stack>
  );
}
