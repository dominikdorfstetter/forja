@content @blogs
Feature: Blog Publishing Workflow
  As a content team
  I want to create, edit, review, and publish blog posts
  Following the Author -> Editor -> Admin workflow

  @skip
  Scenario: Author creates a draft blog post
    Given I am logged in as "author"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    And I click "Create Blog"
    And I click "From Scratch"
    And I fill in the blog editor with:
      | field   | value                      |
      | title   | E2E Test Post              |
      | content | This is an automated test. |
    And I save as draft
    Then I should see "Draft saved"
    And I take a screenshot "content/blog-draft-created"

  @skip
  Scenario: Author can see their own drafts
    Given I am logged in as "author"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    Then I should see "E2E Test Post"

  @skip
  Scenario: Editor reviews and edits the draft
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    And I open post "E2E Test Post"
    And I edit the content to "Reviewed and updated content."
    And I save the post
    Then I should see "saved"
    And I take a screenshot "content/blog-editor-review"

  Scenario: Reviewer can access blogs page
    Given I am logged in as "reviewer"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    Then I should see "Blogs"

  Scenario: Viewer can access blogs page
    Given I am logged in as "viewer"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    Then I should see "Blogs"
    And I take a screenshot "content/blog-viewer"
