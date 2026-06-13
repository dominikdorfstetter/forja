@sites @creation
Feature: Site Creation
  As an authenticated user
  I want to create and configure a new site
  So that I can manage my content

  Scenario: Any authenticated user creates a new site
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "sites"
    And I click "Create Site"
    And I complete the site creation wizard with:
      | field       | value          |
      | name        | E2E New Site   |
      | description | Automated test |
    # Creation keeps the currently selected site — the new site shows up
    # in the launcher's site list.
    And I navigate to "sites"
    Then I should see "E2E New Site"
    And I take a screenshot "sites/site-created"

  Scenario: System admin creates a site
    Given I am logged in as "system_admin"
    When I navigate to "sites"
    And I click "Create Site"
    And I complete the site creation wizard with:
      | field | value      |
      | name  | Admin Test |
    Then I should see "Admin Test"

  Scenario: Site creation form validates required fields
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "sites"
    And I click "Create Site"
    And I click "Next"
    Then I should see a validation error for "name"
