@api-keys
Feature: API Key Management
  As a site admin
  I want to manage API keys with appropriate permission caps

  @skip
  Scenario: Owner creates a Master API key
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "api-keys"
    And I create an API key with:
      | field      | value      |
      | name       | Master Key |
      | permission | Master     |
    Then I should see the generated API key
    And the key should only be shown once
    And I take a screenshot "api-keys/master-key-created"

  @skip
  Scenario: Admin creates an Admin API key
    Given I am logged in as "admin"
    And I am on site "E2E Test Blog"
    When I navigate to "api-keys"
    And I create an API key with:
      | field      | value     |
      | name       | Admin Key |
      | permission | Admin     |
    Then I should see the generated API key

  @skip
  Scenario: Editor is capped at Write permission
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "api-keys"
    And I click "Create API Key"
    Then the permission dropdown should not contain "Master"
    And the permission dropdown should not contain "Admin"
    And I take a screenshot "api-keys/editor-permission-cap"

  @skip
  Scenario: Author is capped at Write permission
    Given I am logged in as "author"
    And I am on site "E2E Test Blog"
    When I navigate to "api-keys"
    And I click "Create API Key"
    Then the permission dropdown should not contain "Master"
    And the permission dropdown should not contain "Admin"

  Scenario: Admin can access API keys page
    Given I am logged in as "admin"
    And I am on site "E2E Test Blog"
    When I navigate to "api-keys"
    Then I should see "API"

  @skip
  Scenario: Owner revokes an API key
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    And an API key "Master Key" exists
    When I navigate to "api-keys"
    And I revoke the key "Master Key"
    And I confirm the revocation
    Then "Master Key" should no longer be in the key list
    And I take a screenshot "api-keys/key-revoked"

  @skip
  Scenario: API key with duplicate name is rejected
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    And an API key "Admin Key" exists
    When I navigate to "api-keys"
    And I create an API key with:
      | field | value     |
      | name  | Admin Key |
    And I submit the form
    Then I should see a validation error for "name"

  @skip
  Scenario: API key with custom rate limit
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "api-keys"
    And I create an API key with:
      | field             | value        |
      | name              | Rate Limited |
      | permission        | Read         |
      | rate_limit        | 100          |
      | rate_limit_window | 60           |
    Then I should see the generated API key
