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

from wizard_navigation import navigate_to_network_services_step

HELPER_TEXT_ERROR = ".pf-v6-c-form__helper-text .pf-m-error"


@testlib.nondestructive
class TestNtp(testlib.MachineCase):
    """Test NTP configuration on the Network Services wizard step"""

    def setUp(self):
        super().setUp()
        self.login_and_go("/system-onboarding")
        navigate_to_network_services_step(self.browser)

    def testNtpAutoByDefault(self):
        """Test that NTP is auto-configured by default (toggle OFF)"""
        b = self.browser

        # ntp-servers FeatureSwitch is OFF when auto-config is enabled (inverted)
        b.wait_visible("#ntp-servers")
        self.assertFalse(b.is_present("#ntp-servers:checked"))

        # Manual NTP input should not be visible
        b.wait_not_present("#ntp-server-input")

    def testNtpManualServers(self):
        """Test adding and removing custom NTP servers"""
        b = self.browser

        # Toggle ON to enable manual NTP servers
        b.click("label[for='ntp-servers']")
        b.wait_visible("#ntp-servers:checked")
        b.wait_visible("#ntp-server-input")

        # Enter a valid NTP server
        b.set_input_text("#ntp-server-input", "pool.ntp.org")
        self.assertEqual(b.val("#ntp-server-input"), "pool.ntp.org")

        # Add another server row
        b.click("button:contains('Add another NTP server')")
        b.wait_visible("#ntp-server-input-1")

        b.set_input_text("#ntp-server-input-1", "time.google.com")
        self.assertEqual(b.val("#ntp-server-input-1"), "time.google.com")

        # Remove the second server
        b.click("button[aria-label='Remove NTP server']:last")
        b.wait_not_present("#ntp-server-input-1")

        # First server should still be there
        self.assertEqual(b.val("#ntp-server-input"), "pool.ntp.org")

    def testNtpServerValidation(self):
        """Test NTP server address validation"""
        b = self.browser

        b.click("label[for='ntp-servers']")
        b.wait_visible("#ntp-server-input")

        b.set_input_text("#ntp-server-input", "")
        b.wait_in_text(HELPER_TEXT_ERROR, "Invalid hostname or IP address")

        b.set_input_text("#ntp-server-input", "time.nist.gov")
        b.wait_not_present(HELPER_TEXT_ERROR)

        b.set_input_text("#ntp-server-input", "129.6.15.28")
        b.wait_not_present(HELPER_TEXT_ERROR)

        b.set_input_text("#ntp-server-input", "2001:4860:4860::8888")
        b.wait_not_present(HELPER_TEXT_ERROR)

    def testNtpToggleBackToAuto(self):
        """Test toggling back to auto NTP clears manual servers"""
        b = self.browser

        # Enable manual
        b.click("label[for='ntp-servers']")
        b.wait_visible("#ntp-server-input")
        b.set_input_text("#ntp-server-input", "pool.ntp.org")

        # Toggle back to auto
        b.click("label[for='ntp-servers']")
        self.assertFalse(b.is_present("#ntp-servers:checked"))
        b.wait_not_present("#ntp-server-input")


@testlib.nondestructive
class TestProxy(testlib.MachineCase):
    """Test HTTP proxy configuration on the Network Services wizard step"""

    def setUp(self):
        super().setUp()
        self.login_and_go("/system-onboarding")
        navigate_to_network_services_step(self.browser)

    def testProxyDisabledByDefault(self):
        """Test that proxy is disabled by default"""
        b = self.browser

        b.wait_visible("#proxy-enabled")
        self.assertFalse(b.is_present("#proxy-enabled:checked"))
        b.wait_not_present("#proxy-hostname-input")

    def testProxyEnableDisable(self):
        """Test enabling and disabling proxy configuration"""
        b = self.browser

        b.click("label[for='proxy-enabled']")
        b.wait_visible("#proxy-enabled:checked")
        b.wait_visible("#proxy-hostname-input")
        b.wait_visible("#proxy-port-input")
        b.wait_visible("#proxy-username-input")
        b.wait_visible("#proxy-password-input")

        b.click("label[for='proxy-enabled']")
        self.assertFalse(b.is_present("#proxy-enabled:checked"))
        b.wait_not_present("#proxy-hostname-input")

    def testProxyHostnameValidation(self):
        """Test proxy hostname validation"""
        b = self.browser

        b.click("label[for='proxy-enabled']")
        b.wait_visible("#proxy-hostname-input")

        b.set_input_text("#proxy-hostname-input", "proxy.example.com")
        b.wait_not_present(HELPER_TEXT_ERROR)

        b.set_input_text("#proxy-hostname-input", "192.168.1.100")
        b.wait_not_present(HELPER_TEXT_ERROR)

        b.set_input_text("#proxy-hostname-input", "2001:db8::1")
        b.wait_not_present(HELPER_TEXT_ERROR)

    def testProxyPortValidation(self):
        """Test proxy port number validation"""
        b = self.browser

        b.click("label[for='proxy-enabled']")
        b.wait_visible("#proxy-port-input")

        b.set_input_text("#proxy-port-input", "8080")
        b.wait_not_present(HELPER_TEXT_ERROR)

        b.set_input_text("#proxy-port-input", "0")
        b.wait_in_text(HELPER_TEXT_ERROR, "Port must be between 1 and 65535")

        b.set_input_text("#proxy-port-input", "65536")
        b.wait_in_text(HELPER_TEXT_ERROR, "Port must be between 1 and 65535")

    def testProxyFullConfiguration(self):
        """Test complete proxy configuration with authentication"""
        b = self.browser

        b.click("label[for='proxy-enabled']")
        b.wait_visible("#proxy-hostname-input")

        b.set_input_text("#proxy-hostname-input", "proxy.corporate.com")
        b.set_input_text("#proxy-port-input", "8080")
        b.set_input_text("#proxy-username-input", "testuser")
        b.set_input_text("#proxy-password-input", "testpassword")

        self.assertEqual(b.val("#proxy-hostname-input"), "proxy.corporate.com")
        self.assertEqual(b.val("#proxy-port-input"), "8080")
        self.assertEqual(b.val("#proxy-username-input"), "testuser")
        self.assertEqual(b.val("#proxy-password-input"), "testpassword")

    def testProxyPasswordFieldType(self):
        """Test that password field is masked"""
        b = self.browser

        b.click("label[for='proxy-enabled']")
        b.wait_visible("#proxy-password-input")

        self.assertEqual(b.attr("#proxy-password-input", "type"), "password")


if __name__ == "__main__":
    testlib.test_main()
