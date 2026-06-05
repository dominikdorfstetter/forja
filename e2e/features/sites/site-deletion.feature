@sites @deletion
Feature: Site Deletion
  As a site owner
  I want to delete a site I no longer need

  Scenario: Owner can view site detail with delete option
    Given I am logged in as "owner"
    And I am on site "E2E Test Blog"
    When I navigate to "sites"
    And I click "E2E Test Blog"
    Then I should see "E2E Test Blog"
    And I take a screenshot "sites/site-detail"
