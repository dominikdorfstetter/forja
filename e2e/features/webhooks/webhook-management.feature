@webhooks
Feature: Webhook Management
  As a site admin
  I want to manage webhooks for external integrations

  Scenario: Admin can access webhooks page
    Given I am logged in as "admin"
    And I am on site "E2E Test Blog"
    When I navigate to "webhooks"
    Then I should see "Webhooks"
    And I take a screenshot "webhooks/webhooks-page"

  Scenario: Editor cannot manage webhooks
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    Then I should not see "Webhooks" in the navigation
