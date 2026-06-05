@auth @tour @skip
Feature: Quick Tour
  As a new user
  I want to see a guided tour of the dashboard
  So that I can learn the key features
  Note: Only the viewer test user has the tour enabled (others have it pre-completed in seed data)
  Note: Skipped because tour depends on timing and i18n keys may differ

  Scenario: New user sees the quick tour on first visit
    Given I am logged in as "viewer"
    And I am on site "E2E Test Blog"
    When I navigate to "dashboard"
    Then I should see "Skip tour"
    And I take a screenshot "auth/quick-tour"

  Scenario: User can skip the quick tour
    Given I am logged in as "viewer"
    And I am on site "E2E Test Blog"
    When I navigate to "dashboard"
    And I click "Skip tour"
    Then I should not see "Skip tour"
    And I take a screenshot "auth/quick-tour-dismissed"
