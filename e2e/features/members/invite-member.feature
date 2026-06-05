@members @invite
Feature: Member Management
  As a site owner or admin
  I want to view and manage site members

  Scenario: Owner views member list
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "members"
    Then I should see "Members"
    And I should see "owner@test.forja.dev"
    And I take a screenshot "members/member-list"

  @bug @skip
  Scenario: Owner invites a new member as Editor
    # Blocked by https://github.com/dominikdorfstetter/forja/issues/178
    # Add Member button not visible for Owner role
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "members"
    And I click "Add Member"
    And I invite "editor@test.forja.dev" with role "Editor"
    Then I should see "editor@test.forja.dev" in the members list
    And I take a screenshot "members/member-invited"
