import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { deleteAccount, exportUserData } from '@/services/auth';
import { useAuth } from '@/store/AuthContext';

/** Trigger a browser download of `data` as pretty-printed JSON. */
function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * GDPR self-service actions on the profile page: Art. 20 data export
 * (JSON download) and Art. 17 account deletion (with its confirm dialog).
 */
export function useAccountDataActions() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const exportMutation = useMutation({
    mutationFn: () => exportUserData(),
    onSuccess: (data) => {
      downloadJson(data, `user-data-export-${new Date().toISOString().slice(0, 10)}.json`);
      enqueueSnackbar(t('profile.exportSuccess'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('profile.exportError'), { variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(),
    onSuccess: async () => {
      enqueueSnackbar(t('profile.deleteSuccess'), { variant: 'success' });
      setDeleteOpen(false);
      await logout();
      navigate('/login');
    },
    onError: () => {
      enqueueSnackbar(t('profile.deleteError'), { variant: 'error' });
    },
  });

  return { exportMutation, deleteMutation, deleteOpen, setDeleteOpen };
}
