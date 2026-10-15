import { Alert, Stack } from '@mui/material';
import CookieIcon from '@mui/icons-material/Cookie';
import { useTranslation } from 'react-i18next';
import type { LegalGroupResponse } from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import CookieGroupAccordion from './CookieGroupAccordion';
import type { MoveDirection } from './cookieGroupState';

interface CookieGroupListProps {
  groups: LegalGroupResponse[] | undefined;
  loading: boolean;
  error: unknown;
  canWrite: boolean;
  isAdmin: boolean;
  onAdd: () => void;
  onMove: (index: number, direction: MoveDirection) => void;
  onEdit: (group: LegalGroupResponse) => void;
  onDelete: (group: LegalGroupResponse) => void;
}

/** Loading / error / empty / accordion-list states of the cookie groups. */
export default function CookieGroupList({
  groups,
  loading,
  error,
  canWrite,
  isAdmin,
  onAdd,
  onMove,
  onEdit,
  onDelete,
}: CookieGroupListProps) {
  const { t } = useTranslation();

  if (loading) {
    return <LoadingState label={t('legalDetail.groups.loadingGroups')} />;
  }
  if (error) {
    return <Alert severity="error" data-testid="cookie-consent.groups-error">{t('legalDetail.loadGroupsFailed')}</Alert>;
  }
  if (!groups || groups.length === 0) {
    return (
      <EmptyState
        icon={<CookieIcon sx={{ fontSize: 48 }} />}
        title={t('legalDetail.groups.empty')}
        description={t('legalDetail.groups.emptyDescription')}
        action={canWrite ? { label: t('legalDetail.groups.add'), onClick: onAdd } : undefined}
      />
    );
  }

  return (
    <Stack spacing={2}>
      {groups.map((group, index) => (
        <CookieGroupAccordion
          key={group.id}
          group={group}
          index={index}
          groupCount={groups.length}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onMove={onMove}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </Stack>
  );
}
