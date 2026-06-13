@content @documents @critical
Feature: Document Management
  As a content creator
  I want to create and manage documents

  Scenario: Editor can access documents page
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "documents"
    Then I should see "Documents"
    And I take a screenshot "content/documents-page"

  Scenario: Author can access documents page
    Given I am logged in as "author"
    And I am on site "E2E Test Blog"
    When I navigate to "documents"
    Then I should see "Documents"
