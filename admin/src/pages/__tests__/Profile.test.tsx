import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { exportUserData, getPiiInventory, getProfile } from '@/services/auth';
import type { PiiInventoryResponse, ProfileResponse } from '@/types/api';
import ProfilePage from '@/pages/Profile';

const mockProfile: ProfileResponse = {
  id: 'clerk-user-1',
  email: 'test@example.com',
  name: 'Test User',
  image_url: null,
  role: 'admin',
  permission: 'Admin',
  site_id: null,
  auth_method: 'clerk_jwt',
  created_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-06-01T00:00:00Z',
  memberships: [],
  is_system_admin: false,
} as unknown as ProfileResponse;

const mockInventory: PiiInventoryResponse = {
  generated_at: '2026-06-12T12:00:00Z',
  entities: [
    {
      table: 'contents',
      description: 'Content spine shared by blog, page, document, legal, CV and project entries',
      fields: [
        {
          field: 'created_by',
          purpose: 'Author attribution for editorial accountability',
          legal_basis: 'Art. 6(1)(f) GDPR — legitimate interest',
          retention_behavior: 'anonymize_on_erasure',
          record_count: 3,
        },
      ],
    },
    {
      table: 'audit_logs',
      description: 'Security audit trail',
      fields: [
        {
          field: 'user_id',
          purpose: 'Accountability for administrative actions',
          legal_basis: 'Art. 6(1)(f) GDPR — legitimate interest',
          retention_behavior: 'retention_purged',
          record_count: 12,
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProfile).mockResolvedValue(mockProfile);
  vi.mocked(getPiiInventory).mockResolvedValue(mockInventory);
});

describe('ProfilePage stored-data transparency (PII inventory)', () => {
  it('lists every identity-bearing field with the user record count', async () => {
    renderWithProviders(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('pii-inventory.table')).toBeInTheDocument();
    });

    expect(screen.getByText('contents.created_by')).toBeInTheDocument();
    expect(screen.getByText('Author attribution for editorial accountability')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('audit_logs.user_id')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('explains what happens to each field on erasure', async () => {
    renderWithProviders(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('pii-inventory.table')).toBeInTheDocument();
    });

    expect(screen.getByText('Removed when you delete your account')).toBeInTheDocument();
    expect(screen.getByText('Auto-deleted by the retention purge')).toBeInTheDocument();
  });

  it('keeps export and deletion available when the inventory fails to load', async () => {
    vi.mocked(getPiiInventory).mockRejectedValue(new Error('boom'));
    renderWithProviders(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('export-data-btn')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('pii-inventory.table')).not.toBeInTheDocument();
  });

  it('exports the user data as a JSON download on request', async () => {
    vi.mocked(exportUserData).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderWithProviders(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('export-data-btn')).toBeInTheDocument();
    });

    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = vi.fn();

    await user.click(screen.getByTestId('export-data-btn'));

    await waitFor(() => {
      expect(exportUserData).toHaveBeenCalledTimes(1);
    });
  });
});
