@auth @account-deletion
Feature: Account Deletion
  As a user
  I want to manage my account deletion from the profile page

  Scenario: User sees delete account option on profile
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "profile"
    Then I should see "Delete Account"
    And I should see "Export My Data"
    And I take a screenshot "auth/profile-data-privacy"
