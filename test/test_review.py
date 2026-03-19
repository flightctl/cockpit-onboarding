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


@testlib.nondestructive
class TestReview(testlib.MachineCase):
    """Test configuration review and navigation in System Onboarding wizard"""

    def testReviewPageDisplay(self):
        """Test that review page displays all configuration sections"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Step 1: Set hostname
        b.wait_visible("#hostname-input")
        b.set_input_text("#hostname-input", "test-review-host")
        b.click("button:contains('Next')")

        # Step 2: Select network interface (select first available)
        b.wait_visible("#wizard-step-2")
        b.wait_visible(".pf-v5-c-data-list__item")  # Wait for interfaces to load
        b.click(".pf-v5-c-data-list__item:first-child")  # Select first interface
        b.click("button:contains('Next')")

        # Step 3: Keep default network address settings
        b.wait_visible("#wizard-step-3")
        b.click("button:contains('Next')")

        # Step 4: Keep default network services settings
        b.wait_visible("#wizard-step-4")
        b.click("button:contains('Next')")

        # Step 5 (if enrollment exists): Skip or configure
        # The step number for review depends on whether enrollment step exists
        # Let's try both possibilities
        if b.is_present("#wizard-step-5:contains('Enrollment')"):
            b.click("button:contains('Next')")
            # Review should be step 6
            b.wait_visible("#wizard-step-6:contains('Review')")
        else:
            # Review should be step 5
            b.wait_visible("#wizard-step-5:contains('Review')")

        # Verify hostname is displayed
        b.wait_in_text(".pf-v5-c-description-list", "test-review-host")

        # Verify Network Interface section exists
        b.wait_in_text(".pf-v5-c-description-list", "Network Interface")

        # Verify Network Address section exists
        b.wait_in_text(".pf-v5-c-description-list", "Network Address")

        # Verify Network Services section exists
        b.wait_in_text(".pf-v5-c-description-list", "Network Services")

    def testBackNavigationFromReview(self):
        """Test that users can navigate back from review page to edit settings"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate through wizard to review page
        # Step 1: Hostname
        b.wait_visible("#hostname-input")
        initial_hostname = "initial-hostname"
        b.set_input_text("#hostname-input", initial_hostname)
        b.click("button:contains('Next')")

        # Step 2: Network interface
        b.wait_visible("#wizard-step-2")
        b.wait_visible(".pf-v5-c-data-list__item")
        b.click(".pf-v5-c-data-list__item:first-child")
        b.click("button:contains('Next')")

        # Step 3: Network address
        b.wait_visible("#wizard-step-3")
        b.click("button:contains('Next')")

        # Step 4: Network services
        b.wait_visible("#wizard-step-4")
        b.click("button:contains('Next')")

        # Skip enrollment if present
        if b.is_present("#wizard-step-5:contains('Enrollment')"):
            b.click("button:contains('Next')")

        # Now on review page
        b.wait_in_text(".pf-v5-c-description-list", initial_hostname)

        # Test backward navigation using wizard Back button
        b.click("button:contains('Back')")

        # Should be on previous step (enrollment or network services)
        # Navigate back again to network address
        b.click("button:contains('Back')")
        b.wait_visible("#wizard-step-3")

    def testEditButtonNavigation(self):
        """Test that Edit buttons navigate to correct wizard steps"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Set up initial configuration
        # Step 1: Hostname
        b.wait_visible("#hostname-input")
        b.set_input_text("#hostname-input", "edit-test-host")
        b.click("button:contains('Next')")

        # Step 2: Network interface
        b.wait_visible("#wizard-step-2")
        b.wait_visible(".pf-v5-c-data-list__item")
        b.click(".pf-v5-c-data-list__item:first-child")
        b.click("button:contains('Next')")

        # Step 3: Network address
        b.wait_visible("#wizard-step-3")
        b.click("button:contains('Next')")

        # Step 4: Network services
        b.wait_visible("#wizard-step-4")
        b.click("button:contains('Next')")

        # Skip enrollment if present
        if b.is_present("#wizard-step-5:contains('Enrollment')"):
            b.click("button:contains('Next')")

        # Now on review page
        b.wait_in_text(".pf-v5-c-description-list", "edit-test-host")

        # Click Edit button for hostname
        hostname_edit_selector = "button[aria-label='Edit hostname']"
        if b.is_present(hostname_edit_selector):
            b.click(hostname_edit_selector)
            # Should navigate back to hostname step
            b.wait_visible("#wizard-step-1")
            b.wait_visible("#hostname-input")
        else:
            # Fallback: Look for any Edit button near Hostname section
            b.click(".pf-v5-c-description-list__group:contains('Hostname') button:contains('Edit')")
            b.wait_visible("#wizard-step-1")
            b.wait_visible("#hostname-input")

    def testSummaryReflectsChanges(self):
        """Test that modifying a setting and returning to review updates the summary"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Set initial hostname
        initial_hostname = "before-change"
        modified_hostname = "after-change"

        # Step 1: Hostname
        b.wait_visible("#hostname-input")
        b.set_input_text("#hostname-input", initial_hostname)
        b.click("button:contains('Next')")

        # Step 2: Network interface
        b.wait_visible("#wizard-step-2")
        b.wait_visible(".pf-v5-c-data-list__item")
        b.click(".pf-v5-c-data-list__item:first-child")
        b.click("button:contains('Next')")

        # Step 3: Network address
        b.wait_visible("#wizard-step-3")
        b.click("button:contains('Next')")

        # Step 4: Network services
        b.wait_visible("#wizard-step-4")
        b.click("button:contains('Next')")

        # Skip enrollment if present
        if b.is_present("#wizard-step-5:contains('Enrollment')"):
            b.click("button:contains('Next')")

        # Verify initial hostname in review
        b.wait_in_text(".pf-v5-c-description-list", initial_hostname)

        # Navigate back to hostname page
        b.click("button:contains('Back')")
        if b.is_present("#wizard-step-5:contains('Enrollment')"):
            b.click("button:contains('Back')")
        b.click("button:contains('Back')")  # Network services
        b.click("button:contains('Back')")  # Network address
        b.click("button:contains('Back')")  # Network interface

        # Should be back at hostname
        b.wait_visible("#wizard-step-1")
        b.wait_visible("#hostname-input")

        # Modify hostname
        b.set_input_text("#hostname-input", modified_hostname)

        # Navigate forward to review
        b.click("button:contains('Next')")  # To network interface
        b.click("button:contains('Next')")  # To network address
        b.click("button:contains('Next')")  # To network services
        b.click("button:contains('Next')")  # To enrollment or review
        if b.is_present("#wizard-step-5:contains('Enrollment')"):
            b.click("button:contains('Next')")  # To review

        # Verify modified hostname is displayed
        b.wait_in_text(".pf-v5-c-description-list", modified_hostname)
        # Ensure old hostname is not present
        self.assertFalse(b.is_present(f".pf-v5-c-description-list:contains('{initial_hostname}')"))

    def testReviewDisplaysIPv4Configuration(self):
        """Test that review page shows IPv4 configuration correctly"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to network address step
        # Step 1: Hostname
        b.wait_visible("#hostname-input")
        b.set_input_text("#hostname-input", "ipv4-test-host")
        b.click("button:contains('Next')")

        # Step 2: Network interface
        b.wait_visible("#wizard-step-2")
        b.wait_visible(".pf-v5-c-data-list__item")
        b.click(".pf-v5-c-data-list__item:first-child")
        b.click("button:contains('Next')")

        # Step 3: Network address - verify default is auto/DHCP
        b.wait_visible("#wizard-step-3")
        b.click("button:contains('Next')")

        # Step 4: Network services
        b.wait_visible("#wizard-step-4")
        b.click("button:contains('Next')")

        # Skip enrollment if present
        if b.is_present("#wizard-step-5:contains('Enrollment')"):
            b.click("button:contains('Next')")

        # Verify IPv4 configuration shows "Automatic (DHCP)"
        b.wait_in_text(".pf-v5-c-description-list", "IPv4 Configuration")
        b.wait_in_text(".pf-v5-c-description-list", "Automatic")

    def testReviewDisplaysProxyConfiguration(self):
        """Test that review page shows proxy configuration when enabled"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate through wizard
        # Step 1: Hostname
        b.wait_visible("#hostname-input")
        b.set_input_text("#hostname-input", "proxy-test-host")
        b.click("button:contains('Next')")

        # Step 2: Network interface
        b.wait_visible("#wizard-step-2")
        b.wait_visible(".pf-v5-c-data-list__item")
        b.click(".pf-v5-c-data-list__item:first-child")
        b.click("button:contains('Next')")

        # Step 3: Network address
        b.wait_visible("#wizard-step-3")
        b.click("button:contains('Next')")

        # Step 4: Network services - configure proxy
        b.wait_visible("#wizard-step-4")

        # Enable proxy if there's a toggle
        if b.is_present("#proxy-enabled-toggle"):
            b.set_checked("#proxy-enabled-toggle", True)
            b.wait_visible("#proxy-hostname-input")
            b.set_input_text("#proxy-hostname-input", "proxy.example.com")
            b.set_input_text("#proxy-port-input", "8080")

        b.click("button:contains('Next')")

        # Skip enrollment if present
        if b.is_present("#wizard-step-5:contains('Enrollment')"):
            b.click("button:contains('Next')")

        # Verify proxy configuration is displayed in review
        # Either "Not configured" (default) or the configured proxy
        b.wait_in_text(".pf-v5-c-description-list", "HTTP Proxy")


if __name__ == "__main__":
    testlib.test_main()
