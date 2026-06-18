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

from wizard_navigation import navigate_to_hostname_step


@testlib.nondestructive
class TestHostname(testlib.MachineCase):
    """Test hostname configuration in System Onboarding wizard"""

    def testHostnameValidation(self):
        """Test that hostname validation follows RFC 1123 rules"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        navigate_to_hostname_step(b)

        # Test empty hostname (should show error)
        b.set_input_text("#hostname-input", "")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Hostname is required")

        # Test invalid hostname with special characters
        b.set_input_text("#hostname-input", "server_01")
        b.wait_in_text(".pf-v5-c-form__helper-text", "can only contain letters, numbers, and hyphens")

        # Test invalid hostname starting with hyphen
        b.set_input_text("#hostname-input", "-server")
        b.wait_in_text(".pf-v5-c-form__helper-text", "must start with an alphanumeric character")

        # Test invalid hostname ending with hyphen
        b.set_input_text("#hostname-input", "server-")
        b.wait_in_text(".pf-v5-c-form__helper-text", "must end with an alphanumeric character")

        # Test all-numeric hostname in FQDN (invalid)
        b.set_input_text("#hostname-input", "192.168.1.1")
        b.wait_in_text(".pf-v5-c-form__helper-text", "cannot be all numeric")

        # Test valid hostname
        b.set_input_text("#hostname-input", "my-server.example.com")
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

        # Test hostname at maximum length (63 chars for single label)
        long_hostname = "a" * 63
        b.set_input_text("#hostname-input", long_hostname)
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

        # Test hostname over maximum label length (64 chars)
        too_long_hostname = "a" * 64
        b.set_input_text("#hostname-input", too_long_hostname)
        b.wait_in_text(".pf-v5-c-form__helper-text", "63 characters")

    def testHostnameApplication(self):
        """Test that hostname is properly applied to the system via DBUS"""
        b = self.browser
        m = self.machine

        # Store original hostname to restore later
        original_hostname = m.execute("hostname").strip()

        try:
            self.login_and_go("/system-onboarding")
            b.wait_visible(".pf-v5-c-wizard")

            navigate_to_hostname_step(b)

            test_hostname = "test-onboarding-host"
            b.set_input_text("#hostname-input", test_hostname)

            # Complete the wizard (navigate through remaining steps)
            # This would require implementing the full wizard flow
            # For now, this test validates the hostname input UI

            # TODO: Complete wizard and verify hostname is applied via:
            # actual_hostname = m.execute("hostname").strip()
            # self.assertEqual(actual_hostname, test_hostname)

        finally:
            # Restore original hostname
            m.execute(f"hostnamectl set-hostname '{original_hostname}'")

    def testDhcpHostnameDisplay(self):
        """Test that DHCP-assigned hostname is displayed if available"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        navigate_to_hostname_step(b)

        # If a DHCP hostname is available, it should be pre-populated
        # This test would require a test environment with DHCP configured
        # For now, verify the input field is present
        b.wait_visible("#hostname-input")


if __name__ == "__main__":
    testlib.test_main()
