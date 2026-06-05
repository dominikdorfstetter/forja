import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { M3Button } from '@/components/design-system';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusPill from '@/components/forms/StatusPill';
import { createSubmissionNote, deleteSubmission, deleteSubmissionNote, getSubmission } from '@/services/forms';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useReadOnly } from '@/hooks/useReadOnly';
import { useClerkUserNames } from '@/hooks/useClerkUserNames';
import { useSubmissionStatusMutation } from '@/hooks/useSubmissionStatusMutation';
import { nextStatuses } from '@/utils/submissionStatus';
import type { SubmissionStatusLogEntry } from '@/types/api';

interface SubmissionDetailDrawerProps {
  submissionId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/**
 * Submission detail drawer (#589). Shows field values, status history,
 * notes (CRUD), and a delete affordance. The status dropdown drives
 * updateSubmissionStatus → server applies the same state-machine
 * enforcement it would for any other client.
 *
 * Lives as a right-side MUI Drawer rather than a separate route so
 * status-change-and-back-to-list stays a single page transition.
 */
export default function SubmissionDetailDrawer({
  submissionId,
  onClose,
  onDeleted,
}: SubmissionDetailDrawerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const [noteBody, setNoteBody] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const open = !!submissionId;

  const { data: submission, isLoading } = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: () => getSubmission(submissionId!),
    enabled: open,
  });

  useEffect(() => {
    if (!open) setNoteBody('');
  }, [open]);

  const { readOnly } = useReadOnly();
  const resolveActor = useClerkUserNames();
  const statusMutation = useSubmissionStatusMutation(submission?.form_id ?? '');

  const noteAddMutation = useMutation({
    mutationFn: (body: string) => createSubmissionNote(submissionId!, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
      setNoteBody('');
      showSuccess(t('formsModule.submissions.messages.noteAdded', 'Note added.'));
    },
    onError: showError,
  });

  const noteDeleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteSubmissionNote(submissionId!, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
      showSuccess(t('formsModule.submissions.messages.noteDeleted', 'Note deleted.'));
    },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSubmission(submissionId!),
    onSuccess: () => {
      if (submission) {
        queryClient.invalidateQueries({ queryKey: ['submissions', submission.form_id] });
        queryClient.invalidateQueries({ queryKey: ['submission-status-counts', submission.form_id] });
      }
      showSuccess(t('formsModule.submissions.messages.deleted', 'Submission deleted.'));
      onDeleted?.();
      onClose();
    },
    onError: showError,
  });

  function addNote() {
    if (noteBody.trim().length === 0) return;
    noteAddMutation.mutate(noteBody.trim());
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        data-testid="forms.submission.detail"
        // The app shell (permanent sidebar Drawer + AppBar) sits at
        // zIndex.drawer / drawer+1. Pin this temporary drawer well above
        // it so the panel + backdrop are never painted under the menu.
        sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
        slotProps={{
          paper: { sx: { width: { xs: '100%', sm: 600, md: 720 } } },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderBottom: '1px solid var(--outline-variant)' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="overline" color="text.secondary">
                {t('formsModule.submissions.detail.referenceCode', 'Reference code')}
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {submission?.reference_code ?? '—'}
              </Typography>
            </Box>
            <Tooltip title={t('formsModule.submissions.detail.close', 'Close')}>
              <IconButton onClick={onClose} data-testid="forms.submission.detail.close">
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {isLoading || !submission ? (
            <Box sx={{ p: 3, color: 'text.secondary' }}>
              {t('common.loading', 'Loading…')}
            </Box>
          ) : (
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
              }}
            >
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {t('formsModule.submissions.detail.status', 'Status')}
                </Typography>
                <Box
                  sx={{
                    mt: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    flexWrap: 'wrap',
                  }}
                >
                  <StatusPill status={submission.status} />
                  {nextStatuses(submission.status).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'formsModule.submissions.actions.none',
                        'No further transitions',
                      )}
                    </Typography>
                  ) : (
                    nextStatuses(submission.status).map((target) => (
                      <M3Button
                        key={target}
                        size="sm"
                        variant="outlined"
                        disabled={readOnly || statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({
                            submissionId: submission.id,
                            status: target,
                          })
                        }
                        data-testid={`forms.submission.transition.${target}`}
                      >
                        {t(
                          `formsModule.submissions.transition.${target}`,
                          target,
                        )}
                      </M3Button>
                    ))
                  )}
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'var(--outline-variant)' }} />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  {t('formsModule.submissions.detail.data', 'Submitted data')}
                </Typography>
                <Box
                  sx={{
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 2,
                    p: 2,
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    columnGap: 2,
                    rowGap: 1,
                    background: 'var(--surface-container-low)',
                  }}
                >
                  {Object.entries(submission.data as Record<string, unknown>).map(([label, value]) => (
                    <Box key={label} sx={{ display: 'contents' }}>
                      <Box sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>
                        {label}
                      </Box>
                      <Box
                        sx={{
                          fontSize: 14,
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {typeof value === 'string' && EMAIL_RE.test(value.trim()) ? (
                          <Box
                            component="a"
                            href={buildMailto(
                              value.trim(),
                              submission.reference_code,
                              submission.data as Record<string, unknown>,
                            )}
                            data-testid="forms.submission.mailto"
                            sx={{
                              color: 'var(--primary)',
                              textDecoration: 'underline',
                            }}
                          >
                            {value}
                          </Box>
                        ) : (
                          formatValue(value)
                        )}
                      </Box>
                    </Box>
                  ))}
                  {Object.keys(submission.data as Record<string, unknown>).length === 0 && (
                    <Box sx={{ gridColumn: '1 / -1', color: 'text.secondary', fontStyle: 'italic' }}>
                      {t('formsModule.submissions.detail.noData', 'This submission has no field values.')}
                    </Box>
                  )}
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'var(--outline-variant)' }} />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  {t('formsModule.submissions.detail.notes', 'Notes')}
                </Typography>
                <Box sx={{ display: 'grid', gap: 1, mb: 2 }}>
                  {submission.notes.length === 0 && (
                    <Box sx={{ fontSize: 13, color: 'text.secondary', fontStyle: 'italic' }}>
                      {t('formsModule.submissions.detail.noNotes', 'No notes yet.')}
                    </Box>
                  )}
                  {submission.notes.map((n) => (
                    <Box
                      key={n.id}
                      sx={{
                        border: '1px solid var(--outline-variant)',
                        borderRadius: 2,
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {n.body}
                        </Box>
                        <Box sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                          {new Date(n.created_at).toLocaleString()}
                          {resolveActor(n.author_id)
                            ? ` · ${resolveActor(n.author_id)}`
                            : ''}
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => noteDeleteMutation.mutate(n.id)}
                        sx={{ color: 'var(--err)' }}
                        data-testid="forms.submission.note.btn.delete"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    label={t('formsModule.submissions.detail.addNote', 'Add a note')}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                    slotProps={{ htmlInput: { 'data-testid': 'forms.submission.note.input' } }}
                  />
                  <M3Button
                    size="sm"
                    onClick={addNote}
                    disabled={noteBody.trim().length === 0 || noteAddMutation.isPending}
                    data-testid="forms.submission.note.btn.add"
                  >
                    {t('formsModule.submissions.detail.addNoteBtn', 'Add')}
                  </M3Button>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'var(--outline-variant)' }} />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  {t('formsModule.submissions.detail.history', 'Status history')}
                </Typography>
                <Box sx={{ display: 'grid', gap: 0.5 }}>
                  {submission.status_history.length === 0 && (
                    <Box sx={{ fontSize: 13, color: 'text.secondary', fontStyle: 'italic' }}>
                      {t('formsModule.submissions.detail.noHistory', 'No status changes yet.')}
                    </Box>
                  )}
                  {submission.status_history.map((h, i) => (
                    <StatusHistoryRow key={i} entry={h} resolveActor={resolveActor} />
                  ))}
                </Box>
              </Box>
            </Box>
          )}

          <Box sx={{ p: 2, borderTop: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between' }}>
            <M3Button
              variant="outlined"
              size="md"
              icon="delete"
              onClick={() => setDeleteOpen(true)}
              data-testid="forms.submission.btn.delete"
              danger
            >
              {t('formsModule.submissions.detail.deleteBtn', 'Delete submission')}
            </M3Button>
          </Box>
        </Box>
      </Drawer>

      <ConfirmDialog
        open={deleteOpen}
        title={t('formsModule.submissions.deleteConfirm.title', 'Delete submission?')}
        message={t(
          'formsModule.submissions.deleteConfirm.body',
          'This soft-deletes the submission. It will no longer appear in the inbox or self-service lookups.',
        )}
        confirmLabel={t('formsModule.submissions.deleteConfirm.confirm', 'Delete')}
        confirmColor="error"
        onConfirm={() => {
          setDeleteOpen(false);
          deleteMutation.mutate();
        }}
        onCancel={() => setDeleteOpen(false)}
        loading={deleteMutation.isPending}
      />
    </>
  );
}

function StatusHistoryRow({
  entry,
  resolveActor,
}: {
  entry: SubmissionStatusLogEntry;
  resolveActor: (clerkId: string | null | undefined) => string | undefined;
}) {
  const { t } = useTranslation();
  const fromLabel = entry.from_status
    ? t(`formsModule.submissions.status.${entry.from_status}`, entry.from_status)
    : t('formsModule.submissions.detail.initial', 'created');
  const toLabel = t(`formsModule.submissions.status.${entry.to_status}`, entry.to_status);
  const actor = resolveActor(entry.changed_by);
  return (
    <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
      <Box component="span" sx={{ fontFamily: 'monospace' }}>
        {new Date(entry.created_at).toLocaleString()}
      </Box>
      {' · '}
      <Box component="span" sx={{ color: 'text.primary' }}>{fromLabel}</Box>
      {' → '}
      <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{toLabel}</Box>
      {actor ? ` · ${actor}` : ''}
    </Box>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(formatValue).join(', ');
  return JSON.stringify(v);
}

/** Single-line email shape check. Detection is by value, not field name,
 *  because Forja forms are arbitrary — we never assume an "email" field. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Build a `mailto:` that opens a reply pre-filled with `Re: [<ref>]` and the
 * whole original submission quoted (`> Label: value`). The reference code is
 * the subject anchor — deterministic and locale-neutral, so we don't have to
 * guess which arbitrary field is the "subject".
 */
function buildMailto(
  email: string,
  refCode: string,
  data: Record<string, unknown>,
): string {
  const subject = `Re: [${refCode}]`;
  const quoted = Object.entries(data)
    .map(([k, v]) => `> ${k}: ${formatValue(v)}`)
    .join('\n');
  // mailto wants RFC 6068 percent-encoding — URLSearchParams' "+" for spaces
  // is rendered literally by mail clients, so encode each part by hand.
  const subjectQ = `subject=${encodeURIComponent(subject)}`;
  const bodyQ = `body=${encodeURIComponent(`\n\n${quoted}`)}`;
  return `mailto:${encodeURIComponent(email)}?${subjectQ}&${bodyQ}`;
}
