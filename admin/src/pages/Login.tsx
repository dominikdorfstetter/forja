import { SignIn } from '@clerk/clerk-react';
import { Box, Container } from '@mui/material';

export default function LoginPage() {
  return (
    <Container
      component="main"
      maxWidth="xs"
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box>
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"
        />
      </Box>
    </Container>
  );
}
