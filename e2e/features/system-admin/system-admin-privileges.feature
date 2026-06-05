@system-admin
Feature: System Admin Privileges
  As a system administrator
  I want elevated access to all sites and user management

  Scenario: System admin can access any site
    Given I am logged in as "system_admin"
    And a site "E2E Test Blog" exists that I am not a member of
    When I navigate to site "E2E Test Blog"
    Then I should have full access

  Scenario: System admin can see all users
    Given I am logged in as "system_admin"
    When I navigate to "clerk-users"
    Then I should see the full user list
    And I take a screenshot "system-admin/all-users"

  Scenario: Non-system-admin cannot see clerk-users
    Given I am logged in as "owner"
    Then I should not see "Users" in the global navigation
