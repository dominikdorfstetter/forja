import 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { SignUp } from '@clerk/clerk-react';
import { SnackbarProvider, MaterialDesignContent } from 'notistack';
import { styled } from '@mui/material/styles';
import { Box, Button, Container, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeModeProvider } from '@/theme';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Pages
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/DashboardHome';
import SitesPage from '@/pages/Sites';
import SiteDetailPage from '@/pages/SiteDetail';
import BlogsPage from '@/pages/Blogs';
import MediaPage from '@/pages/Media';
import DocumentsPage from '@/pages/Documents';
import PagesPage from '@/pages/Pages';
import PageDetailPage from '@/pages/PageDetail';
import LegalPage from '@/pages/Legal';
import LegalDocumentDetailPage from '@/pages/LegalDocumentDetail';
import CVPage from '@/pages/CV';
import NavigationPage from '@/pages/Navigation';
import SocialLinksPage from '@/pages/SocialLinks';
import MembersPage from '@/pages/Members';
import ApiKeysPage from '@/pages/ApiKeys';
import TaxonomyPage from '@/pages/Taxonomy';
import WebhooksPage from '@/pages/Webhooks';
import RedirectsPage from '@/pages/Redirects';
import ContentTemplatesPage from '@/pages/ContentTemplates';
import LocalesPage from '@/pages/Locales';
import SettingsPage from '@/pages/Settings';
import ApiDocsPage from '@/pages/ApiDocs';
import ProfilePage from '@/pages/Profile';
import ClerkUsersPage from '@/pages/ClerkUsers';
import ActivityLogPage from '@/pages/ActivityLog';
import NotificationsPage from '@/pages/Notifications';
import NotFoundPage from '@/pages/NotFound';

// Components
import Layout from '@/components/Layout';
import RequireAuth from '@/components/auth/RequireAuth';
import { SiteProvider } from '@/store/SiteContext';
import { AuthProvider } from '@/store/AuthContext';
import { NavigationGuardProvider } from '@/store/NavigationGuardContext';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import BlogDetailPage from '@/pages/BlogDetail';
import MyDraftsPage from '@/pages/MyDrafts';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const StyledMaterialDesignContent = styled(MaterialDesignContent)({
  '&.notistack-MuiContent-success': { borderRadius: 8 },
  '&.notistack-MuiContent-error': { borderRadius: 8 },
  '&.notistack-MuiContent-warning': { borderRadius: 8 },
  '&.notistack-MuiContent-info': { borderRadius: 8 },
});

function App() {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <Box sx={{ textAlign: 'center', mt: 12, px: 2 }}>
          <Typography variant="h5" gutterBottom>Something went wrong</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            An unexpected error occurred.
          </Typography>
          {error && (
            <Typography variant="body2" component="pre" sx={{ mb: 3, whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: 'error.main' }}>
              {error.message}
            </Typography>
          )}
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </Box>
      )}
    >
    <ThemeModeProvider>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        Components={{
          success: StyledMaterialDesignContent,
          error: StyledMaterialDesignContent,
          warning: StyledMaterialDesignContent,
          info: StyledMaterialDesignContent,
        }}
      >
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename="/dashboard">
            <AuthProvider>
            <SiteProvider>
            <NavigationGuardProvider>
              <Routes>
                <Route path="/login/*" element={<LoginPage />} />
                <Route
                  path="/sign-up/*"
                  element={
                    <Container maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box>
                        <SignUp routing="path" path="/sign-up" signInUrl="/login" fallbackRedirectUrl="/dashboard" />
                      </Box>
                    </Container>
                  }
                />

                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <Layout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="my-drafts" element={<MyDraftsPage />} />
                  <Route path="sites" element={<SitesPage />} />
                  <Route path="sites/:id" element={<SiteDetailPage />} />
                  <Route path="blogs" element={<BlogsPage />} />
                  <Route path="blogs/:id" element={<BlogDetailPage />} />
                  <Route path="pages" element={<PagesPage />} />
                  <Route path="pages/:id" element={<PageDetailPage />} />
                  <Route path="media" element={<MediaPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="legal" element={<LegalPage />} />
                  <Route path="legal/:id" element={<LegalDocumentDetailPage />} />
                  <Route path="cv" element={<CVPage />} />
                  <Route path="navigation" element={<NavigationPage />} />
                  <Route path="social-links" element={<SocialLinksPage />} />
                  <Route path="activity" element={<ActivityLogPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="clerk-users" element={<ClerkUsersPage />} />
                  <Route path="api-keys" element={<ApiKeysPage />} />
                  <Route path="taxonomy" element={<TaxonomyPage />} />
                  <Route path="webhooks" element={<WebhooksPage />} />
                  <Route path="content-templates" element={<ContentTemplatesPage />} />
                  <Route path="redirects" element={<RedirectsPage />} />
                  <Route path="locales" element={<LocalesPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="api-docs" element={<ApiDocsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </NavigationGuardProvider>
            </SiteProvider>
            </AuthProvider>
          </BrowserRouter>
          
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </SnackbarProvider>
      </LocalizationProvider>
    </ThemeModeProvider>
    </ErrorBoundary>
  );
}

export default App;