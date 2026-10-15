import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@mui/material';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { SlotRender } from '@/components/shared/SlotRender';
import { Toolbar, ToolbarSpacer, SearchField } from '@/components/shared/listPageV2';
import { Chip } from '@/components/design-system';
import type { ListView } from './entityListHelpers';
import type { ChipOption, EmptyStateSlotProps, ToolbarExtrasSlotProps } from './types';

type ListTranslator = (sub: string, opts?: Record<string, unknown>) => string;

interface EntityListStatusViewProps {
  view: Exclude<ListView, 'ready'>;
  tl: ListTranslator;
  emptyIcon: ReactNode;
  canWrite: boolean;
  openCreate: () => void;
  renderEmptyState?: (props: EmptyStateSlotProps) => ReactNode;
}

/** Every non-table body: no site selected, loading, load error, first-run empty. */
export function EntityListStatusView({
  view,
  tl,
  emptyIcon,
  canWrite,
  openCreate,
  renderEmptyState,
}: EntityListStatusViewProps) {
  const { t } = useTranslation();
  switch (view) {
    case 'noSite':
      return <EmptyState icon={emptyIcon} title={t('common.noSiteSelected')} description={tl('empty.noSite')} />;
    case 'loading':
      return <LoadingState label={tl('loading')} />;
    case 'error':
      return <Alert severity="error">{tl('loadError')}</Alert>;
    case 'empty':
      if (renderEmptyState) {
        return <SlotRender render={renderEmptyState} args={{ canWrite, openCreate }} />;
      }
      return (
        <EmptyState
          icon={emptyIcon}
          title={tl('empty.title')}
          description={tl('empty.description')}
          action={canWrite ? { label: tl('empty.title'), onClick: openCreate } : undefined}
        />
      );
  }
}

interface EntityListToolbarProps {
  tl: ListTranslator;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchTestId: string;
  extras?: { render: (props: ToolbarExtrasSlotProps) => ReactNode; args: ToolbarExtrasSlotProps };
  /** Status chips — hidden on the Archived tab. */
  chips?: { options: ChipOption[]; active: string; onChange: (value: string) => void };
}

/** Search, consumer toolbar extras, and the status chip filter. */
export function EntityListToolbar({
  tl,
  searchQuery,
  onSearchChange,
  searchTestId,
  extras,
  chips,
}: EntityListToolbarProps) {
  return (
    <Toolbar>
      <SearchField
        value={searchQuery}
        onChange={onSearchChange}
        placeholder={tl('searchPlaceholder')}
        width={320}
        data-testid={searchTestId}
      />
      {extras ? <SlotRender render={extras.render} args={extras.args} /> : null}
      <ToolbarSpacer />
      {chips?.options.map((opt) => (
        <Chip
          key={opt.value}
          active={chips.active === opt.value}
          count={opt.count}
          onClick={() => chips.onChange(opt.value)}
        >
          {opt.label}
        </Chip>
      ))}
    </Toolbar>
  );
}
