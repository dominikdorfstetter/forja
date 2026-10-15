/**
 * Entry create/edit page (#798): loads the type schema + (for existing
 * entries) the entry, resolves the site's locales for the localized tabs, and
 * drives create/update through the entry mutations. Existing entries can be
 * published / unpublished from the header. Owns the shared page chrome
 * (PageHeader + navigable breadcrumb + back).
 */
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Box, Stack } from '@mui/material';

import { useSiteContext } from '@/store/SiteContext';
import { useCustomEntryMutations } from '@/hooks/useCustomTypes';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { CustomEntryRequest } from '@/types/customTypes';
import { PageHeader } from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import LoadingState from '@/components/shared/LoadingState';
import { CollectionEntryForm } from './CollectionEntryForm';
import { CollectionsBreadcrumb } from './CollectionsBreadcrumb';
import { EntryPublishToggle, EntryStatusChip } from './CollectionEntryPublishControls';
import { useCollectionEntryData } from './useCollectionEntryData';

export default function CollectionEntryEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { typeKey = '', entryId = 'new' } = useParams();
  const { selectedSiteId } = useSiteContext();
  const siteId = selectedSiteId ?? '';
  const isNew = entryId === 'new';
  const { showError, showSuccess } = useErrorSnackbar();

  const { type, entry, isLoading, locales } = useCollectionEntryData(
    siteId,
    typeKey,
    isNew ? undefined : entryId,
  );
  const mutations = useCustomEntryMutations(siteId, typeKey);

  const back = () => navigate(`/collections/${encodeURIComponent(typeKey)}`);
  const onSubmit = (req: CustomEntryRequest) => {
    if (isNew) {
      mutations.create.mutate(req, { onSuccess: back });
    } else {
      mutations.update.mutate({ id: entryId, data: req }, { onSuccess: back });
    }
  };

  const togglePublish = () => {
    if (isNew) return;
    const action = entry?.status === 'published' ? mutations.unpublish : mutations.publish;
    const msg =
      entry?.status === 'published'
        ? t('collections.entryUnpublished')
        : t('collections.entryPublished');
    action.mutate(entryId, {
      onSuccess: () => showSuccess(msg),
      onError: showError,
    });
  };

  if (isLoading || !type) {
    return <LoadingState />;
  }

  const typeName = type.name ?? typeKey;
  const pageTitle = isNew ? t('collections.newEntry') : t('common.actions.edit');

  return (
    <Box data-testid="collections.entry-edit.page">
      <PageHeader
        icon="category"
        breadcrumb={
          <CollectionsBreadcrumb
            crumbs={[
              { label: t('collections.title'), to: '/collections' },
              { label: typeName, to: `/collections/${encodeURIComponent(typeKey)}` },
              { label: pageTitle },
            ]}
          />
        }
        title={
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }} component="span">
            <span>{pageTitle}</span>
            <EntryStatusChip entry={entry} />
          </Stack>
        }
        actions={
          <>
            <EntryPublishToggle
              entry={entry}
              loading={mutations.publish.isPending || mutations.unpublish.isPending}
              onToggle={togglePublish}
            />
            <M3Button
              variant="text"
              size="md"
              icon="arrow_back"
              onClick={back}
              data-testid="collections-back"
            >
              {t('common.actions.back')}
            </M3Button>
          </>
        }
      />
      <CollectionEntryForm
        schema={type}
        locales={locales}
        initialShared={entry?.shared}
        initialLocalized={entry?.localized}
        onSubmit={onSubmit}
        submitting={mutations.create.isPending || mutations.update.isPending}
        forceVisible={isNew}
      />
    </Box>
  );
}
