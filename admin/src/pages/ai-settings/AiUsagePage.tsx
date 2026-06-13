import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Alert,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

import { exportAiUsageCsv, getAiUsage } from '@/services/ai';
import { useSiteContext } from '@/store/SiteContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import { SectionHead } from '@/components/design-system';
import type { AiUsageGroupBy } from '@/types/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Available filter values for `action`. Mirrors backend `AiAction` serde names.
 * Hardcoded so the dropdown is stable even when zero rows exist yet.
 */
const ACTION_OPTIONS = [
  'seo',
  'excerpt',
  'translate',
  'draft_outline',
  'draft_post',
  'auto_tag',
  'alt_text',
  'image_caption',
  'image_title',
  'section_content',
] as const;

const GROUP_BY_OPTIONS: AiUsageGroupBy[] = ['action', 'provider', 'user'];

function defaultFromIso(): string {
  // Default: first day of the current month (UTC) — matches "current month" in the issue.
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function isoToDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function dateInputToIso(date: string, endOfDay: boolean): string {
  // YYYY-MM-DD → ISO at start or end of UTC day
  const parts = date.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date().toISOString();
  const [y, m, d] = parts;
  const ms = endOfDay
    ? Date.UTC(y, m - 1, d, 23, 59, 59, 999)
    : Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  return new Date(ms).toISOString();
}

function triggerCsvDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AiUsagePage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { context } = useSiteContextData();
  const { showError } = useErrorSnackbar();

  const role = context.current_user_role;
  const canExport = role === 'owner' || role === 'admin';

  const [fromIso, setFromIso] = useState<string>(() => defaultFromIso());
  const [toIso, setToIso] = useState<string>(() => new Date().toISOString());
  const [actionFilter, setActionFilter] = useState<string>('');
  const [groupBy, setGroupBy] = useState<AiUsageGroupBy>('action');
  const [exporting, setExporting] = useState(false);

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: queryKeys.aiUsage(selectedSiteId, fromIso, toIso, actionFilter, groupBy),
    queryFn: () =>
      getAiUsage(selectedSiteId, {
        from: fromIso,
        to: toIso,
        action: actionFilter || undefined,
        groupBy,
      }),
    enabled: !!selectedSiteId,
  });

  const totals = useMemo(() => {
    const buckets = usageData?.buckets ?? [];
    return buckets.reduce(
      (acc, b) => ({
        calls: acc.calls + b.call_count,
        input: acc.input + (b.input_tokens ?? 0),
        output: acc.output + (b.output_tokens ?? 0),
      }),
      { calls: 0, input: 0, output: 0 },
    );
  }, [usageData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await exportAiUsageCsv(selectedSiteId, {
        from: fromIso,
        to: toIso,
        action: actionFilter || undefined,
      });
      triggerCsvDownload(csv, `ai-usage-${isoToDateInput(fromIso)}-to-${isoToDateInput(toIso)}.csv`);
    } catch (err) {
      showError(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box data-testid="ai-usage.page">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2 }}>
        <SectionHead title={t('aiUsage.title')} subtitle={t('aiUsage.subtitle')} />
        {canExport && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={exporting || !usageData}
            data-testid="ai-usage.btn.export"
          >
            {exporting ? t('aiUsage.exporting') : t('aiUsage.export')}
          </Button>
        )}
      </Box>

      {usageData?.own_only && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="ai-usage.alert.own-only">
          {t('aiUsage.ownOnlyNotice')}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            alignItems: { md: 'flex-end' },
            flexWrap: 'wrap',
          }}
        >
          <TextField
            label={t('aiUsage.filters.from')}
            type="date"
            size="small"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { 'data-testid': 'ai-usage.filter.from' },
            }}
            value={isoToDateInput(fromIso)}
            onChange={(e) => setFromIso(dateInputToIso(e.target.value, false))}
          />
          <TextField
            label={t('aiUsage.filters.to')}
            type="date"
            size="small"
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { 'data-testid': 'ai-usage.filter.to' },
            }}
            value={isoToDateInput(toIso)}
            onChange={(e) => setToIso(dateInputToIso(e.target.value, true))}
          />
          <TextField
            select
            label={t('aiUsage.filters.action')}
            size="small"
            sx={{ minWidth: 180 }}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            slotProps={{ htmlInput: { 'data-testid': 'ai-usage.filter.action' } }}
          >
            <MenuItem value="">{t('aiUsage.filters.allActions')}</MenuItem>
            {ACTION_OPTIONS.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={groupBy}
            onChange={(_, next) => next && setGroupBy(next)}
            aria-label={t('aiUsage.filters.groupBy')}
          >
            {GROUP_BY_OPTIONS.map((g) => (
              <ToggleButton key={g} value={g} data-testid={`ai-usage.group.${g}`}>
                {t(`aiUsage.groupBy.${g}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('aiUsage.totals.calls')}
          </Typography>
          <Typography variant="h5">{totals.calls.toLocaleString()}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('aiUsage.totals.inputTokens')}
          </Typography>
          <Typography variant="h5">{totals.input.toLocaleString()}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('aiUsage.totals.outputTokens')}
          </Typography>
          <Typography variant="h5">{totals.output.toLocaleString()}</Typography>
        </Paper>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small" aria-label={t('aiUsage.byGroup.title', { group: groupBy })}>
          <TableHead>
            <TableRow>
              <TableCell>{t(`aiUsage.groupBy.${groupBy}`)}</TableCell>
              <TableCell align="right">{t('aiUsage.columns.calls')}</TableCell>
              <TableCell align="right">{t('aiUsage.columns.inputTokens')}</TableCell>
              <TableCell align="right">{t('aiUsage.columns.outputTokens')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usageData?.buckets.length === 0 && !usageLoading && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    {t('aiUsage.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {usageData?.buckets.map((b) => (
              <TableRow key={b.key} data-testid={`ai-usage.bucket.${b.key}`}>
                <TableCell>{b.key}</TableCell>
                <TableCell align="right">{b.call_count.toLocaleString()}</TableCell>
                <TableCell align="right">{(b.input_tokens ?? 0).toLocaleString()}</TableCell>
                <TableCell align="right">{(b.output_tokens ?? 0).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <SectionHead title={t('aiUsage.recentCalls')} />
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={t('aiUsage.recentCalls')}>
          <TableHead>
            <TableRow>
              <TableCell>{t('aiUsage.columns.timestamp')}</TableCell>
              <TableCell>{t('aiUsage.columns.action')}</TableCell>
              <TableCell>{t('aiUsage.columns.provider')}</TableCell>
              <TableCell>{t('aiUsage.columns.model')}</TableCell>
              <TableCell align="right">{t('aiUsage.columns.inputTokens')}</TableCell>
              <TableCell align="right">{t('aiUsage.columns.outputTokens')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usageData?.items.length === 0 && !usageLoading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    {t('aiUsage.empty')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {usageData?.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                <TableCell>{item.action}</TableCell>
                <TableCell>{item.provider}</TableCell>
                <TableCell>{item.model}</TableCell>
                <TableCell align="right">{(item.input_tokens ?? 0).toLocaleString()}</TableCell>
                <TableCell align="right">{(item.output_tokens ?? 0).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
