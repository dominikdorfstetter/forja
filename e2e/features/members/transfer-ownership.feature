@members @ownership
Feature: Ownership Display
  As a site owner
  I want to see ownership clearly indicated

  Scenario: Owner role is displayed in member list
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "members"
    Then I should see "owner@test.forja.dev"
    And I should see "Owner"
    And I take a screenshot "members/ownership-display"
