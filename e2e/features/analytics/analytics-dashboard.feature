@analytics
Feature: Analytics Dashboard
  As a site member
  I want to view site traffic analytics
  Note: Analytics must be enabled as a site module

  Scenario: Admin views analytics page
    Given I am logged in as "admin"
    And I am on site "E2E Test Blog"
    When I navigate to "analytics"
    Then I should see "Analytics"
    And I take a screenshot "analytics/analytics-dashboard"
