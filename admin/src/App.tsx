import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { SignUp } from '@clerk/clerk-react';
import { SnackbarProvider, MaterialDesignContent } from 'notistack';
import { styled } from '@mui/material/styles';
import { Box, Button, CircularProgress, Container, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeModeProvider } from '@/theme';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Pages
import LoginPage from '@/pages/Login';
import DashboardPage from '@/pages/DashboardHome';
import SitesPage from '@/pages/Sites';
import DeletedSitesPage from '@/pages/DeletedSitesPage';
import SiteDetailPage from '@/pages/SiteDetail';
import BlogsPage from '@/pages/Blogs';
import FormsPage from '@/pages/Forms';
import FormDetailPage from '@/pages/FormDetail';
import FormTemplatesPage from '@/pages/FormTemplates';
import FormSubmissionsPage from '@/pages/FormSubmissions';
import MediaPage from '@/pages/Media';
import PagesPage from '@/pages/Pages';
import PageDetailPage from '@/pages/PageDetail';
import LegalPage from '@/pages/Legal';
import LegalDetailPage from '@/pages/legal-detail';
import PortfolioPage from '@/pages/Portfolio';
import NavigationPage from '@/pages/Navigation';
import SocialLinksPage from '@/pages/SocialLinks';
import MembersPage from '@/pages/Members';
import ApiKeysPage from '@/pages/ApiKeys';
import TaxonomyPage from '@/pages/Taxonomy';
import UiStringsPage from '@/pages/ui-strings/UiStringsPage';
import WebhooksPage from '@/pages/Webhooks';
import RedirectsPage from '@/pages/Redirects';
import ContentTemplatesPage from '@/pages/ContentTemplates';
import LocalesPage from '@/pages/Locales';
import ApiDocsPage from '@/pages/ApiDocs';
import ProfilePage from '@/pages/Profile';
import ClerkUsersPage from '@/pages/ClerkUsers';
import UserDetailPage from '@/pages/system/UserDetailPage';
import ActivityLogPage from '@/pages/ActivityLog';
import NotificationsPage from '@/pages/Notifications';
// Lazy-load analytics pages (recharts is heavy)
const AnalyticsOverview = lazy(() => import('@/pages/Analytics/AnalyticsOverview'));
const AnalyticsPageDetail = lazy(() => import('@/pages/Analytics/AnalyticsPageDetail'));
const CollectionsListPage = lazy(() => import('@/pages/collections/CollectionsListPage'));
const NewCollectionPage = lazy(() => import('@/pages/collections/NewCollectionPage'));
const EditCollectionPage = lazy(() => import('@/pages/collections/EditCollectionPage'));
const CollectionEntriesPage = lazy(() => import('@/pages/collections/CollectionEntriesPage'));
const CollectionEntryEditPage = lazy(() => import('@/pages/collections/CollectionEntryEditPage'));
import TrashPage from '@/pages/TrashPage';
import NotFoundPage from '@/pages/NotFound';

// Site Settings sub-pages
import SiteSettingsLayout from '@/pages/site-settings/SiteSettingsLayout';
import SiteSettingsOverview from '@/pages/site-settings/OverviewPage';
import SiteSettingsContent from '@/pages/site-settings/ContentPage';
import SiteSettingsModules from '@/pages/site-settings/ModulesPage';
import SiteSettingsSeo from '@/pages/site-settings/SeoPage';
import CodeInjectionPage from '@/pages/site-settings/CodeInjectionPage';
import FormsSettingsPage from '@/pages/site-settings/FormsSettingsPage';
import FaviconPage from '@/pages/site-settings/FaviconPage';
import DangerZonePage from '@/pages/site-settings/DangerZonePage';
import AiSettingsPage from '@/pages/ai-settings/AiSettingsPage';
import AiUsagePage from '@/pages/ai-settings/AiUsagePage';

// System administration pages
import SystemLayout from '@/pages/system/SystemLayout';
import SystemDashboardPage from '@/pages/system/SystemDashboardPage';
import SystemSitesPage from '@/pages/system/SystemSitesPage';

// Components
import Layout from '@/components/Layout';
import RequireAuth from '@/components/auth/RequireAuth';
import { SiteProvider } from '@/store/SiteContext';
import { AuthProvider } from '@/store/AuthContext';
import { UserPreferencesProvider } from '@/store/UserPreferencesContext';
import { HelpStateProvider } from '@/store/HelpStateContext';
import { NavigationGuardProvider } from '@/store/NavigationGuardContext';
import { SaveBarProvider } from '@/store/SaveBarContext';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import BlogDetailPage from '@/pages/BlogDetail';
import MyDraftsPage from '@/pages/MyDrafts';
import WelcomeImprint from '@/components/welcome/WelcomeImprint';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

/**
 * M3 Expressive notification toast. Overrides notistack's per-variant
 * paint so toasts speak the same tonal language as the rest of the app:
 *   success → tertiary-container (green)
 *   error   → err tint
 *   warning → warn-container
 *   info    → surface-container-high (neutral)
 * 14px radius, opsz-13 / wght-500 axis, 1px outline-variant stroke,
 * layered shadow, and a subtle backdrop blur so the toast reads as a
 * floating surface layer rather than a solid bar.
 */
const StyledMaterialDesignContent = styled(MaterialDesignContent)({
  borderRadius: 14,
  padding: '8px 14px',
  minHeight: 48,
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: 0.1,
  fontVariationSettings: '"wght" 500, "opsz" 13',
  boxShadow: '0 12px 28px -10px rgb(0 0 0 / 0.5)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid var(--outline-variant)',
  '&.notistack-MuiContent-success': {
    background: 'color-mix(in oklch, var(--tertiary-container) 92%, transparent)',
    color: 'var(--on-tertiary-container)',
  },
  '&.notistack-MuiContent-error': {
    background: 'color-mix(in oklch, var(--err) 16%, var(--surface-container-high))',
    color: 'var(--err)',
    border: '1px solid color-mix(in oklch, var(--err) 45%, transparent)',
  },
  '&.notistack-MuiContent-warning': {
    background: 'var(--warn-container)',
    color: 'var(--on-warn-container)',
  },
  '&.notistack-MuiContent-info': {
    background: 'var(--surface-container-high)',
    color: 'var(--on-surface)',
  },
});

function App() {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <Box role="alert" data-testid="app.error.boundary" sx={{ textAlign: 'center', mt: 12, px: 2 }}>
          <Typography variant="h5" gutterBottom>Something went wrong</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            An unexpected error occurred.
          </Typography>
          {error && (
            <Typography variant="body2" component="pre" sx={{ mb: 3, whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: 'error.main' }}>
              {error.message}
            </Typography>
          )}
          <Button data-testid="app.btn.reload" variant="contained" onClick={() => window.location.reload()}>
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
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        classes={{ containerAnchorOriginTopRight: 'forja-snackbar-top-right' }}
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
            <UserPreferencesProvider>
            <HelpStateProvider>
            <SiteProvider>
            <NavigationGuardProvider>
            <SaveBarProvider>
              <Routes>
                <Route path="/login/*" element={<LoginPage />} />
                {/* Public: the GDPR Imprint is reachable signed-out (#812) */}
                <Route path="/imprint" element={<WelcomeImprint />} />
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
                  path="/sites"
                  element={
                    <RequireAuth>
                      <SitesPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/sites/deleted"
                  element={
                    <RequireAuth>
                      <DeletedSitesPage />
                    </RequireAuth>
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
                  <Route index element={<DashboardPage />} />
                  <Route path="dashboard" element={<Navigate to="/" replace />} />
                  <Route path="my-drafts" element={<MyDraftsPage />} />
                  <Route path="trash" element={<TrashPage />} />
                  <Route path="sites/:id" element={<SiteDetailPage />} />
                  <Route path="site-detail" element={<SiteDetailPage />} />
                  <Route path="blogs" element={<BlogsPage />} />
                  <Route path="blogs/templates" element={<ContentTemplatesPage />} />
                  <Route path="blogs/:id" element={<BlogDetailPage />} />
                  <Route path="pages" element={<PagesPage />} />
                  <Route path="pages/:id" element={<PageDetailPage />} />
                  <Route path="media" element={<MediaPage />} />
                  <Route path="media/:tab" element={<MediaPage />} />
                  <Route path="documents" element={<Navigate to="/media/documents" replace />} />
                  <Route path="legal" element={<LegalPage />} />
                  <Route path="legal/:id" element={<LegalDetailPage />} />
                  <Route path="portfolio" element={<PortfolioPage />} />
                  <Route path="portfolio/:tab" element={<PortfolioPage />} />
                  <Route path="collections" element={<CollectionsListPage />} />
                  <Route path="collections/new" element={<NewCollectionPage />} />
                  <Route path="collections/:typeKey/edit" element={<EditCollectionPage />} />
                  <Route path="collections/:typeKey" element={<CollectionEntriesPage />} />
                  <Route
                    path="collections/:typeKey/entries/:entryId"
                    element={<CollectionEntryEditPage />}
                  />
                  <Route path="forms" element={<FormsPage />} />
                  <Route path="forms/templates" element={<FormTemplatesPage />} />
                  <Route path="forms/:id" element={<FormDetailPage />} />
                  <Route path="forms/:id/submissions" element={<FormSubmissionsPage />} />
                  <Route path="cv" element={<Navigate to="/portfolio" replace />} />
                  <Route path="navigation" element={<NavigationPage />} />
                  <Route path="social-links" element={<SocialLinksPage />} />
                  <Route path="activity" element={<ActivityLogPage />} />
                  <Route path="analytics" element={<Suspense fallback={<CircularProgress sx={{ m: 4 }} />}><AnalyticsOverview /></Suspense>} />
                  <Route path="analytics/page/:encodedPath" element={<Suspense fallback={<CircularProgress sx={{ m: 4 }} />}><AnalyticsPageDetail /></Suspense>} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  {/* Redirects: Members / API keys / Webhooks moved under /site-settings */}
                  <Route path="members" element={<Navigate to="/site-settings/members" replace />} />
                  <Route path="clerk-users" element={<Navigate to="/system/users" replace />} />
                  <Route path="api-keys" element={<Navigate to="/site-settings/api-keys" replace />} />
                  <Route path="taxonomy" element={<TaxonomyPage />} />
                  <Route path="ui-strings" element={<UiStringsPage />} />
                  <Route path="webhooks" element={<Navigate to="/site-settings/webhooks" replace />} />
                  <Route path="redirects" element={<RedirectsPage />} />
                  <Route path="locales" element={<LocalesPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="site-settings" element={<SiteSettingsLayout />}>
                    <Route index element={<SiteSettingsOverview />} />
                    <Route path="content" element={<SiteSettingsContent />} />
                    <Route path="modules" element={<SiteSettingsModules />} />
                    <Route path="seo" element={<SiteSettingsSeo />} />
                    <Route path="favicon" element={<FaviconPage />} />
                    <Route path="code-injection" element={<CodeInjectionPage />} />
                    <Route path="ai" element={<AiSettingsPage />} />
                    <Route path="ai/usage" element={<AiUsagePage />} />
                    <Route path="forms" element={<FormsSettingsPage />} />
                    {/* Integrated under Settings (moved from top-level routes) */}
                    <Route path="api-keys" element={<ApiKeysPage />} />
                    <Route path="webhooks" element={<WebhooksPage />} />
                    <Route path="members" element={<MembersPage />} />
                    <Route path="danger" element={<DangerZonePage />} />
                  </Route>
                  <Route path="system" element={<SystemLayout />}>
                    <Route index element={<SystemDashboardPage />} />
                    <Route path="sites" element={<SystemSitesPage />} />
                    <Route path="users" element={<ClerkUsersPage />} />
                    <Route path="users/:id" element={<UserDetailPage />} />
                    <Route path="languages" element={<LocalesPage />} />
                  </Route>
                  <Route path="settings" element={<Navigate to="/site-settings" replace />} />
                  <Route path="api-docs" element={<ApiDocsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </SaveBarProvider>
            </NavigationGuardProvider>
            </SiteProvider>
            </HelpStateProvider>
            </UserPreferencesProvider>
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