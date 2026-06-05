import { ReactNode } from 'react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '@/store/AuthContext';
import WelcomePage from '@/pages/Welcome';

interface RequireAuthProps {
  children: ReactNode;
}

function LoadingScreen() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 2 }}>
      <CircularProgress />
      <Box sx={{ mt: 2 }}>Verifying permissions…</Box>
    </Box>
  );
}

function NoPermissions() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 2, px: 3, textAlign: 'center' }}>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>No CMS Permissions</Typography>
      <Typography variant="body1" color="text.secondary">
        Your account does not have a CMS role assigned. Please contact an administrator to get access.
      </Typography>
    </Box>
  );
}

function AuthenticatedContent({ children }: { children: ReactNode }) {
  const { permission, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!permission) return <NoPermissions />;
  return <>{children}</>;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { isGuest, permission, loading } = useAuth();

  // Guest mode: render dashboard alongside Clerk components.
  // Clerk's SignedOut/SignedIn stay mounted (hidden) to avoid DOM teardown
  // conflicts. The guest dashboard renders as a sibling.
  return (
    <>
      <div style={isGuest ? { display: 'none' } : undefined}>
        <SignedOut>
          <WelcomePage />
        </SignedOut>
        <SignedIn>
          <AuthenticatedContent>{children}</AuthenticatedContent>
        </SignedIn>
      </div>
      {isGuest && (
        loading ? <LoadingScreen /> :
        permission ? <>{children}</> :
        <NoPermissions />
      )}
    </>
  );
}
