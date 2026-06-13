@welcome
Feature: Welcome page for signed-out visitors
  As a non-technical visitor evaluating Forja
  I want the signed-out Welcome page to plainly explain what Forja is
  And to reach the GDPR Imprint
  So that I can understand and trust the product before signing up

  # This is the #645 "canary" path, automated (epic #806 / sub #814).
  # The Imprint scenarios depend on the backend's IMPRINT_* env: the
  # @requires-imprint scenario needs the required trio set; the
  # @requires-no-imprint scenario needs them unset. Each precondition step
  # asserts the running backend matches, with a clear message otherwise.

  Background:
    Given I am a signed-out visitor on the Welcome page

  Scenario: A non-technical visitor understands Forja from the landing sections
    Then the product preview leads and the "What is Forja?" explainer follows
    And I see the sign-up and self-host hero calls to action
    And I take a screenshot "welcome/welcome-landing"

  @requires-imprint
  Scenario: The visitor can reach the operator Imprint from the footer
    Given the operator has configured imprint details
    When I open the Imprint from the footer
    Then I see the operator imprint details

  @requires-no-imprint
  Scenario: The Imprint link is hidden when no operator details are configured
    Given the operator has not configured imprint details
    Then the footer shows no Imprint link

  Scenario Outline: The Welcome surface renders correctly in both colour schemes
    Given the visitor's system prefers the "<scheme>" colour scheme
    When I reload the Welcome page
    Then the Welcome surface uses the "<scheme>" palette
    And I take a screenshot "welcome/welcome-<scheme>"

    Examples:
      | scheme |
      | dark   |
      | light  |
