@sites @settings
Feature: Site Settings
  As a site owner or admin
  I want to manage site configuration and preferences

  Scenario: Owner can access settings page
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "settings"
    Then I should see "Settings"
    And I take a screenshot "sites/site-settings"

  Scenario: Admin can access settings page
    Given I am logged in as "admin"
    And I am on site "E2E Test Blog"
    When I navigate to "settings"
    Then I should see "Settings"
