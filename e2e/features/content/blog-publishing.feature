@content @blogs @critical
Feature: Blog Publishing Workflow
  As a content team
  I want to create, edit, and publish blog posts
  So that published content is served to client sites by the content API

  Scenario: Author creates a draft blog post
    Given I am logged in as "author"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    And I create a blog post titled "E2E Test Post" from scratch
    And I set the post title to "E2E Test Post"
    And I write "This is an automated test." in the editor
    And I save the post
    Then the post status should be "draft"
    And I take a screenshot "content/blog-draft-created"

  Scenario: Author can see their own drafts
    Given I am logged in as "author"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    Then I should see "e2e-test-post"

  Scenario: Editor reviews and edits the draft
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    And I open post "e2e-test-post"
    And I write "Reviewed and updated content." in the editor
    And I save the post
    Then the post status should be "draft"
    And I take a screenshot "content/blog-editor-review"

  Scenario: Admin publishes the post
    # Publishing requires elevated (admin) access — editors only write drafts.
    Given I am logged in as "admin"
    And I am on site "E2E Test Blog"
    When I navigate to "blogs"
    And I open post "e2e-test-post"
    And I publish the post
    Then the post status should be "published"
    And I take a screenshot "content/blog-published"

  Scenario: The published post is served by the content API
    Then the content API serves blog "e2e-test-post" with status "Published"

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
