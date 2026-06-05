@navigation
Feature: Navigation Management
  As a content author or admin
  I want to configure site navigation structure

  Scenario: Author can access navigation page
    Given I am logged in as "author"
    And I am on site "E2E Test Blog"
    When I navigate to "navigation"
    Then I should see "Navigation"
    And I take a screenshot "navigation/navigation-page"

  Scenario: Editor can access navigation page
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "navigation"
    Then I should see "Navigation"
