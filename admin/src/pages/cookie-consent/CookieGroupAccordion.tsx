import type { ReactNode } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import type { LegalGroupResponse } from '@/types/api';
import { Icon, M3IconButton } from '@/components/design-system';
import CookieGroupItemsSection from './CookieGroupItemsSection';
import type { MoveDirection } from './cookieGroupState';

type FlagTone = 'warn' | 'tertiary';

/** Status pill: tonal fill when `active`, outlined neutral otherwise. */
function FlagPill({ active, tone, children }: { active: boolean; tone: FlagTone; children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        height: 22,
        borderRadius: '999px',
        bgcolor: active ? `var(--${tone}-container)` : 'transparent',
        color: active ? `var(--on-${tone}-container)` : 'var(--on-surface-variant)',
        border: active ? 'none' : '1px solid var(--outline-variant)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontVariationSettings: '"wght" 600, "opsz" 11',
      }}
    >
      {children}
    </Box>
  );
}

function CookieGroupSummary({ group }: { group: LegalGroupResponse }) {
  const { t } = useTranslation();
  const tone: FlagTone = group.is_required ? 'warn' : 'tertiary';

  return (
    <AccordionSummary
      expandIcon={<ExpandMoreIcon sx={{ color: 'var(--on-surface-variant)' }} />}
      sx={{
        px: 2.5,
        py: 0.5,
        minHeight: 64,
        '&.Mui-expanded': { minHeight: 64 },
        '& .MuiAccordionSummary-content': { gap: 1.5, alignItems: 'center' },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          bgcolor: `var(--${tone}-container)`,
          color: `var(--on-${tone}-container)`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={group.is_required ? 'lock' : 'toggle_on'} size={18} />
      </Box>
      <Box
        component="span"
        sx={{
          flexGrow: 1,
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          color: 'var(--on-surface)',
        }}
      >
        {group.cookie_name}
      </Box>
      <FlagPill active={group.is_required} tone="warn">
        {group.is_required ? t('legalDetail.groups.required') : t('legalDetail.groups.optional')}
      </FlagPill>
      <FlagPill active={group.default_enabled} tone="tertiary">
        {group.default_enabled ? t('legalDetail.groups.enabled') : t('legalDetail.groups.disabled')}
      </FlagPill>
    </AccordionSummary>
  );
}

interface CookieGroupAccordionProps {
  group: LegalGroupResponse;
  index: number;
  groupCount: number;
  canWrite: boolean;
  isAdmin: boolean;
  onMove: (index: number, direction: MoveDirection) => void;
  onEdit: (group: LegalGroupResponse) => void;
  onDelete: (group: LegalGroupResponse) => void;
}

/** One cookie group: summary pills, reorder/edit/delete actions, and its items. */
export default function CookieGroupAccordion({
  group,
  index,
  groupCount,
  canWrite,
  isAdmin,
  onMove,
  onEdit,
  onDelete,
}: CookieGroupAccordionProps) {
  const { t } = useTranslation();

  return (
    <Accordion
      defaultExpanded
      disableGutters
      elevation={0}
      data-testid={`cookie-group.${group.id}`}
      sx={{
        bgcolor: 'var(--surface-container)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '20px !important',
        overflow: 'hidden',
        '&:before': { display: 'none' },
        '&.Mui-expanded': { my: 0 },
      }}
    >
      <CookieGroupSummary group={group} />
      <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 1.5,
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--outline-variant)',
            pt: 1.5,
          }}
        >
          {canWrite && (
            <>
              <M3IconButton
                name="arrow_upward"
                size={34}
                tooltip={t('common.actions.moveUp')}
                disabled={index === 0}
                onClick={() => onMove(index, 'up')}
                data-testid={`cookie-group.move-up.${group.id}`}
              />
              <M3IconButton
                name="arrow_downward"
                size={34}
                tooltip={t('common.actions.moveDown')}
                disabled={index === groupCount - 1}
                onClick={() => onMove(index, 'down')}
                data-testid={`cookie-group.move-down.${group.id}`}
              />
              <M3IconButton
                name="edit"
                size={34}
                tooltip={t('legalDetail.groups.editGroup')}
                onClick={() => onEdit(group)}
                data-testid={`cookie-group.edit.${group.id}`}
              />
            </>
          )}
          {isAdmin && (
            <M3IconButton
              name="delete"
              size={34}
              tooltip={t('legalDetail.groups.deleteGroup')}
              onClick={() => onDelete(group)}
              data-testid={`cookie-group.delete.${group.id}`}
            />
          )}
        </Box>
        <CookieGroupItemsSection groupId={group.id} />
      </AccordionDetails>
    </Accordion>
  );
}
