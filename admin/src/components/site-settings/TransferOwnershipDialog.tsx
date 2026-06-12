import { useEffect, useState } from 'react';
import {
  Dialog,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSiteMembers, transferOwnership } from '@/services/members';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { DangerConfirmDialog, Icon, M3Button } from '@/components/design-system';
import type { ProblemDetails, SiteMembership } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

interface TransferOwnershipDialogProps {
  open: boolean;
  onClose: () => void;
}

const memberLabel = (m: SiteMembership) =>
  m.name || m.email || m.clerk_user_id;

const isProblem = (e: unknown): e is ProblemDetails =>
  typeof e === 'object' && e !== null && 'status' in e;

const TITLE_ID = 'transfer-ownership-title';

/**
 * Self-contained Transfer-ownership flow for the Danger zone (#710).
 * Step 1 — pick an existing member (the caller is excluded); step 2 reuses
 * the shared {@link DangerConfirmDialog} so the user must type the site name
 * before the transfer fires. On success the caller is demoted to Editor, so
 * we refresh auth and invalidate the member/site caches.
 */
export default function TransferOwnershipDialog({
  open,
  onClose,
}: TransferOwnershipDialogProps) {
  const { t } = useTranslation();
  const { selectedSiteId, selectedSite } = useSiteContext();
  const { clerkUserId, refreshAuth } = useAuth();
  const { showError, showSuccess, enqueueSnackbar } = useErrorSnackbar();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [newOwner, setNewOwner] = useState('');

  useEffect(() => {
    if (!open) {
      setStep('pick');
      setNewOwner('');
    }
  }, [open]);

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.members(selectedSiteId),
    queryFn: () => getSiteMembers(selectedSiteId),
    enabled: open && !!selectedSiteId,
  });

  const candidates = members.filter((m) => m.clerk_user_id !== clerkUserId);
  const siteName = selectedSite?.name ?? '';

  const mutation = useMutation({
    mutationFn: () =>
      transferOwnership(selectedSiteId, { new_owner_clerk_user_id: newOwner }),
    onSuccess: async () => {
      showSuccess(t('siteSettings.danger.transfer.success'));
      await refreshAuth();
      queryClient.invalidateQueries({ queryKey: queryKeys.members(selectedSiteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sites() });
      onClose();
    },
    onError: (err: unknown) => {
      if (isProblem(err) && err.status === 422) {
        enqueueSnackbar(t('siteSettings.danger.transfer.notMember'), {
          variant: 'error',
        });
        return;
      }
      showError(err);
    },
  });

  if (!open) return null;

  if (step === 'confirm') {
    const picked = candidates.find((m) => m.clerk_user_id === newOwner);
    return (
      <DangerConfirmDialog
        open
        title={t('siteSettings.danger.transfer.confirm.title')}
        body={t('siteSettings.danger.transfer.confirm.body', {
          site: siteName,
          member: picked ? memberLabel(picked) : '',
        })}
        confirmPhrase={siteName}
        confirmLabel={t('siteSettings.danger.transfer.confirm.label')}
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        onClose={onClose}
      />
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby={TITLE_ID}
      data-testid="transfer-ownership.picker"
      slotProps={{
        paper: {
          sx: {
            borderRadius: '28px',
            background: 'var(--surface-container-high)',
            border: '1px solid var(--outline-variant)',
            boxShadow: '0 24px 60px -16px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          },
        },
        backdrop: {
          sx: {
            background: 'color-mix(in oklch, var(--shadow, #000) 62%, transparent)',
            backdropFilter: 'blur(2px)',
          },
        },
      }}
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 16,
              background: 'color-mix(in oklch, var(--err) 18%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="swap_horiz" size={24} color="var(--err)" filled />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id={TITLE_ID}
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: -0.2,
                color: 'var(--on-surface)',
                fontVariationSettings: '"wght" 600, "opsz" 24',
              }}
            >
              {t('siteSettings.danger.transfer.pick.title')}
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--on-surface-variant)',
              }}
            >
              {t('siteSettings.danger.transfer.pick.body')}
            </p>
          </div>
        </div>

        {candidates.length === 0 ? (
          <p
            data-testid="transfer-ownership.empty"
            style={{ margin: 0, fontSize: 14, color: 'var(--on-surface-variant)' }}
          >
            {t('siteSettings.danger.transfer.pick.empty')}
          </p>
        ) : (
          <FormControl fullWidth size="small">
            <InputLabel id="transfer-ownership-select-label">
              {t('siteSettings.danger.transfer.pick.label')}
            </InputLabel>
            <Select
              labelId="transfer-ownership-select-label"
              label={t('siteSettings.danger.transfer.pick.label')}
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              data-testid="transfer-ownership.select"
            >
              {candidates.map((m) => (
                <MenuItem key={m.clerk_user_id} value={m.clerk_user_id}>
                  {memberLabel(m)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </div>

      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          background: 'var(--surface-container)',
          borderTop: '1px solid var(--outline-variant)',
        }}
      >
        <M3Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          data-testid="transfer-ownership.cancel"
        >
          {t('siteSettings.danger.confirm.cancel')}
        </M3Button>
        <M3Button
          variant="filled"
          size="sm"
          danger
          disabled={!newOwner || !siteName}
          onClick={() => setStep('confirm')}
          data-testid="transfer-ownership.continue"
        >
          {t('siteSettings.danger.transfer.pick.continue')}
        </M3Button>
      </div>
    </Dialog>
  );
}
