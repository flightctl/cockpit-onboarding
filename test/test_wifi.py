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
class TestWifi(testlib.MachineCase):
    """Test WiFi configuration in System Onboarding wizard"""

    def setUp(self):
        super().setUp()
        # Check if WiFi interface is available
        m = self.machine
        try:
            wifi_interfaces = m.execute("nmcli -t -f DEVICE,TYPE device | grep ':wifi$' | cut -d: -f1").strip()
            self.has_wifi = bool(wifi_interfaces)
            if self.has_wifi:
                self.wifi_interface = wifi_interfaces.split('\n')[0]
        except Exception:
            self.has_wifi = False
            self.wifi_interface = None

    def testWifiInterfaceDetection(self):
        """Test that WiFi interfaces are detected and shown in the interface list"""
        if not self.has_wifi:
            self.skipTest("No WiFi interface available")

        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to hostname page
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # WiFi interface should appear in the table (NetworkManager returns '802-11-wireless')
        b.wait_text("td[data-label='Type']", "802-11-wireless")

    def testWifiScanUI(self):
        """Test that WiFi scan UI appears when WiFi interface is selected"""
        if not self.has_wifi:
            self.skipTest("No WiFi interface available")

        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to hostname page
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # Select WiFi interface
        # Find the row with wifi type and click its radio button
        wifi_row_selector = f"tr:has(td[data-label='Name']:contains('{self.wifi_interface}'))"
        b.wait_visible(wifi_row_selector)
        b.click(f"{wifi_row_selector} input[type='radio']")

        # WiFi configuration section should appear
        b.wait_in_text("h3", f"WiFi Network Configuration for {self.wifi_interface}")

        # Should show scanning indicator or network list
        # Wait for scanning to complete (or skip if already done)
        try:
            b.wait_visible("text='Scanning for WiFi networks...'", timeout=2)
            b.wait_not_present("text='Scanning for WiFi networks...'", timeout=10)
        except RuntimeError:
            # Scanning already complete
            pass

        # WiFi SSID selector should be present
        b.wait_visible("#wifi-ssid")

        # Security type selector should be present
        b.wait_visible("#wifi-security")

    def testWifiNetworkSelection(self):
        """Test that user can select a WiFi network from scan results"""
        if not self.has_wifi:
            self.skipTest("No WiFi interface available")

        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to hostname page
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # Select WiFi interface
        wifi_row_selector = f"tr:has(td[data-label='Name']:contains('{self.wifi_interface}'))"
        b.wait_visible(wifi_row_selector)
        b.click(f"{wifi_row_selector} input[type='radio']")

        # Wait for WiFi configuration section
        b.wait_visible("#wifi-ssid")

        # Wait for scan to complete
        try:
            b.wait_not_present("text='Scanning for WiFi networks...'", timeout=10)
        except RuntimeError:
            pass

        # SSID selector should have placeholder option
        b.wait_in_text("#wifi-ssid option:first-child", "Select a network...")

        # Check if any networks were found
        options_count = b.call_js_func("ph_count", "#wifi-ssid option")
        if options_count > 1:
            # Select a network (skip the placeholder at index 0)
            b.select_from_dropdown("#wifi-ssid", index=1)

            # Security type should auto-populate based on selected network
            security = b.val("#wifi-security")
            self.assertIn(security, ['none', 'wep', 'wpa'])

            # If security is not 'none', password field should appear
            if security != 'none':
                b.wait_visible("#wifi-password")
        else:
            # No networks found (expected in test environment without real WiFi)
            self.skipTest("No WiFi networks found in scan")

    def testWifiPasswordField(self):
        """Test that WiFi password field appears/disappears based on security type"""
        if not self.has_wifi:
            self.skipTest("No WiFi interface available")

        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to hostname page
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # Select WiFi interface
        wifi_row_selector = f"tr:has(td[data-label='Name']:contains('{self.wifi_interface}'))"
        b.wait_visible(wifi_row_selector)
        b.click(f"{wifi_row_selector} input[type='radio']")

        # Wait for WiFi configuration section
        b.wait_visible("#wifi-security")

        # Wait for scan to complete
        try:
            b.wait_not_present("text='Scanning for WiFi networks...'", timeout=10)
        except RuntimeError:
            pass

        # Set security to 'none' (open network)
        b.select_from_dropdown("#wifi-security", "None (Open)")
        b.wait_not_present("#wifi-password")

        # Set security to 'wpa'
        b.select_from_dropdown("#wifi-security", "WPA/WPA2")
        b.wait_visible("#wifi-password")

        # Test password input
        b.set_input_text("#wifi-password", "testpassword123")
        self.assertEqual(b.val("#wifi-password"), "testpassword123")

        # Verify password field is of type 'password' (hidden input)
        password_type = b.call_js_func("ph_attr", "#wifi-password", "type")
        self.assertEqual(password_type, "password")

    def testWifiRescan(self):
        """Test that Rescan button triggers a new WiFi scan"""
        if not self.has_wifi:
            self.skipTest("No WiFi interface available")

        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to hostname page
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # Select WiFi interface
        wifi_row_selector = f"tr:has(td[data-label='Name']:contains('{self.wifi_interface}'))"
        b.wait_visible(wifi_row_selector)
        b.click(f"{wifi_row_selector} input[type='radio']")

        # Wait for initial scan to complete
        b.wait_visible("#wifi-ssid")
        try:
            b.wait_not_present("text='Scanning for WiFi networks...'", timeout=10)
        except RuntimeError:
            pass

        # Click Rescan button
        b.wait_visible("button:contains('Rescan')")
        b.click("button:contains('Rescan')")

        # Should show scanning indicator again
        b.wait_visible("text='Scanning for WiFi networks...'")

        # Wait for scan to complete
        b.wait_not_present("text='Scanning for WiFi networks...'", timeout=10)

        # SSID selector should still be present
        b.wait_visible("#wifi-ssid")

    def testWifiWithVlan(self):
        """Test that VLAN can be configured together with WiFi"""
        if not self.has_wifi:
            self.skipTest("No WiFi interface available")

        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to hostname page
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # Select WiFi interface
        wifi_row_selector = f"tr:has(td[data-label='Name']:contains('{self.wifi_interface}'))"
        b.wait_visible(wifi_row_selector)
        b.click(f"{wifi_row_selector} input[type='radio']")

        # Wait for WiFi configuration section
        b.wait_visible("#wifi-ssid")

        # VLAN section should also be present
        b.wait_visible("#vlan-checkbox")

        # Enable VLAN
        b.click("#vlan-checkbox")
        b.wait_visible("input[name='vlan-id']")

        # Set VLAN ID
        b.set_input_text("input[name='vlan-id']", "200")
        self.assertEqual(b.val("input[name='vlan-id']"), "200")

        # Both WiFi and VLAN configurations should be active
        # This verifies they can coexist


if __name__ == "__main__":
    testlib.test_main()
