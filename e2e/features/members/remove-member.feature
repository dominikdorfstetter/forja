@members @remove
Feature: Member Access Control
  As a site member
  I want appropriate access based on my role

  Scenario: Viewer sees read-only badge on dashboard
    Given I am logged in as "viewer"
    And I am on site "E2E Test Blog"
    When I navigate to "dashboard"
    Then I should see "read-only"
    And I take a screenshot "members/viewer-read-only"
