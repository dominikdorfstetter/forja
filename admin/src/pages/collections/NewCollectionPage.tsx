/**
 * New-collection page (#797): wires the builder to the create mutation and
 * navigates to the type's entries on success. Owns the shared page chrome
 * (PageHeader + breadcrumb + back) so the builder stays presentational.
 */
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Box } from '@mui/material';

import { useSiteContext } from '@/store/SiteContext';
import { useCreateCustomType } from '@/hooks/useCustomTypes';
import type { CreateCustomTypeRequest } from '@/types/customTypes';
import { PageHeader } from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import { CollectionTypeBuilder } from './CollectionTypeBuilder';
import { CollectionsBreadcrumb } from './CollectionsBreadcrumb';

export default function NewCollectionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const create = useCreateCustomType(selectedSiteId ?? '');

  const onSubmit = (req: CreateCustomTypeRequest) => {
    create.mutate(req, {
      onSuccess: (created) => navigate(`/collections/${encodeURIComponent(created.key)}`),
    });
  };

  return (
    <Box data-testid="collections.new.page">
      <PageHeader
        icon="category"
        breadcrumb={
          <CollectionsBreadcrumb
            crumbs={[
              { label: t('layout.sidebar.content') },
              { label: t('collections.title'), to: '/collections' },
              { label: t('collections.newType') },
            ]}
          />
        }
        title={t('collections.newType')}
        actions={
          <M3Button
            variant="text"
            size="md"
            icon="arrow_back"
            onClick={() => navigate('/collections')}
            data-testid="collections-back"
          >
            {t('common.actions.back')}
          </M3Button>
        }
      />
      <CollectionTypeBuilder onSubmit={onSubmit} submitting={create.isPending} />
    </Box>
  );
}
