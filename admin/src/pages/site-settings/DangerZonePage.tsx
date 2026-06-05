import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import {
  SectionHead,
  SettingsCard,
  Field,
  M3Button,
} from '@/components/design-system';
import TransferOwnershipDialog from '@/components/site-settings/TransferOwnershipDialog';
import DeleteSiteDialog from '@/components/site-settings/DeleteSiteDialog';
import ResetContentDialog from '@/components/site-settings/ResetContentDialog';
import ExportSiteAction from '@/components/site-settings/ExportSiteAction';

interface DangerRow {
  id: string;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
  icon: string;
  actionKey: string;
  actionFallback: string;
  danger: boolean;
  requiresOwner: boolean;
}

const ROWS: DangerRow[] = [
  {
    id: 'exportSite',
    titleKey: 'siteSettings.danger.export.title',
    titleFallback: 'Export site archive',
    descKey: 'siteSettings.danger.export.description',
    descFallback:
      'Download a zip containing all content, assets, and metadata for this site. Non-destructive.',
    icon: 'download',
    actionKey: 'siteSettings.danger.export.action',
    actionFallback: 'Export',
    danger: false,
    requiresOwner: false,
  },
  {
    id: 'transferOwnership',
    titleKey: 'siteSettings.danger.transfer.title',
    titleFallback: 'Transfer ownership',
    descKey: 'siteSettings.danger.transfer.description',
    descFallback:
      'Hand over this site to another member. You will become an Editor and lose billing access.',
    icon: 'swap_horiz',
    actionKey: 'siteSettings.danger.transfer.action',
    actionFallback: 'Transfer',
    danger: true,
    requiresOwner: true,
  },
  {
    id: 'resetContent',
    titleKey: 'siteSettings.danger.reset.title',
    titleFallback: 'Reset all content',
    descKey: 'siteSettings.danger.reset.description',
    descFallback:
      'Delete every post, page, and asset. Settings and members will be kept. Cannot be undone.',
    icon: 'restart_alt',
    actionKey: 'siteSettings.danger.reset.action',
    actionFallback: 'Reset content',
    danger: true,
    requiresOwner: true,
  },
  {
    id: 'deleteSite',
    titleKey: 'siteSettings.danger.delete.title',
    titleFallback: 'Delete this site',
    descKey: 'siteSettings.danger.delete.description',
    descFallback:
      'Permanently remove this site, its content, members, and API keys. This action is final.',
    icon: 'delete_forever',
    actionKey: 'siteSettings.danger.delete.action',
    actionFallback: 'Delete site',
    danger: true,
    requiresOwner: true,
  },
];

/**
 * Danger zone — destructive site-level operations gated to the site owner.
 * The destructive actions' backend wiring is tracked as follow-up issues;
 * this page delivers the surface so the zone is discoverable and the
 * visual language stays consistent with the rest of the redesign.
 */
export default function DangerZonePage() {
  const { t } = useTranslation();
  const { isOwner, isSystemAdmin, isAdmin } = useAuth();
  const { selectedSiteId } = useSiteContext();
  // Export mirrors the backend gate: owner / site-admin / system-admin
  // (`can_export`). Wider than the owner-only destructive actions.
  const canExport = isOwner || isSystemAdmin || isAdmin;
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div data-testid="site-settings.danger.page">
      <SectionHead
        icon="warning"
        title={t('siteSettings.danger.title', 'Danger zone')}
        subtitle={t(
          'siteSettings.danger.subtitle',
          "Destructive actions that affect all users of this site. Double-check what you're about to do.",
        )}
        danger
      />

      <SettingsCard danger>
        {ROWS.map((row) => {
          const disabled = row.requiresOwner && !isOwner && !isSystemAdmin;
          return (
            <Field key={row.id} fieldId={row.id}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 20,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    {t(row.titleKey, row.titleFallback)}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--on-surface-variant)',
                      lineHeight: 1.5,
                      maxWidth: 560,
                    }}
                  >
                    {t(row.descKey, row.descFallback)}
                  </div>
                </div>
                {row.id === 'exportSite' ? (
                  <ExportSiteAction
                    siteId={selectedSiteId}
                    disabled={!canExport}
                  />
                ) : (
                  <M3Button
                    variant="filled"
                    size="sm"
                    icon={row.icon}
                    danger
                    disabled={disabled}
                    onClick={
                      row.id === 'transferOwnership'
                        ? () => setTransferOpen(true)
                        : row.id === 'deleteSite'
                          ? () => setDeleteOpen(true)
                          : row.id === 'resetContent'
                            ? () => setResetOpen(true)
                            : undefined
                    }
                    ariaLabel={t(row.actionKey, row.actionFallback)}
                    data-testid={`site-settings.danger.action.${row.id}`}
                  >
                    {t(row.actionKey, row.actionFallback)}
                  </M3Button>
                )}
              </div>
            </Field>
          );
        })}
      </SettingsCard>

      <TransferOwnershipDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
      />

      <DeleteSiteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />

      <ResetContentDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
      />
    </div>
  );
}
