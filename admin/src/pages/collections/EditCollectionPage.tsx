/**
 * Edit-collection page: loads an existing type and drives the structure
 * update through useUpdateCustomType. Reuses the schema builder in edit mode
 * (key locked, field ids carried for rename detection) and maps its
 * create-shaped payload to an UpdateCustomTypeRequest by dropping `key`.
 */
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Box } from '@mui/material';

import { useSiteContext } from '@/store/SiteContext';
import { useCustomType, useUpdateCustomType } from '@/hooks/useCustomTypes';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { CreateCustomTypeRequest } from '@/types/customTypes';
import { PageHeader } from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import LoadingState from '@/components/shared/LoadingState';
import { CollectionTypeBuilder } from './CollectionTypeBuilder';
import { CollectionsBreadcrumb } from './CollectionsBreadcrumb';

export default function EditCollectionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { typeKey = '' } = useParams();
  const { selectedSiteId } = useSiteContext();
  const siteId = selectedSiteId ?? '';
  const { showError, showSuccess } = useErrorSnackbar();

  const { data: type, isLoading } = useCustomType(siteId, typeKey);
  const update = useUpdateCustomType(siteId, typeKey);

  const back = () => navigate(`/collections/${encodeURIComponent(typeKey)}`);

  const onSubmit = ({ key: _key, ...rest }: CreateCustomTypeRequest) => {
    update.mutate(rest, {
      onSuccess: () => {
        showSuccess(t('collections.structureSaved'));
        back();
      },
      onError: showError,
    });
  };

  if (isLoading || !type) {
    return <LoadingState />;
  }

  return (
    <Box data-testid="collections.edit.page">
      <PageHeader
        icon="category"
        breadcrumb={
          <CollectionsBreadcrumb
            crumbs={[
              { label: t('collections.title'), to: '/collections' },
              { label: type.name, to: `/collections/${encodeURIComponent(typeKey)}` },
              { label: t('collections.editStructure') },
            ]}
          />
        }
        title={t('collections.editStructure')}
        actions={
          <M3Button
            variant="text"
            size="md"
            icon="arrow_back"
            onClick={back}
            data-testid="collections-back"
          >
            {t('common.actions.back')}
          </M3Button>
        }
      />
      <CollectionTypeBuilder
        mode="edit"
        initial={type}
        onSubmit={onSubmit}
        submitting={update.isPending}
      />
    </Box>
  );
}
