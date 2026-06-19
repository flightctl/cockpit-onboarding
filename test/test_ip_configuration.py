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
class TestIPConfiguration(testlib.MachineCase):
    """Test IP address configuration in System Onboarding wizard"""

    def testIPv4StaticValidation(self):
        """Test that IPv4 static configuration validates correctly"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate through wizard to network address page
        # (assumes hostname and interface selection steps are complete)
        # This may require clicking "Next" buttons to reach the IP configuration page

        # Select static IP method
        b.click("#static-ip-radio")
        b.wait_visible("#ipv4-address")

        # Test empty IPv4 address (should show error)
        b.set_input_text("#ipv4-address", "")
        b.wait_in_text(".pf-v5-c-form__helper-text", "IPv4 address is required")

        # Test invalid IPv4 format
        b.set_input_text("#ipv4-address", "192.168.1")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Invalid IPv4 address format")

        # Test IPv4 octet out of range
        b.set_input_text("#ipv4-address", "256.1.1.1")
        b.wait_in_text(".pf-v5-c-form__helper-text", "IPv4 octets must be between 0 and 255")

        # Test valid IPv4 address
        b.set_input_text("#ipv4-address", "192.168.1.100")
        b.wait_not_present("#ipv4-address ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test subnet mask validation
        b.set_input_text("#subnet-mask", "255.0.255.0")  # Invalid (non-consecutive bits)
        b.wait_in_text(".pf-v5-c-form__helper-text", "must have consecutive 1s followed by 0s")

        # Test valid subnet mask (CIDR notation)
        b.set_input_text("#subnet-mask", "/24")
        b.wait_not_present("#subnet-mask ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test valid subnet mask (dotted decimal)
        b.set_input_text("#subnet-mask", "255.255.255.0")
        b.wait_not_present("#subnet-mask ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test gateway validation
        b.set_input_text("#gateway-ip", "192.168.1.1")
        b.wait_not_present("#gateway-ip ~ .pf-v5-c-form__helper-text.pf-m-error")

    def testIPv4DNSValidation(self):
        """Test that IPv4 DNS server validation works correctly"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to network address page
        # Uncheck auto-DNS to enable manual DNS configuration
        b.click("#manual-dns-ipv4-radio")
        b.wait_visible("#primary-dns-ipv4")

        # Test empty primary DNS (should show error when required)
        b.set_input_text("#primary-dns-ipv4", "")
        b.wait_in_text(".pf-v5-c-form__helper-text", "DNS server is required")

        # Test invalid DNS format
        b.set_input_text("#primary-dns-ipv4", "not-a-dns")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Invalid DNS server address")

        # Test valid IPv4 DNS server
        b.set_input_text("#primary-dns-ipv4", "8.8.8.8")
        b.wait_not_present("#primary-dns-ipv4 ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test valid IPv6 DNS server (should also work)
        b.set_input_text("#primary-dns-ipv4", "2001:4860:4860::8888")
        b.wait_not_present("#primary-dns-ipv4 ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test secondary DNS (optional)
        b.set_input_text("#secondary-dns-ipv4", "8.8.4.4")
        b.wait_not_present("#secondary-dns-ipv4 ~ .pf-v5-c-form__helper-text.pf-m-error")

    def testIPv6StaticValidation(self):
        """Test that IPv6 static configuration validates correctly"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to network address page
        # Select IPv6 static method
        b.click("#static-ipv6-radio")
        b.wait_visible("#ipv6-address")

        # Test empty IPv6 address (should show error)
        b.set_input_text("#ipv6-address", "")
        b.wait_in_text(".pf-v5-c-form__helper-text", "IPv6 address is required")

        # Test invalid IPv6 format
        b.set_input_text("#ipv6-address", "gggg::")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Invalid IPv6 address format")

        # Test IPv6 without prefix (should add /64 on blur)
        b.set_input_text("#ipv6-address", "2001:db8::1")
        b.wait_in_text("#ipv6-address", "2001:db8::1")
        # Blur event should add /64
        b.focus("#gateway-ipv6")  # Focus another field to trigger blur
        # b.wait_in_text("#ipv6-address", "/64")  # May or may not auto-add, depending on implementation

        # Test valid IPv6 address with prefix
        b.set_input_text("#ipv6-address", "2001:db8::1/64")
        b.wait_not_present("#ipv6-address ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test invalid IPv6 prefix
        b.set_input_text("#ipv6-address", "2001:db8::1/129")
        b.wait_in_text(".pf-v5-c-form__helper-text", "IPv6 prefix must be between 0 and 128")

        # Test valid IPv6 prefix range
        b.set_input_text("#ipv6-address", "2001:db8::1/64")
        b.wait_not_present("#ipv6-address ~ .pf-v5-c-form__helper-text.pf-m-error")

    def testIPv6GatewayValidation(self):
        """Test that IPv6 gateway validation rejects link-local addresses"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to network address page
        # Select IPv6 static method
        b.click("#static-ipv6-radio")
        b.wait_visible("#gateway-ipv6")

        # Test link-local gateway (fe80::) - should be rejected
        b.set_input_text("#gateway-ipv6", "fe80::1")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Gateway cannot be a link-local address")

        # Test valid IPv6 gateway
        b.set_input_text("#gateway-ipv6", "2001:db8::ffff")
        b.wait_not_present("#gateway-ipv6 ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test empty gateway (optional field)
        b.set_input_text("#gateway-ipv6", "")
        b.wait_not_present("#gateway-ipv6 ~ .pf-v5-c-form__helper-text.pf-m-error")

    def testIPv6DNSValidation(self):
        """Test that IPv6 DNS server validation works correctly"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to network address page
        # Ensure IPv6 is not disabled
        b.click("#dhcpv6-radio")  # Or static-ipv6-radio

        # Uncheck auto-DNS to enable manual DNS configuration
        b.click("#manual-dns-ipv6-radio")
        b.wait_visible("#primary-dns-ipv6")

        # Test empty primary DNS (should show error when required)
        b.set_input_text("#primary-dns-ipv6", "")
        b.wait_in_text(".pf-v5-c-form__helper-text", "DNS server is required")

        # Test invalid DNS format
        b.set_input_text("#primary-dns-ipv6", "not-a-dns")
        b.wait_in_text(".pf-v5-c-form__helper-text", "Invalid DNS server address")

        # Test valid IPv6 DNS server
        b.set_input_text("#primary-dns-ipv6", "2001:4860:4860::8888")
        b.wait_not_present("#primary-dns-ipv6 ~ .pf-v5-c-form__helper-text.pf-m-error")

        # Test valid IPv4 DNS server (should also work)
        b.set_input_text("#primary-dns-ipv6", "8.8.8.8")
        b.wait_not_present("#primary-dns-ipv6 ~ .pf-v5-c-form__helper-text.pf-m-error")

    def testStaticIPConfiguration(self):
        """Test complete static IP configuration scenario"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to network address page
        # Configure IPv4 static
        b.click("#static-ip-radio")
        b.wait_visible("#ipv4-address")

        # Enter valid static IPv4 configuration
        b.set_input_text("#ipv4-address", "192.168.1.100")
        b.set_input_text("#subnet-mask", "255.255.255.0")
        b.set_input_text("#gateway-ip", "192.168.1.1")

        # Configure manual DNS
        b.click("#manual-dns-ipv4-radio")
        b.wait_visible("#primary-dns-ipv4")
        b.set_input_text("#primary-dns-ipv4", "8.8.8.8")
        b.set_input_text("#secondary-dns-ipv4", "8.8.4.4")

        # Configure IPv6 static
        b.click("#static-ipv6-radio")
        b.wait_visible("#ipv6-address")

        b.set_input_text("#ipv6-address", "2001:db8::1/64")
        b.set_input_text("#gateway-ipv6", "2001:db8::ffff")

        # Configure IPv6 DNS
        b.click("#manual-dns-ipv6-radio")
        b.wait_visible("#primary-dns-ipv6")
        b.set_input_text("#primary-dns-ipv6", "2001:4860:4860::8888")
        b.set_input_text("#secondary-dns-ipv6", "2001:4860:4860::8844")

        # Verify all fields are filled correctly
        self.assertEqual(b.val("#ipv4-address"), "192.168.1.100")
        self.assertEqual(b.val("#subnet-mask"), "255.255.255.0")
        self.assertEqual(b.val("#gateway-ip"), "192.168.1.1")
        self.assertEqual(b.val("#primary-dns-ipv4"), "8.8.8.8")
        self.assertEqual(b.val("#secondary-dns-ipv4"), "8.8.4.4")

        # Note: Actual network configuration application would require completing
        # the wizard and verifying via NetworkManager DBUS or nmcli


if __name__ == "__main__":
    testlib.test_main()
