@activity @notifications
Feature: Notifications
  As a user
  I want to view and manage my notifications
  Notifications are created organically by other actions

  Scenario: User can open notifications panel
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I click the notifications icon
    Then I should see the notifications panel
    And I take a screenshot "activity/notifications-panel"
