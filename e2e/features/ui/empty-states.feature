@ui @empty-states
Feature: Empty States
  As a user
  I want to see helpful empty state messages when there is no content

  Scenario: Empty blog list on a brand-new site
    # The shared test site accumulates content as the suite runs, so this
    # journey provisions its own fresh site to exercise the empty state.
    Given I am logged in as "owner"
    When I navigate to "sites"
    And I click "Create Site"
    And I complete the site creation wizard with:
      | field | value            |
      | name  | Empty State Site |
    And I am on site "Empty State Site"
    And I navigate to "blogs"
    Then I should see an empty state message
    And I take a screenshot "ui/empty-blogs"
