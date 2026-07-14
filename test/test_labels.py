#!/usr/bin/python3

"""
Integration test for the Device Labels wizard step

Tests hostname configuration, alias toggle, and custom label management.
"""

from __future__ import annotations

import testlib

from wizard_navigation import navigate_to_labels_step

HELPER_TEXT_ERROR = ".pf-v6-c-form__helper-text .pf-m-error"


@testlib.nondestructive
class TestHostname(testlib.MachineCase):
    """Test hostname input and validation on the labels step"""

    def setUp(self):
        super().setUp()
        self.login_and_go("/system-onboarding")
        navigate_to_labels_step(self.browser)

    def testHostnameInputPresent(self):
        """Test that hostname input is visible and editable"""
        b = self.browser

        b.wait_visible("#hostname-input")
        b.set_input_text("#hostname-input", "my-test-host")
        self.assertEqual(b.val("#hostname-input"), "my-test-host")

    def testHostnameRequired(self):
        """Test that an empty hostname shows a required error"""
        b = self.browser

        b.set_input_text("#hostname-input", "")
        b.focus("label:contains('Hostname')")
        b.wait_in_text(HELPER_TEXT_ERROR, "Hostname is required")

    def testHostnameInvalidCharacters(self):
        """Test that special characters are rejected"""
        b = self.browser

        b.set_input_text("#hostname-input", "host_name!")
        b.focus("label:contains('Hostname')")
        b.wait_in_text(HELPER_TEXT_ERROR, "contain only letters, numbers, hyphens, and dots")

    def testHostnameLabelStartEnd(self):
        """Test that hostname must start and end with alphanumeric characters"""
        b = self.browser

        b.set_input_text("#hostname-input", "-bad-start")
        b.focus("label:contains('Hostname')")
        b.wait_in_text(HELPER_TEXT_ERROR, "must start and end with an alphanumeric character")

        b.set_input_text("#hostname-input", "bad-end-")
        b.focus("label:contains('Hostname')")
        b.wait_in_text(HELPER_TEXT_ERROR, "must start and end with an alphanumeric character")

    def testHostnameMaxLength(self):
        """Test that hostname exceeding 64 chars is rejected for system hostname"""
        b = self.browser

        long_hostname = "a" * 65
        b.set_input_text("#hostname-input", long_hostname)
        b.focus("label:contains('Hostname')")
        b.wait_in_text(HELPER_TEXT_ERROR, "64 characters or less")

    def testHostnameConsecutiveDots(self):
        """Test that consecutive dots in hostname are rejected"""
        b = self.browser

        b.set_input_text("#hostname-input", "host..name")
        b.focus("label:contains('Hostname')")
        b.wait_in_text(HELPER_TEXT_ERROR, "must start and end with an alphanumeric character")

    def testHostnameValidFqdn(self):
        """Test that valid FQDNs are accepted"""
        b = self.browser

        b.set_input_text("#hostname-input", "my-host.example.com")
        b.wait_not_present(HELPER_TEXT_ERROR)

    def testHostnameValidSimple(self):
        """Test that a valid simple hostname is accepted"""
        b = self.browser

        b.set_input_text("#hostname-input", "my-device-01")
        b.wait_not_present(HELPER_TEXT_ERROR)


@testlib.nondestructive
class TestAlias(testlib.MachineCase):
    """Test alias toggle and mode selection on the labels step"""

    def setUp(self):
        super().setUp()
        self.login_and_go("/system-onboarding")
        navigate_to_labels_step(self.browser)

    def testAliasToggle(self):
        """Test enabling and disabling the alias switch"""
        b = self.browser

        toggle = "label[for='alias-enabled']"
        switch = "#alias-enabled"

        b.wait_visible(switch)

        b.click(toggle)
        b.wait_visible(f"{switch}:checked")
        b.wait_visible("#alias-mode-hostname")
        b.wait_visible("#alias-mode-custom")

        b.click(toggle)
        self.assertFalse(b.is_present(f"{switch}:checked"))
        b.wait_not_present("#alias-mode-hostname")

    def testAliasHostnameMode(self):
        """Test that 'Use hostname as alias' is the default mode when alias is enabled"""
        b = self.browser

        b.set_input_text("#hostname-input", "valid-host")

        b.click("label[for='alias-enabled']")
        b.wait_visible("#alias-enabled:checked")

        b.wait_visible("#alias-mode-hostname:checked")

    def testAliasCustomMode(self):
        """Test switching to custom alias mode and entering a value"""
        b = self.browser

        b.click("label[for='alias-enabled']")
        b.wait_visible("#alias-enabled:checked")

        b.click("#alias-mode-custom")
        b.wait_visible("#alias-custom-input")

        b.set_input_text("#alias-custom-input", "my-alias")
        self.assertEqual(b.val("#alias-custom-input"), "my-alias")


@testlib.nondestructive
class TestCustomLabels(testlib.MachineCase):
    """Test custom device label management on the labels step"""

    def setUp(self):
        super().setUp()
        self.login_and_go("/system-onboarding")
        navigate_to_labels_step(self.browser)

    def testAddLabelButton(self):
        """Test that the 'Add another label' button is present"""
        b = self.browser

        b.wait_visible("button:contains('Add another label')")

    def testAddAndRemoveLabel(self):
        """Test adding and removing custom label rows"""
        b = self.browser

        b.click("button:contains('Add another label')")

        b.wait_visible("button[aria-label='Remove label']")


if __name__ == "__main__":
    testlib.test_main()
