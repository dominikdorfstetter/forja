@activity
Feature: Activity Log
  As a site admin
  I want to view the audit trail of site changes
  Activity entries are created organically by other actions (content creation, member changes, etc.)

  Scenario: Admin views activity log page
    Given I am logged in as "admin"
    And I am on site "E2E Test Blog"
    When I navigate to "activity"
    Then I should see "Activity"
    And I take a screenshot "activity/activity-log"
