import { useTranslation } from 'react-i18next';
import { STATUS_TONES } from '@/utils/submissionStatus';
import type { FormSubmissionStatus } from '@/types/api';

/**
 * Color-coded submission status badge. Shared by the inbox table and the
 * detail drawer so the status vocabulary (label + tone) lives in one place.
 */
export default function StatusPill({
  status,
}: {
  status: FormSubmissionStatus;
}) {
  const { t } = useTranslation();
  const tone = STATUS_TONES[status];
  return (
    <span
      data-testid={`forms.submission.pill.${status}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
      }}
    >
      {t(`formsModule.submissions.status.${status}`, status)}
    </span>
  );
}
