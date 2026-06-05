@ui @data-table
Feature: Data Table Behavior
  As a user
  I want to paginate, sort, and filter data tables

  Scenario: Blog list page loads correctly
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    Then I should see "Blogs"
    And I take a screenshot "ui/blog-list"

  @skip
  Scenario: Pagination on blog list
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    And more than 10 blog posts exist
    When I navigate to "blogs"
    Then I should see pagination controls
    When I click "Next Page"
    Then I should see the next page of posts

  @skip
  Scenario: Sorting blog posts by date
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    And I sort by "Created" descending
    Then posts should be ordered by creation date descending

  @skip
  Scenario: Filtering blog posts by status
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    And I filter by status "Draft"
    Then I should only see draft posts
