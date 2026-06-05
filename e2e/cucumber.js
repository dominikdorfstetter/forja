module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: [
      'support/**/*.ts',
      'step-definitions/**/*.ts',
    ],
    tags: 'not @skip',
    // Features are ordered so that earlier scenarios produce data
    // that later scenarios verify (organic test flow).
    paths: [
      // 0. Welcome — signed-out marketing surface + Imprint (no dependencies)
      'features/welcome/welcome.feature',
      // 1. Auth — login, profile, tour (no dependencies)
      'features/auth/login.feature',
      'features/auth/quick-tour.feature',
      'features/auth/profile.feature',
      'features/auth/account-deletion.feature',
      // 2. Sites — create/manage sites
      'features/sites/site-creation.feature',
      'features/sites/site-settings.feature',
      'features/sites/site-deletion.feature',
      // 3. Members — invite, roles, ownership (depends on site)
      'features/members/invite-member.feature',
      'features/members/change-role.feature',
      'features/members/remove-member.feature',
      'features/members/transfer-ownership.feature',
      // 4. Content — create, edit, publish (depends on site + members)
      'features/content/blog-publishing.feature',
      'features/content/blog-multilingual.feature',
      'features/content/page-management.feature',
      'features/content/document-management.feature',
      // 5. Infrastructure — api keys, media, webhooks, nav, redirects
      'features/api-keys/api-key-management.feature',
      'features/media/media-library.feature',
      'features/webhooks/webhook-management.feature',
      'features/navigation/navigation-management.feature',
      'features/redirects/redirect-management.feature',
      'features/social-links/social-links.feature',
      // 6. Federation
      'features/federation/federation-management.feature',
      // 7. Analytics & activity (depend on prior actions having generated data)
      'features/analytics/analytics-dashboard.feature',
      'features/activity/activity-log.feature',
      'features/activity/notifications.feature',
      // 8. System admin & UI patterns
      'features/system-admin/system-admin-privileges.feature',
      'features/ui/empty-states.feature',
      'features/ui/data-table-behavior.feature',
    ],
    format: [
      'progress-bar',
      'json:reports/cucumber-report.json',
      'html:reports/cucumber-report.html',
    ],
    formatOptions: {
      snippetInterface: 'async-await',
    },
  },
};
