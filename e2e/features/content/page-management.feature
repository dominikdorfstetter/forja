@content @pages
Feature: Page Management
  As a content editor
  I want to create and manage static pages

  @skip
  Scenario: Editor creates a new page
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "pages"
    And I click "Create Page"
    And I fill in the page editor with:
      | field   | value             |
      | title   | About Us          |
      | slug    | about-us          |
      | content | About our company |
    And I save the page
    Then I should see "Page saved"
    And I take a screenshot "content/page-created"

  Scenario: Viewer can access pages
    Given I am logged in as "viewer"
    And I am on site "E2E Test Blog"
    When I navigate to "pages"
    Then I should see "Pages"

  @skip
  Scenario: Duplicate slug is rejected
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    And a page with slug "about-us" already exists
    When I navigate to "pages"
    And I click "Create Page"
    And I fill in the page editor with:
      | field | value    |
      | slug  | about-us |
    And I submit the form
    Then I should see a validation error for "slug"
