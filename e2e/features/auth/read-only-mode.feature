@auth @read-only
Feature: Read-only enforcement for viewer role
  As a viewer (a read-only member)
  I want to browse the admin
  So that I can see content but can never reach a write action

  Background:
    Given I am logged in as "viewer"

  Scenario Outline: No write controls are reachable on the <page> page
    When I navigate to "<page>"
    Then I should not see any write controls
    And I take a screenshot "read-only/<page>"

    Examples:
      | page         |
      | blogs        |
      | pages        |
      | media        |
      | documents    |
      | legal        |
      | cv           |
      | navigation   |
      | social-links |
      | taxonomy     |
