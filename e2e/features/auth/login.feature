@auth @critical
Feature: Authentication
  As a user with a Clerk account
  I want to log into the Forja dashboard
  So that I can manage my sites

  Scenario Outline: Successful login for each role
    Given I am on the login page
    When I log in as "<role>"
    Then I should see the dashboard
    And I take a screenshot "auth/login-<role>"

    Examples:
      | role         |
      | viewer       |
      | reviewer     |
      | author       |
      | editor       |
      | admin        |
      | owner        |
      | system_admin |

  Scenario: Redirect to login when unauthenticated
    Given I am not logged in
    When I navigate to "dashboard"
    Then I should be redirected to the login page

  Scenario: Session persists after page reload
    Given I am logged in as "editor"
    When I reload the page
    Then I should still be on the dashboard
