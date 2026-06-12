import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { startSiteExport, getSiteExportJob } from '@/services/sites';
import type { SiteExportJob, SiteExportStatus } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

/** Poll cadence while a job is still queued/running. */
const POLL_INTERVAL_MS = 2500;

const isTerminal = (status: string | undefined): boolean =>
  status === 'ready' || status === 'failed';

export interface UseSiteExportResult {
  /** `idle` before the first start; otherwise the job's lifecycle state. */
  status: SiteExportStatus | 'idle';
  /** Enqueue an export job. No-op if one is already in flight. */
  start: () => void;
  /** True while the enqueue request itself is pending. */
  isStarting: boolean;
  /** Surfaced so the caller can toast a 403/409 from the enqueue. */
  startError: unknown;
  /** Expiring signed link — non-null only while `status === 'ready'`. */
  downloadUrl: string | null;
}

/**
 * Drives the async site-export state machine (#718): a one-shot enqueue
 * mutation feeds its job id into a polling query. The poll auto-stops on
 * a terminal status (`ready` | `failed`) by returning `false` from
 * `refetchInterval`, and TanStack Query unsubscribes the observer on
 * unmount — so there is no manual interval to leak. The snackbar is left
 * to the component: a data hook stays free of presentation side effects.
 */
export function useSiteExport(siteId: string): UseSiteExportResult {
  const [jobId, setJobId] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => startSiteExport(siteId),
    onSuccess: (job: SiteExportJob) => setJobId(job.id),
  });

  const poll = useQuery({
    queryKey: queryKeys.siteExport(siteId, jobId),
    queryFn: () => getSiteExportJob(siteId, jobId as string),
    enabled: jobId != null,
    refetchInterval: (query) =>
      isTerminal(query.state.data?.status) ? false : POLL_INTERVAL_MS,
  });

  const job = poll.data;
  const status: SiteExportStatus | 'idle' = job
    ? (job.status as SiteExportStatus)
    : startMutation.isPending || jobId != null
      ? 'queued'
      : 'idle';

  // A job still queued/running blocks a re-trigger; a terminal one
  // (`ready` | `failed`) does not — so the failed state can be retried
  // and a finished export re-run.
  const isInFlight =
    startMutation.isPending ||
    (jobId != null && !isTerminal(job?.status));

  return {
    status,
    start: () => {
      if (isInFlight) return;
      // Drop the stale terminal job so the next enqueue starts a fresh
      // poll cycle rather than re-reading the old (failed/ready) row.
      setJobId(null);
      startMutation.mutate();
    },
    isStarting: startMutation.isPending,
    startError: startMutation.error,
    downloadUrl: job?.download_url ?? null,
  };
}
