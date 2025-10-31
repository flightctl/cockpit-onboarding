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
class TestProxy(testlib.MachineCase):
    """Test HTTP proxy configuration in System Onboarding wizard"""

    def testProxyDisabledByDefault(self):
        """Test that proxy is disabled by default"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate through wizard to Network Services page
        # TODO: Implement navigation helper or adjust based on actual wizard flow

        # Check that proxy checkbox is present but not checked by default
        b.wait_visible("#proxy-enabled")
        self.assertFalse(b.is_present("#proxy-enabled:checked"))

        # Verify that proxy configuration inputs are hidden when disabled
        b.wait_not_present("#proxy-hostname-input")
        b.wait_not_present("#proxy-port-input")
        b.wait_not_present("#proxy-username-input")
        b.wait_not_present("#proxy-password-input")

    def testProxyEnableDisable(self):
        """Test enabling and disabling proxy configuration"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page
        # TODO: Implement navigation helper

        # Wait for proxy checkbox
        b.wait_visible("#proxy-enabled")

        # Enable proxy
        b.set_checked("#proxy-enabled", True)

        # Verify proxy configuration inputs appear
        b.wait_visible("#proxy-hostname-input")
        b.wait_visible("#proxy-port-input")
        b.wait_visible("#proxy-username-input")
        b.wait_visible("#proxy-password-input")

        # Disable proxy
        b.set_checked("#proxy-enabled", False)

        # Verify inputs are hidden again
        b.wait_not_present("#proxy-hostname-input")
        b.wait_not_present("#proxy-port-input")

    def testProxyHostnameValidation(self):
        """Test proxy hostname validation"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page and enable proxy
        b.wait_visible("#proxy-enabled")
        b.set_checked("#proxy-enabled", True)
        b.wait_visible("#proxy-hostname-input")

        # Test valid IPv4 address
        b.set_input_text("#proxy-hostname-input", "192.168.1.100")
        # Should not show error
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

        # Test invalid IPv4 address
        b.set_input_text("#proxy-hostname-input", "256.256.256.256")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Invalid hostname or IP address")

        # Test valid IPv6 address
        b.set_input_text("#proxy-hostname-input", "2001:4860:4860::8888")
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

        # Test valid hostname
        b.set_input_text("#proxy-hostname-input", "proxy.example.com")
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

        # Test hostname with subdomain
        b.set_input_text("#proxy-hostname-input", "proxy.corporate.example.com")
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

        # Test invalid hostname (too long)
        long_hostname = "a" * 255
        b.set_input_text("#proxy-hostname-input", long_hostname)
        b.wait_in_text(".pf-v5-c-form__helper-text", "Invalid hostname or IP address")

        # Test invalid hostname (empty label)
        b.set_input_text("#proxy-hostname-input", "proxy..example.com")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Invalid hostname or IP address")

        # Test invalid hostname (starts with hyphen)
        b.set_input_text("#proxy-hostname-input", "-proxy.example.com")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Invalid hostname or IP address")

        # Test empty hostname (should be allowed - proxy is optional)
        b.set_input_text("#proxy-hostname-input", "")
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

    def testProxyPortValidation(self):
        """Test proxy port number validation"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page and enable proxy
        b.wait_visible("#proxy-enabled")
        b.set_checked("#proxy-enabled", True)
        b.wait_visible("#proxy-port-input")

        # Test valid ports
        valid_ports = ["80", "8080", "3128", "443", "1080", "65535"]
        for port in valid_ports:
            b.set_input_text("#proxy-port-input", port)
            b.wait_not_present("#proxy-port-input ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test port 1 (minimum valid)
        b.set_input_text("#proxy-port-input", "1")
        b.wait_not_present("#proxy-port-input ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test port 0 (invalid - too low)
        b.set_input_text("#proxy-port-input", "0")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Port must be between 1 and 65535")

        # Test port 65536 (invalid - too high)
        b.set_input_text("#proxy-port-input", "65536")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Port must be between 1 and 65535")

        # Test port 99999 (invalid - too high)
        b.set_input_text("#proxy-port-input", "99999")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Port must be between 1 and 65535")

        # Test empty port (should be allowed)
        b.set_input_text("#proxy-port-input", "")
        b.wait_not_present("#proxy-port-input ~ .pf-v5-c-form__helper-text.pf-m-error")

    def testProxyBasicConfiguration(self):
        """Test basic proxy configuration without authentication"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page
        b.wait_visible("#proxy-enabled")

        # Enable proxy
        b.set_checked("#proxy-enabled", True)
        b.wait_visible("#proxy-hostname-input")

        # Configure proxy without authentication
        b.set_input_text("#proxy-hostname-input", "proxy.corporate.com")
        b.set_input_text("#proxy-port-input", "8080")

        # Verify values are set
        self.assertEqual(b.val("#proxy-hostname-input"), "proxy.corporate.com")
        self.assertEqual(b.val("#proxy-port-input"), "8080")

        # Verify no validation errors
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

    def testProxyAuthenticationConfiguration(self):
        """Test proxy configuration with authentication credentials"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page
        b.wait_visible("#proxy-enabled")

        # Enable proxy
        b.set_checked("#proxy-enabled", True)
        b.wait_visible("#proxy-hostname-input")

        # Configure proxy with authentication
        b.set_input_text("#proxy-hostname-input", "proxy.corporate.com")
        b.set_input_text("#proxy-port-input", "8080")
        b.set_input_text("#proxy-username-input", "testuser")
        b.set_input_text("#proxy-password-input", "testpassword")

        # Verify values are set
        self.assertEqual(b.val("#proxy-hostname-input"), "proxy.corporate.com")
        self.assertEqual(b.val("#proxy-port-input"), "8080")
        self.assertEqual(b.val("#proxy-username-input"), "testuser")
        self.assertEqual(b.val("#proxy-password-input"), "testpassword")

        # Verify no validation errors
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

    def testProxyPasswordFieldType(self):
        """Test that password field is masked"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page and enable proxy
        b.wait_visible("#proxy-enabled")
        b.set_checked("#proxy-enabled", True)
        b.wait_visible("#proxy-password-input")

        # Verify password field has type="password"
        self.assertEqual(
            b.attr("#proxy-password-input", "type"),
            "password"
        )

    def testProxyOptionalFields(self):
        """Test that username and password fields are optional"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page
        b.wait_visible("#proxy-enabled")

        # Enable proxy
        b.set_checked("#proxy-enabled", True)
        b.wait_visible("#proxy-hostname-input")

        # Configure only required fields (hostname and port)
        b.set_input_text("#proxy-hostname-input", "proxy.example.com")
        b.set_input_text("#proxy-port-input", "3128")

        # Leave username and password empty
        self.assertEqual(b.val("#proxy-username-input"), "")
        self.assertEqual(b.val("#proxy-password-input"), "")

        # Verify no validation errors
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

    def testProxyCommonPorts(self):
        """Test common proxy port numbers"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page and enable proxy
        b.wait_visible("#proxy-enabled")
        b.set_checked("#proxy-enabled", True)
        b.wait_visible("#proxy-port-input")

        # Test common proxy ports
        common_ports = {
            "3128": "Squid default",
            "8080": "HTTP alternate",
            "8888": "HTTP alternate",
            "1080": "SOCKS",
            "80": "HTTP",
            "443": "HTTPS"
        }

        for port, description in common_ports.items():
            b.set_input_text("#proxy-port-input", port)
            b.wait_not_present("#proxy-port-input ~ .pf-v5-c-form__helper-text.pf-m-error")

    def testProxyIPv4Address(self):
        """Test proxy configuration with IPv4 address"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page
        b.wait_visible("#proxy-enabled")
        b.set_checked("#proxy-enabled", True)
        b.wait_visible("#proxy-hostname-input")

        # Configure proxy with IPv4 address
        b.set_input_text("#proxy-hostname-input", "10.0.0.1")
        b.set_input_text("#proxy-port-input", "8080")

        # Verify values and no errors
        self.assertEqual(b.val("#proxy-hostname-input"), "10.0.0.1")
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")

    def testProxyIPv6Address(self):
        """Test proxy configuration with IPv6 address"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to Network Services page
        b.wait_visible("#proxy-enabled")
        b.set_checked("#proxy-enabled", True)
        b.wait_visible("#proxy-hostname-input")

        # Configure proxy with IPv6 address
        b.set_input_text("#proxy-hostname-input", "2001:db8::1")
        b.set_input_text("#proxy-port-input", "8080")

        # Verify values and no errors
        self.assertEqual(b.val("#proxy-hostname-input"), "2001:db8::1")
        b.wait_not_present(".pf-v5-c-form__helper-text.pf-m-error")


if __name__ == "__main__":
    testlib.test_main()
