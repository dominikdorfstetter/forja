import type { TFunction } from 'i18next';
import type { LegalDocumentResponse } from '@/types/api';
import { StatusPill, type ContentStatus } from '@/components/design-system';
import type { DataTableV2Column } from '@/components/shared/listPageV2';
import type { ChipOption, ColumnsDeps } from '@/components/shared/entityListPage';

export function buildLegalColumns({ t, fmt, sortBy, sortDir }: ColumnsDeps): DataTableV2Column<LegalDocumentResponse>[] {
  return [
    {
      key: 'cookie_name',
      label: t('legal.table.name'),
      width: 'minmax(200px, 2fr)',
      sorted: sortBy === 'cookie_name' ? sortDir : undefined,
      render: (doc) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{doc.cookie_name}</span>
      ),
    },
    {
      key: 'document_type',
      label: t('legal.table.type'),
      width: 'minmax(140px, 1fr)',
      sorted: sortBy === 'document_type' ? sortDir : undefined,
      render: (doc) => t(`legal.documentTypes.${doc.document_type}`),
    },
    {
      key: 'status',
      label: t('legal.table.status'),
      width: '120px',
      render: (doc) => <StatusPill status={doc.status as ContentStatus} size="sm" />,
    },
    {
      key: 'created_at',
      label: t('legal.table.created'),
      width: '140px',
      muted: true,
      sorted: sortBy === 'created_at' ? sortDir : undefined,
      render: (doc) => fmt(doc.created_at, 'PP'),
    },
  ];
}

export function buildLegalChipFilters(t: TFunction): ChipOption[] {
  return [
    { value: 'all', label: t('common.filters.all') },
    { value: 'Draft', label: t('common.status.draft') },
    { value: 'InReview', label: t('common.status.inReview') },
    { value: 'Scheduled', label: t('common.status.scheduled') },
    { value: 'Published', label: t('common.status.published') },
  ];
}
