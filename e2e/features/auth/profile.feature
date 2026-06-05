@auth @profile
Feature: User Profile & Preferences
  As a logged-in user
  I want to view my profile and update preferences

  Scenario: User views their profile
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "profile"
    Then I should see "Profile"
    And I take a screenshot "auth/user-profile"

  Scenario: User changes color theme
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "settings"
    Then I should see "Theme"
    And I should see "Color Theme"
    And I take a screenshot "auth/settings-preferences"
