import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
import {
  startSiteExport,
  getSiteExportJob,
  downloadSiteExport,
} from '@/services/sites';
import type { SiteExportJob } from '@/types/api';
import ExportSiteAction from '../ExportSiteAction';

const queued: SiteExportJob = {
  id: 'job-1',
  status: 'queued',
  created_at: '2026-05-18T10:00:00Z',
};

const ready: SiteExportJob = {
  id: 'job-1',
  status: 'ready',
  created_at: '2026-05-18T10:00:00Z',
  download_url: '/api/v1/sites/site-1/export/job-1/download?token=tok',
  expires_at: '2026-05-25T10:00:00Z',
};

const failed: SiteExportJob = {
  id: 'job-1',
  status: 'failed',
  created_at: '2026-05-18T10:00:00Z',
  error: 'archive build crashed',
};

describe('ExportSiteAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(startSiteExport).mockResolvedValue(queued);
    vi.mocked(getSiteExportJob).mockResolvedValue(ready);
    vi.mocked(downloadSiteExport).mockResolvedValue(
      new Blob(['zip'], { type: 'application/zip' }),
    );
  });

  it('tracer: clicking Export starts a job, polls, and surfaces the download action when ready', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportSiteAction siteId="site-1" disabled={false} />);

    await user.click(screen.getByTestId('site-settings.danger.export.start'));

    await waitFor(() => expect(startSiteExport).toHaveBeenCalledWith('site-1'));
    await waitFor(() =>
      expect(getSiteExportJob).toHaveBeenCalledWith('site-1', 'job-1'),
    );

    expect(
      await screen.findByTestId('site-settings.danger.export.download'),
    ).toBeInTheDocument();
  });

  it('in-progress: while the job is running the trigger is disabled and cannot be re-fired', async () => {
    const user = userEvent.setup();
    vi.mocked(getSiteExportJob).mockResolvedValue({
      ...queued,
      status: 'running',
    });
    renderWithProviders(<ExportSiteAction siteId="site-1" disabled={false} />);

    await user.click(screen.getByTestId('site-settings.danger.export.start'));

    await waitFor(() =>
      expect(
        screen.getByTestId('site-settings.danger.export.start'),
      ).toBeDisabled(),
    );
    await user.click(screen.getByTestId('site-settings.danger.export.start'));
    expect(startSiteExport).toHaveBeenCalledTimes(1);
  });

  it('failed: a failed job surfaces the failure message and no download action', async () => {
    const user = userEvent.setup();
    vi.mocked(getSiteExportJob).mockResolvedValue(failed);
    renderWithProviders(<ExportSiteAction siteId="site-1" disabled={false} />);

    await user.click(screen.getByTestId('site-settings.danger.export.start'));

    expect(await screen.findByText(/export failed/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId('site-settings.danger.export.download'),
    ).not.toBeInTheDocument();
  });

  it('failed: the user can retry the export after a failure', async () => {
    const user = userEvent.setup();
    vi.mocked(getSiteExportJob).mockResolvedValue(failed);
    renderWithProviders(<ExportSiteAction siteId="site-1" disabled={false} />);

    await user.click(screen.getByTestId('site-settings.danger.export.start'));
    await screen.findByText(/export failed/i);

    await user.click(screen.getByTestId('site-settings.danger.export.start'));
    await waitFor(() =>
      expect(startSiteExport).toHaveBeenCalledTimes(2),
    );
  });

  it('download: clicking the ready action fetches the signed artifact and saves it', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock');
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    renderWithProviders(<ExportSiteAction siteId="site-1" disabled={false} />);

    await user.click(screen.getByTestId('site-settings.danger.export.start'));
    await user.click(
      await screen.findByTestId('site-settings.danger.export.download'),
    );

    await waitFor(() =>
      expect(downloadSiteExport).toHaveBeenCalledWith(
        '/api/v1/sites/site-1/export/job-1/download?token=tok',
      ),
    );
    expect(createObjectURL).toHaveBeenCalled();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('a11y: state transitions are announced via an aria-live status region', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportSiteAction siteId="site-1" disabled={false} />);

    const status = screen.getByTestId('site-settings.danger.export.status');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveAttribute('aria-live', 'polite');

    await user.click(screen.getByTestId('site-settings.danger.export.start'));

    await waitFor(() => expect(status).toHaveTextContent(/ready to download/i));
  });

  it('permission: the disabled prop blocks the trigger', () => {
    renderWithProviders(<ExportSiteAction siteId="site-1" disabled />);

    expect(
      screen.getByTestId('site-settings.danger.export.start'),
    ).toBeDisabled();
  });
});
