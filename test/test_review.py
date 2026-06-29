#!/usr/bin/python3

# This file is part of Cockpit.
#
# Copyright (C) 2025 Red Hat, Inc.
#
# Cockpit is free software; you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as published by
# the Free Software Foundation; either version 2.1 of the License, or
# (at your option) any later version.
#
# Cockpit is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
# Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with Cockpit; If not, see <http://www.gnu.org/licenses/>.

import testlib

from wizard_navigation import (
    advance_past_optional_steps_to_review,
    complete_hostname_step,
    complete_network_step,
)


@testlib.nondestructive
class TestReview(testlib.MachineCase):
    """Test configuration review and navigation in System Onboarding wizard"""

    def testReviewPageDisplay(self):
        """Test that review page displays all configuration sections"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        advance_past_optional_steps_to_review(b, "test-review-host")

        b.wait_in_text(".pf-v5-c-description-list", "test-review-host")
        b.wait_in_text(".pf-v5-c-description-list", "Interface")
        b.wait_in_text(".pf-v5-c-description-list", "IPv4 Configuration")
        b.wait_in_text(".pf-v5-c-description-list", "NTP Servers")

    def testBackNavigationFromReview(self):
        """Test that users can navigate back from review page to edit settings"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        initial_hostname = "initial-hostname"
        advance_past_optional_steps_to_review(b, initial_hostname)
        b.wait_in_text(".pf-v5-c-description-list", initial_hostname)

        b.click("button:contains('Back')")
        b.click("button:contains('Back')")
        b.wait_visible("#hostnameStep")

    def testEditButtonNavigation(self):
        """Test that Edit buttons navigate to correct wizard steps"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        advance_past_optional_steps_to_review(b, "edit-test-host")
        b.wait_in_text(".pf-v5-c-description-list", "edit-test-host")

        hostname_edit_selector = "button[aria-label='Edit hostname']"
        if b.is_present(hostname_edit_selector):
            b.click(hostname_edit_selector)
        else:
            b.click(".pf-v5-c-description-list__group:contains('Hostname') button:contains('Edit')")

        b.wait_visible("#hostnameStep")
        b.wait_visible("#hostname-input")

    def testSummaryReflectsChanges(self):
        """Test that modifying a setting and returning to review updates the summary"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        initial_hostname = "before-change"
        modified_hostname = "after-change"

        advance_past_optional_steps_to_review(b, initial_hostname)
        b.wait_in_text(".pf-v5-c-description-list", initial_hostname)

        b.click("button:contains('Back')")
        b.click("button:contains('Back')")
        b.wait_visible("#hostnameStep")
        b.set_input_text("#hostname-input", modified_hostname)
        b.click("button:contains('Next')")
        b.click("button:contains('Next')")
        b.wait_visible("#reviewStep")

        b.wait_in_text(".pf-v5-c-description-list", modified_hostname)
        self.assertFalse(b.is_present(f".pf-v5-c-description-list:contains('{initial_hostname}')"))

    def testReviewDisplaysIPv4Configuration(self):
        """Test that review page shows IPv4 configuration correctly"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        advance_past_optional_steps_to_review(b, "ipv4-test-host")

        b.wait_in_text(".pf-v5-c-description-list", "IPv4 Configuration")
        b.wait_in_text(".pf-v5-c-description-list", "Automatic")

    def testReviewDisplaysProxyConfiguration(self):
        """Test that review page shows proxy configuration when enabled"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")
        b.click("table[aria-label='Network interface selector'] tbody tr:first-child input[type='radio']")

        if b.is_present("#proxy-enabled"):
            b.set_checked("#proxy-enabled", True)
            b.wait_visible("#proxy-hostname-input")
            b.set_input_text("#proxy-hostname-input", "proxy.example.com")
            b.set_input_text("#proxy-port-input", "8080")

        b.click("button:contains('Next')")
        from wizard_navigation import advance_past_enrollment_and_connectivity

        advance_past_enrollment_and_connectivity(b)
        complete_hostname_step(b, "proxy-test-host")
        b.click("button:contains('Next')")
        b.wait_visible("#reviewStep")

        b.wait_in_text(".pf-v5-c-description-list", "Proxy")


if __name__ == "__main__":
    testlib.test_main()
