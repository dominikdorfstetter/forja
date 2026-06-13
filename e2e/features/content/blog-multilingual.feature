@content @blogs @multilingual
Feature: Multilingual Blog Content
  As an editor
  I want to create localized versions of blog posts

  Scenario: Editor creates a localized version of a post
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    And the site supports locales "en, de"
    When I navigate to "blogs"
    And I open post "e2e-test-post"
    And I switch to locale "de"
    And I fill in the blog editor with:
      | field   | value                              |
      | title   | E2E Testbeitrag                    |
      | content | Dies ist ein automatisierter Test. |
    And I save the post
    Then I should see "Blog saved"
    And I take a screenshot "content/blog-multilingual"
