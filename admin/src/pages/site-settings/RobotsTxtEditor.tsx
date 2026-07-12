import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Box, IconButton, TextField, Select, MenuItem, Tooltip, Alert, Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { updateSiteSettings } from '@/services/sites';
import { useSiteContext } from '@/store/SiteContext';
import type { RobotsTxtRule, RobotsTxtDirective, SiteSettingsResponse } from '@/types/api';
import {
  CardGroup,
  SettingsCard,
  M3Button,
} from '@/components/design-system';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { queryKeys } from '@/lib/queryKeys';

interface RuleWithId extends RobotsTxtRule {
  _id: number;
}

const DEFAULT_RULES: RobotsTxtRule[] = [
  { user_agent: '*', rules: [{ directive: 'Allow', path: '/' }] },
];

const PREDEFINED_TEMPLATES = [
  {
    label: 'Block AI Crawlers',
    description: 'Prevent AI training bots from crawling your site',
    blocks: [
      { user_agent: 'GPTBot', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'ChatGPT-User', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'CCBot', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'anthropic-ai', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'Google-Extended', rules: [{ directive: 'Disallow', path: '/' }] },
    ],
  },
  {
    label: 'Block Common Scrapers',
    description: 'Block known scraper and archival bots',
    blocks: [
      { user_agent: 'AhrefsBot', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'SemrushBot', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'MJ12bot', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'DotBot', rules: [{ directive: 'Disallow', path: '/' }] },
    ],
  },
  {
    label: 'Privacy-Focused Default',
    description: 'Allow search engines, block AI and scrapers',
    blocks: [
      { user_agent: '*', rules: [{ directive: 'Allow', path: '/' }] },
      { user_agent: 'GPTBot', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'ChatGPT-User', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'CCBot', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'anthropic-ai', rules: [{ directive: 'Disallow', path: '/' }] },
      { user_agent: 'Google-Extended', rules: [{ directive: 'Disallow', path: '/' }] },
    ],
  },
] as const;

function renderPreview(rules: RobotsTxtRule[], baseUrl?: string | null): string {
  let output = '';
  for (let i = 0; i < rules.length; i++) {
    if (i > 0) output += '\n';
    output += `User-agent: ${rules[i].user_agent}\n`;
    for (const d of rules[i].rules) {
      output += `${d.directive}: ${d.path}\n`;
    }
  }
  if (baseUrl) {
    const url = baseUrl.replace(/\/+$/, '');
    if (output) output += '\n';
    output += `Sitemap: ${url}/sitemap.xml\n`;
  }
  return output;
}

interface RobotsTxtEditorProps {
  settings: SiteSettingsResponse | undefined;
  baseUrl?: string | null;
}

export default function RobotsTxtEditor({ settings, baseUrl }: RobotsTxtEditorProps) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const idCounter = useRef(0);
  const [rules, setRules] = useState<RuleWithId[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const prevSettingsRef = useRef<typeof settings>(undefined);
  useEffect(() => {
    if (settings && settings !== prevSettingsRef.current) {
      prevSettingsRef.current = settings;
      setRules(
        (settings.robots_txt_rules ?? DEFAULT_RULES).map((r) => ({
          ...r,
          _id: idCounter.current++,
        })),
      );
      setIsDirty(false);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: { robots_txt_rules: RobotsTxtRule[] }) =>
      updateSiteSettings(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings(selectedSiteId) });
      setIsDirty(false);
      enqueueSnackbar(t('settings.robotsTxt.saved'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('settings.robotsTxt.saveFailed'), { variant: 'error' });
    },
  });

  const handleSave = useCallback(() => {
    const cleaned: RobotsTxtRule[] = rules.map(({ user_agent, rules: directives }) => ({
      user_agent,
      rules: directives,
    }));
    mutation.mutate({ robots_txt_rules: cleaned });
  }, [rules, mutation]);

  const addBlock = useCallback(() => {
    const id = idCounter.current++;
    setRules((prev) => [
      ...prev,
      { _id: id, user_agent: '', rules: [{ directive: 'Allow', path: '/' }] },
    ]);
    setIsDirty(true);
  }, []);

  const removeBlock = useCallback((blockId: number) => {
    setRules((prev) => prev.filter((r) => r._id !== blockId));
    setIsDirty(true);
  }, []);

  const updateUserAgent = useCallback((blockId: number, value: string) => {
    setRules((prev) =>
      prev.map((r) => (r._id === blockId ? { ...r, user_agent: value } : r)),
    );
    setIsDirty(true);
  }, []);

  const addDirective = useCallback((blockId: number) => {
    setRules((prev) =>
      prev.map((r) =>
        r._id === blockId
          ? { ...r, rules: [...r.rules, { directive: 'Allow', path: '/' }] }
          : r,
      ),
    );
    setIsDirty(true);
  }, []);

  const removeDirective = useCallback((blockId: number, dirIdx: number) => {
    setRules((prev) =>
      prev.map((r) =>
        r._id === blockId
          ? { ...r, rules: r.rules.filter((_, i) => i !== dirIdx) }
          : r,
      ),
    );
    setIsDirty(true);
  }, []);

  const updateDirective = useCallback(
    (blockId: number, dirIdx: number, field: keyof RobotsTxtDirective, value: string) => {
      setRules((prev) =>
        prev.map((r) =>
          r._id === blockId
            ? {
                ...r,
                rules: r.rules.map((d, i) =>
                  i === dirIdx ? { ...d, [field]: value } : d,
                ),
              }
            : r,
        ),
      );
      setIsDirty(true);
    },
    [],
  );

  const appendTemplateBlocks = useCallback(
    (blocks: ReadonlyArray<{ user_agent: string; rules: ReadonlyArray<{ directive: string; path: string }> }>) => {
      const newBlocks: RuleWithId[] = blocks.map((b) => ({
        _id: idCounter.current++,
        user_agent: b.user_agent,
        rules: b.rules.map((r) => ({ directive: r.directive, path: r.path })),
      }));
      setRules((prev) => [...prev, ...newBlocks]);
      setIsDirty(true);
    },
    [],
  );

  const preview = useMemo(() => renderPreview(rules, baseUrl), [rules, baseUrl]);

  // Discard restores the server-known rules and clears the dirty flag;
  // `resetDefaults` is a separate in-card action that loads the factory
  // default rule set.
  const discardChanges = useCallback(() => {
    setRules(
      (settings?.robots_txt_rules ?? DEFAULT_RULES).map((r) => ({
        ...r,
        _id: idCounter.current++,
      })),
    );
    setIsDirty(false);
  }, [settings]);

  useFormSaveBar({
    id: 'site-settings.seo.robots',
    isDirty: isDirty,
    saving: mutation.isPending,
    onSave: handleSave,
    onDiscard: discardChanges,
    saveTestId: 'site-settings.seo.save',
    discardTestId: 'site-settings.seo.reset-defaults',
  });

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' },
        gap: 3,
        alignItems: 'start',
      }}
    >
      <CardGroup label={t('settings.robotsTxt.title')}>
        <SettingsCard>
          <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
            {t('settings.robotsTxt.description')}
          </div>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
              {t('settings.robotsTxt.quickAdd')}
            </span>
            {PREDEFINED_TEMPLATES.map((template) => (
              <Tooltip key={template.label} title={template.description}>
                <Chip
                  label={template.label}
                  size="small"
                  variant="outlined"
                  onClick={() => appendTemplateBlocks(template.blocks)}
                  data-testid={`site-settings.seo.template-${template.label.toLowerCase().replace(/\s+/g, '-')}`}
                />
              </Tooltip>
            ))}
            <Tooltip title={t('settings.robotsTxt.emptyBlockTooltip')}>
              <Chip
                label={t('settings.robotsTxt.emptyBlock')}
                size="small"
                variant="outlined"
                onClick={addBlock}
                data-testid="site-settings.seo.template-empty-block"
              />
            </Tooltip>
          </Box>

          {/* User-agent blocks render as a dense list. Instead of nesting each
              block in its own card, siblings are separated by a top divider
              (starting from the second). This flattens the stack and makes
              6+ bots scannable. */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {rules.map((block, blockIdx) => (
              <Box
                key={block._id}
                sx={{
                  py: 2,
                  borderTop: blockIdx === 0 ? 'none' : '1px solid var(--outline-variant)',
                }}
                data-testid="site-settings.seo.user-agent-block"
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box
                    sx={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: 0.8,
                      color: 'var(--on-surface-variant)',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      minWidth: 88,
                    }}
                  >
                    {t('settings.robotsTxt.userAgent')}
                  </Box>
                  <TextField
                    size="small"
                    placeholder={t('settings.robotsTxt.userAgentPlaceholder')}
                    value={block.user_agent}
                    onChange={(e) => updateUserAgent(block._id, e.target.value)}
                    sx={{ flex: 1 }}
                    data-testid="site-settings.seo.user-agent-input"
                  />
                  <Tooltip title={t('settings.robotsTxt.removeBlock')}>
                    <span>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => removeBlock(block._id)}
                        disabled={rules.length <= 1}
                        aria-label={t('settings.robotsTxt.removeBlock')}
                        data-testid="site-settings.seo.remove-block"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                <Box sx={{ pl: { xs: 0, sm: '96px' }, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {block.rules.map((dir, dirIdx) => (
                    <Box
                      key={dirIdx}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      data-testid="site-settings.seo.directive-row"
                    >
                      <Select
                        size="small"
                        value={dir.directive}
                        onChange={(e) =>
                          updateDirective(block._id, dirIdx, 'directive', e.target.value)
                        }
                        sx={{ minWidth: 120 }}
                        data-testid="site-settings.seo.directive-select"
                      >
                        <MenuItem value="Allow">{t('settings.robotsTxt.allow')}</MenuItem>
                        <MenuItem value="Disallow">{t('settings.robotsTxt.disallow')}</MenuItem>
                      </Select>
                      <TextField
                        size="small"
                        placeholder={t('settings.robotsTxt.pathPlaceholder')}
                        value={dir.path}
                        onChange={(e) =>
                          updateDirective(block._id, dirIdx, 'path', e.target.value)
                        }
                        sx={{ flex: 1 }}
                        data-testid="site-settings.seo.path-input"
                      />
                      <Tooltip title={t('settings.robotsTxt.removeDirective')}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => removeDirective(block._id, dirIdx)}
                            disabled={block.rules.length <= 1}
                            aria-label={t('settings.robotsTxt.removeDirective')}
                            data-testid="site-settings.seo.remove-directive"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  ))}

                  <Box>
                    <M3Button
                      variant="text"
                      size="sm"
                      icon="add"
                      onClick={() => addDirective(block._id)}
                      data-testid="site-settings.seo.add-directive"
                    >
                      {t('settings.robotsTxt.addDirective')}
                    </M3Button>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>

          <Box>
            <M3Button variant="ghost" size="sm" icon="add" onClick={addBlock} data-testid="site-settings.seo.add-block">
              {t('settings.robotsTxt.addUserAgent')}
            </M3Button>
          </Box>
        </SettingsCard>
      </CardGroup>

      {/* Preview pane is sticky so it stays in view while editing the
          (potentially long) list of user-agent blocks. */}
      <Box sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
        <CardGroup label={t('settings.robotsTxt.preview')}>
          <SettingsCard>
            <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
              {t('settings.robotsTxt.previewDescription')}
            </div>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid var(--outline-variant)',
                background: 'var(--surface-container-high)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                minHeight: 120,
                maxHeight: 'calc(100vh - 260px)',
                overflow: 'auto',
              }}
              data-testid="site-settings.seo.preview"
            >
              {preview || '(empty)'}
            </Box>
            {!baseUrl && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                {t('settings.robotsTxt.sitemapNote')}
              </Alert>
            )}
          </SettingsCard>
        </CardGroup>
      </Box>
    </Box>
  );
}
