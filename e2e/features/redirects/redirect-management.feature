@redirects
Feature: Redirect Management
  As a content author or editor
  I want to manage URL redirects for my site

  Scenario: Author can access redirects page
    Given I am logged in as "author"
    And I am on site "E2E Test Blog"
    When I navigate to "redirects"
    Then I should see "Redirects"
    And I take a screenshot "redirects/redirects-page"

  Scenario: Editor can access redirects page
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "redirects"
    Then I should see "Redirects"
