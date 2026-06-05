@members @roles
Feature: Member Roles
  As a site owner
  I want to see member roles displayed correctly

  Scenario: Owner sees all member roles
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "members"
    Then I should see "Owner"
    And I should see "Admin"
    And I should see "Editor"
    And I should see "Author"
    And I should see "Reviewer"
    And I should see "Viewer"
    And I take a screenshot "members/all-roles"
