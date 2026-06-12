import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import { IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { deleteFormTemplate, getFormTemplates } from '@/services/forms';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { PageHeader } from '@/components/shared/listPageV2/PageHeader';
import { DataTableV2, type DataTableV2Column } from '@/components/shared/listPageV2/DataTableV2';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { M3Button, Icon } from '@/components/design-system';
import FormTemplateDialog from '@/components/forms/FormTemplateDialog';
import type { FormTemplateResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

function StatusPill({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: active ? 'var(--success-container, #d6f5dd)' : 'var(--surface-container-high)',
        color: active ? 'var(--on-success-container, #0f5132)' : 'var(--on-surface-variant)',
      }}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

/**
 * Form templates list page (#588) at /forms/templates. Templates are
 * copy-on-create presets: they store a JSONB snapshot of fields that
 * CreateFormWizard offers as a starting point. No ongoing link to
 * derived forms — editing a template doesn't change forms that used it.
 *
 * Reuses the same lean list pattern as FormsPage (PageHeader +
 * DataTableV2 + EmptyState + edit dialog) rather than the workflow-
 * shaped EntityListPage adapter, for the same reasons described in
 * #587 — templates have a binary active toggle, not a content workflow.
 */
export default function FormTemplatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { canWrite } = useAuth();
  const { showError, showSuccess } = useErrorSnackbar();

  const [editing, setEditing] = useState<FormTemplateResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<FormTemplateResponse | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.formTemplates(selectedSiteId),
    queryFn: () => getFormTemplates(selectedSiteId, { page_size: 100 }),
    enabled: !!selectedSiteId,
  });

  const rows = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFormTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.formTemplates(selectedSiteId) });
      showSuccess(t('formsModule.templates.messages.deleted', 'Template deleted.'));
      setDeleting(null);
    },
    onError: (e) => {
      showError(e);
      setDeleting(null);
    },
  });

  const columns = useMemo<DataTableV2Column<FormTemplateResponse>[]>(
    () => [
      {
        key: 'name',
        label: t('formsModule.templates.columns.name', 'Name'),
        width: 'minmax(200px, 2fr)',
        render: (r) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name={r.icon || 'description'} size={16} />
            {r.name}
          </span>
        ),
      },
      {
        key: 'description',
        label: t('formsModule.templates.columns.description', 'Description'),
        width: 'minmax(220px, 3fr)',
        muted: true,
        render: (r) => r.description ?? '',
      },
      {
        key: 'fields',
        label: t('formsModule.templates.columns.fields', 'Fields'),
        width: '90px',
        align: 'right',
        render: (r) => (Array.isArray(r.fields) ? r.fields.length : 0),
      },
      {
        key: 'status',
        label: t('formsModule.templates.columns.status', 'Status'),
        width: '110px',
        render: (r) => (
          <StatusPill
            active={r.is_active}
            activeLabel={t('formsModule.list.status.active')}
            inactiveLabel={t('formsModule.list.status.inactive')}
          />
        ),
      },
    ],
    [t],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (tpl: FormTemplateResponse) => {
    setEditing(tpl);
    setDialogOpen(true);
  };

  return (
    <div data-testid="forms.templates.page">
      <PageHeader
        icon="view_quilt"
        breadcrumb={`${t('layout.sidebar.content')} / ${t('layout.sidebar.forms')} / ${t('formsModule.templates.title', 'Templates')}`}
        title={t('formsModule.templates.title', 'Form templates')}
        subtitle={t(
          'formsModule.templates.subtitle',
          'Reusable field presets offered when creating a new form.',
        )}
        actions={
          <>
            <M3Button
              variant="outlined"
              size="md"
              icon="arrow_back"
              onClick={() => navigate('/forms')}
              data-testid="forms.templates.btn.back"
            >
              {t('formsModule.templates.backToForms', 'Back to forms')}
            </M3Button>
            {canWrite && selectedSiteId ? (
              <M3Button
                size="md"
                icon="add"
                onClick={openCreate}
                data-testid="forms.templates.btn.create"
              >
                {t('formsModule.templates.createButton', 'Create template')}
              </M3Button>
            ) : null}
          </>
        }
      />

      {isError && (
        <div role="alert" style={{ color: 'var(--err)', padding: 16 }}>
          {t('formsModule.templates.loadError', 'Failed to load templates.')}
        </div>
      )}

      {!isLoading && rows.length === 0 && !isError ? (
        <EmptyState
          icon={<ViewQuiltIcon sx={{ fontSize: 64 }} />}
          title={t('formsModule.templates.empty.title', 'No templates yet')}
          description={t(
            'formsModule.templates.empty.description',
            'Templates are reusable field presets. Create one to speed up form creation.',
          )}
          action={
            canWrite
              ? { label: t('formsModule.templates.empty.cta', 'Create your first template'), onClick: openCreate }
              : undefined
          }
        />
      ) : (
        <DataTableV2<FormTemplateResponse>
          columns={columns}
          rows={rows}
          getKey={(r) => r.id}
          loadingRows={isLoading ? 5 : undefined}
          data-testid="forms.templates.table"
          renderActions={(row) => (
            <>
              <Tooltip title={t('formsModule.templates.actions.edit', 'Edit')}>
                <IconButton
                  size="small"
                  onClick={() => openEdit(row)}
                  data-testid="forms.templates.btn.edit"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('formsModule.templates.actions.delete', 'Delete')}>
                <IconButton
                  size="small"
                  onClick={() => setDeleting(row)}
                  sx={{ color: 'var(--err)' }}
                  data-testid="forms.templates.btn.delete"
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        />
      )}

      <FormTemplateDialog
        open={dialogOpen}
        template={editing}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmDialog
        open={!!deleting}
        title={t('formsModule.templates.deleteConfirm.title', 'Delete template?')}
        message={t(
          'formsModule.templates.deleteConfirm.body',
          'Forms already created from this template are unaffected — templates are copy-on-create.',
        )}
        confirmLabel={t('formsModule.templates.deleteConfirm.confirm', 'Delete template')}
        confirmColor="error"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
