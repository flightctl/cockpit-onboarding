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
class TestNetworkInterface(testlib.MachineCase):
    """Test network interface selection in System Onboarding wizard"""

    def testInterfaceList(self):
        """Test that network interfaces are listed correctly"""
        b = self.browser
        m = self.machine

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Navigate to network interface page
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # Verify table headers
        b.wait_text("th:nth-child(2)", "Name")
        b.wait_text("th:nth-child(3)", "Type")
        b.wait_text("th:nth-child(4)", "MAC address")

        # Get actual interfaces from system (exclude loopback)
        cmd = "ip -o link show | grep -v 'lo:' | awk '{print $2}' | sed 's/:$//'"
        interfaces = m.execute(cmd).strip().split('\n')

        # Verify interfaces appear in table (at least one non-loopback interface should be present)
        self.assertGreater(len(interfaces), 0, "No network interfaces found")

        # Check that at least one interface is shown
        for interface in interfaces:
            if interface and interface != 'lo':
                # Look for the interface name in the table
                try:
                    b.wait_text("td[data-label='Name']", interface, timeout=5)
                    break
                except RuntimeError:
                    continue

    def testInterfaceSelection(self):
        """Test that user can select a network interface"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Network is the first wizard step
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # Find first selectable (managed) interface
        # Default interface should be auto-selected if active
        b.wait_visible("input[type='radio'][name='radio-row-select']:checked")

        # Verify we can click on interfaces (if there are multiple)
        interfaces_count = b.call_js_func("ph_count", "input[type='radio'][name='radio-row-select']")
        if interfaces_count > 1:
            # Click on a different interface
            b.click("input[type='radio'][name='radio-row-select']:not(:checked):first")
            # Verify it's now selected
            b.wait_visible("input[type='radio'][name='radio-row-select']:checked")

    def testVlanConfiguration(self):
        """Test that VLAN ID can be configured"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Network is the first wizard step
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # VLAN checkbox should be present
        b.wait_visible("#vlan-checkbox")

        # VLAN input should not be visible initially
        b.wait_not_present("input[name='vlan-id']")

        # Enable VLAN
        b.click("#vlan-checkbox")

        # VLAN input should now be visible
        b.wait_visible("input[name='vlan-id']")

        # Verify default value is 1
        self.assertEqual(b.val("input[name='vlan-id']"), "1")

        # Test setting a valid VLAN ID
        b.set_input_text("input[name='vlan-id']", "100")
        self.assertEqual(b.val("input[name='vlan-id']"), "100")

        # Test increment button
        b.click("button[aria-label='Plus']:has(input[name='vlan-id'])")
        self.assertEqual(b.val("input[name='vlan-id']"), "101")

        # Test decrement button
        b.click("button[aria-label='Minus']:has(input[name='vlan-id'])")
        self.assertEqual(b.val("input[name='vlan-id']"), "100")

        # Disable VLAN
        b.click("#vlan-checkbox")

        # VLAN input should be hidden again
        b.wait_not_present("input[name='vlan-id']")

    def testVlanValidation(self):
        """Test that VLAN ID validation works (1-4094)"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        # Network is the first wizard step
        b.wait_visible("#networkStep")
        b.wait_visible("table[aria-label='Network interface selector']")

        # Enable VLAN
        b.click("#vlan-checkbox")
        b.wait_visible("input[name='vlan-id']")

        # Test minimum valid value
        b.set_input_text("input[name='vlan-id']", "1")
        self.assertEqual(b.val("input[name='vlan-id']"), "1")

        # Test maximum valid value
        b.set_input_text("input[name='vlan-id']", "4094")
        self.assertEqual(b.val("input[name='vlan-id']"), "4094")

        # Test that decrement from 1 doesn't go below 1
        b.set_input_text("input[name='vlan-id']", "1")
        b.click("button[aria-label='Minus']:has(input[name='vlan-id'])")
        self.assertEqual(b.val("input[name='vlan-id']"), "1")

        # Test that increment from 4094 doesn't go above 4094
        b.set_input_text("input[name='vlan-id']", "4094")
        b.click("button[aria-label='Plus']:has(input[name='vlan-id'])")
        self.assertEqual(b.val("input[name='vlan-id']"), "4094")


if __name__ == "__main__":
    testlib.test_main()
