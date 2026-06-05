@ui @empty-states
Feature: Empty States
  As a user
  I want to see helpful empty state messages when there is no content

  Scenario: Empty blog list on new site
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    Then I should see an empty state message
    And I take a screenshot "ui/empty-blogs"
