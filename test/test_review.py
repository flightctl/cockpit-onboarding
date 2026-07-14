#!/usr/bin/python3

"""
Integration test for the Review wizard step

Tests that the review page displays configuration summaries and
edit buttons navigate to the correct wizard steps.
"""

from __future__ import annotations

import testlib

from wizard_navigation import advance_past_optional_steps_to_review

DESC_LIST = ".pf-v6-c-description-list"
IFACE_TABLE = "table[aria-label='Network interface selector']"


@testlib.nondestructive
class TestReview(testlib.MachineCase):
    """Test configuration review and navigation in System Onboarding wizard"""

    def testReviewPageDisplay(self):
        """Test that review page displays all configuration sections"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        advance_past_optional_steps_to_review(b, "test-review-host")

        b.wait_in_text(DESC_LIST, "test-review-host")
        b.wait_in_text(DESC_LIST, "Network interface")
        b.wait_in_text(DESC_LIST, "IPv4 Connection")
        b.wait_in_text(DESC_LIST, "NTP Server Hostname")

    def testBackNavigationFromReview(self):
        """Test that users can navigate back from review page to edit settings"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        advance_past_optional_steps_to_review(b, "initial-hostname")
        b.wait_in_text(DESC_LIST, "initial-hostname")

        b.click("button:contains('Back')")
        b.wait_visible("#labelsStep")

    def testEditDeviceLabelsNavigation(self):
        """Test that the Edit device labels button navigates to the labels step"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        advance_past_optional_steps_to_review(b, "edit-test-host")
        b.wait_in_text(DESC_LIST, "edit-test-host")

        b.click("button[aria-label='Edit device labels']")
        b.wait_visible("#labelsStep")
        b.wait_visible("#hostname-input")

    def testEditNetworkNavigation(self):
        """Test that the Edit network button navigates to the network step"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        advance_past_optional_steps_to_review(b, "net-edit-host")

        b.click("button[aria-label='Edit network configuration']")
        b.wait_visible("#networkStep")

    def testEditNetworkServicesNavigation(self):
        """Test that the Edit network services button navigates to the services step"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        advance_past_optional_steps_to_review(b, "svc-edit-host")

        b.click("button[aria-label='Edit network services']")
        b.wait_visible("#networkServicesStep")

    def testEditEnrollmentNavigation(self):
        """Test that the Edit enrollment button navigates to the enrollment step"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        advance_past_optional_steps_to_review(b, "enroll-edit-host")

        b.click("button[aria-label='Edit enrollment']")
        b.wait_visible("#enrollmentStep")

    def testSummaryReflectsChanges(self):
        """Test that modifying a setting and returning to review updates the summary"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        initial_hostname = "before-change"
        modified_hostname = "after-change"

        advance_past_optional_steps_to_review(b, initial_hostname)
        b.wait_in_text(DESC_LIST, initial_hostname)

        b.click("button:contains('Back')")
        b.wait_visible("#labelsStep")
        b.set_input_text("#hostname-input", modified_hostname)
        b.click("button:contains('Next')")
        b.wait_visible("#reviewStep")

        b.wait_in_text(DESC_LIST, modified_hostname)

    def testReviewDisplaysIPv4Configuration(self):
        """Test that review page shows IPv4 configuration correctly"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        advance_past_optional_steps_to_review(b, "ipv4-test-host")

        b.wait_in_text(DESC_LIST, "IPv4 Connection")
        b.wait_in_text(DESC_LIST, "Automatic (DHCP)")

    def testReviewDisplaysProxyNotConfigured(self):
        """Test that review page shows 'No proxy configured' by default"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        advance_past_optional_steps_to_review(b, "proxy-test-host")

        b.wait_in_text(DESC_LIST, "HTTP proxy")
        b.wait_in_text(DESC_LIST, "No proxy configured")

    def testReviewDisplaysEnrollmentSkipped(self):
        """Test that review page shows enrollment skipped when not selected"""
        b = self.browser

        self.login_and_go("/system-onboarding")

        advance_past_optional_steps_to_review(b, "no-enroll-host")

        b.wait_in_text(DESC_LIST, "Enrollment skipped")


@testlib.nondestructive
class TestReviewSingleNic(testlib.MachineCase):
    """Test review page warnings when configuring the setup interface"""

    def setUp(self):
        super().setUp()
        m = self.machine
        addr = m.address
        try:
            self.setup_iface = m.execute(
                f"ip -o addr show | grep '{addr}/' | awk '{{print $2}}'"
            ).strip().split('\n')[0]
        except Exception:
            self.setup_iface = None

    def testSingleNicReviewWarning(self):
        """Test that review page shows 'Connection will be interrupted' warning"""
        if not self.setup_iface:
            self.skipTest("Could not determine setup interface")

        b = self.browser
        self.login_and_go("/system-onboarding")
        b.wait_visible("#networkStep")
        b.wait_visible(IFACE_TABLE)

        iface_radio = f"{IFACE_TABLE} tr:contains('{self.setup_iface}') input[type='radio']"
        if not b.is_present(f"{iface_radio}:checked"):
            b.click(iface_radio)

        b.click("button:contains('Next')")
        b.wait_visible("#networkServicesStep")
        b.click("button:contains('Next')")
        b.wait_visible("#enrollmentStep")
        b.click("button:contains('Next')")
        b.wait_visible("#labelsStep")
        b.set_input_text("#hostname-input", "single-nic-test")
        b.click("button:contains('Next')")
        b.wait_visible("#reviewStep")

        b.wait_in_text(
            ".pf-v6-c-alert.pf-m-warning",
            "Connection will be interrupted"
        )


if __name__ == "__main__":
    testlib.test_main()
