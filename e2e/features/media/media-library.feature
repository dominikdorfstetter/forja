@media
Feature: Media Library
  As a content editor
  I want to upload, organize, and manage media files

  @skip
  Scenario: Editor uploads an image
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "media"
    And I upload file "fixtures/test-image.png"
    Then I should see "test-image.png" in the media library
    And I take a screenshot "media/image-uploaded"

  @skip
  Scenario: Editor creates a folder
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "media"
    And I create folder "Blog Images"
    Then I should see "Blog Images" in the folder list
    And I take a screenshot "media/folder-created"

  @skip
  Scenario: Editor moves file to folder
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "media"
    And I move "test-image.png" to folder "Blog Images"
    Then "test-image.png" should be inside "Blog Images"

  Scenario: Viewer can access media page
    Given I am logged in as "viewer"
    And I am on site "E2E Test Blog"
    When I navigate to "media"
    Then I should see "Media"
    And I take a screenshot "media/viewer-media-page"

  @skip
  Scenario: Upload unsupported file type is rejected
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "media"
    And I upload file "fixtures/test-blocked-ext.exe"
    Then I should see an error about "unsupported file type"

  @skip
  Scenario: Delete a media file
    Given I am logged in as "editor"
    And I am on site "E2E Test Blog"
    When I navigate to "media"
    And I delete "test-image.png"
    And I confirm the deletion
    Then "test-image.png" should no longer be in the media library
