@social-links
Feature: Social Links
  As a site admin
  I want to configure social media links for my site

  @skip
  Scenario: Admin configures social links
    Given I am logged in as "admin"
    And I am on site "E2E Test Blog"
    When I navigate to "social-links"
    And I add a social link:
      | field    | value                          |
      | platform | Twitter                        |
      | url      | https://twitter.com/forja_test |
    And I save social links
    Then I should see "Twitter" in the social links list
    And I take a screenshot "social-links/social-configured"

  Scenario: Admin can access social links page
    Given I am logged in as "admin"
    And I am on site "E2E Test Blog"
    When I navigate to "social-links"
    Then I should see "Social"
    And I take a screenshot "social-links/social-links-page"
