import { ReactNode } from 'react';
import { RedirectToSignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '@/store/AuthContext';

interface RequireAuthProps {
  children: ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { permission, loading } = useAuth();

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <CircularProgress />
            <Box sx={{ mt: 2 }}>Verifying permissions...</Box>
          </Box>
        ) : !permission ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              flexDirection: 'column',
              gap: 2,
              px: 3,
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" fontWeight={600}>
              No CMS Permissions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Your account does not have a CMS role assigned. Please contact an administrator
              to get access.
            </Typography>
          </Box>
        ) : (
          <>{children}</>
        )}
      </SignedIn>
    </>
  );
}
