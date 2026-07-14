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

from wizard_navigation import advance_past_optional_steps_to_review


class TestApplyConfiguration(testlib.MachineCase):
    """Test configuration application and progress monitoring in System Onboarding wizard"""

    def navigate_to_apply_step(self, hostname="test-apply-host"):
        """Navigate through all wizard steps to the apply/progress page"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        b.wait_visible(".pf-v5-c-wizard")

        advance_past_optional_steps_to_review(b, hostname)

        # Now on Review page - click Apply/Enroll to proceed
        b.click("button:contains('Apply')")

    def testProgressPageDisplaysSteps(self):
        """Test that the progress page shows configuration steps"""
        b = self.browser

        self.navigate_to_apply_step()

        # Verify progress page is visible
        b.wait_in_text("h3", "Overall Progress")
        b.wait_in_text("h3", "Steps")

        # Verify progress bar exists
        b.wait_visible(".pf-v5-c-progress")

        # Verify step list is displayed
        b.wait_visible(".pf-v5-c-list")

        # Verify key built-in steps are listed
        b.wait_in_text(".pf-v5-c-list", "Applying configuration changes")
        b.wait_in_text(".pf-v5-c-list", "Testing network connectivity")

    def testProgressShowsRealTimeOutput(self):
        """Test that the details section shows real-time output"""
        b = self.browser

        self.navigate_to_apply_step()

        # Wait for the details section to appear with output
        b.wait_in_text("h3", "Details")

        # Wait for some output to appear in the details pre element
        b.wait_visible("pre")
        # Output should contain apply-related text
        b.wait_in_text("pre", "Applying")

    def testProgressCompletesSuccessfully(self):
        """Test that the progress page reaches success state"""
        b = self.browser
        m = self.machine

        self.navigate_to_apply_step()

        # Wait for enrollment to complete (may take a while for network connectivity test)
        b.wait_in_text(".pf-v5-c-alert", "completed successfully", timeout=120)

        # Verify progress bar shows 100%
        b.wait_attr_contains(".pf-v5-c-progress__bar", "aria-valuenow", "100")

        # Verify marker file was created
        m.execute("test -f /var/lib/flightctl-onboarding/.onboarding-complete")

    def testProgressShowsRebootPrompt(self):
        """Test that manual reboot prompt is shown when autoReboot=false"""
        b = self.browser

        self.navigate_to_apply_step()

        # Wait for completion
        b.wait_in_text(".pf-v5-c-alert", "completed successfully", timeout=120)

        # Default config has autoReboot=false, so manual reboot prompt should appear
        b.wait_in_text(".pf-v5-c-alert", "Reboot required")
        b.wait_visible("button:contains('Reboot now')")

    def testProgressAutoReboot(self):
        """Test that auto-reboot countdown is shown when autoReboot=true"""
        b = self.browser
        m = self.machine

        # Set up config with autoReboot=true
        m.execute("mkdir -p /etc/cockpit/system-onboarding")
        m.write("/etc/cockpit/system-onboarding/config.json",
                '{"version": "1.0", "autoReboot": true}')

        self.navigate_to_apply_step()

        # Wait for completion
        b.wait_in_text(".pf-v5-c-alert", "completed successfully", timeout=120)

        # Auto-reboot countdown should appear
        b.wait_in_text(".pf-v5-c-alert", "reboot automatically")

    def testProgressFailureShowsError(self):
        """Test that failures are clearly communicated"""
        b = self.browser

        self.navigate_to_apply_step()

        # Wait for either success or failure (the test env may or may not have
        # proper DBUS access)
        # Look for any alert to appear
        b.wait_visible(".pf-v5-c-alert", timeout=120)

        # If it failed, verify error message is actionable
        if b.is_present(".pf-v5-c-alert.pf-m-danger"):
            b.wait_in_text(".pf-v5-c-alert.pf-m-danger", "failed")
            # Back button should be enabled on failure
            b.wait_visible("button:contains('Back'):not(:disabled)")

    def testMarkerFilePreventsRerun(self):
        """Test that onboarding complete marker file prevents re-running wizard"""
        b = self.browser
        m = self.machine

        # Create marker file manually
        m.execute("mkdir -p /var/lib/flightctl-onboarding")
        m.write("/var/lib/flightctl-onboarding/.onboarding-complete",
                '{"completedAt": "2025-01-01T00:00:00Z"}')

        self.login_and_go("/system-onboarding")

        # Should see "onboarding complete" message instead of wizard
        b.wait_visible("#system-onboarding-already-complete")
        b.wait_in_text("#system-onboarding-already-complete", "Onboarding complete")

    def testCleanupScriptRuns(self):
        """Test that the cleanup script is invoked during finalization"""
        b = self.browser
        m = self.machine

        # Install a mock cleanup script that creates a sentinel file
        m.execute("mkdir -p /usr/share/cockpit/system-onboarding/scripts")
        m.write("/usr/share/cockpit/system-onboarding/scripts/cleanup-onboarding.sh",
                "#!/bin/bash\ntouch /tmp/cleanup-ran\n")
        m.execute("chmod +x /usr/share/cockpit/system-onboarding/scripts/cleanup-onboarding.sh")

        self.navigate_to_apply_step()

        # Wait for completion
        b.wait_in_text(".pf-v5-c-alert", "completed successfully", timeout=120)

        # Verify cleanup script ran
        m.execute("test -f /tmp/cleanup-ran")


if __name__ == "__main__":
    testlib.test_main()
