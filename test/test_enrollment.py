#!/usr/bin/python3

"""
Integration test for enrollment functionality

Tests the Flight Control enrollment page UI.
"""

from __future__ import annotations

import json
import typing
import unittest

from testlib import MachineCase, nondestructive

from wizard_navigation import complete_network_step


@nondestructive
class TestEnrollment(MachineCase):
    """Test Flight Control enrollment selection and credential input"""

    provision: typing.ClassVar = {
        "0": {"memory_mb": 512}
    }

    def setUp(self):
        super().setUp()

        self.config = {
            "version": "1.0",
            "runOnce": False,
            "hideModules": False,
            "flightctl": {
                "defaultEndpoint": "https://test.example.com"
            }
        }

        self.machine.write(
            "/etc/cockpit/system-onboarding/config.json",
            json.dumps(self.config)
        )

    def navigate_to_enrollment_step(self):
        b = self.browser
        complete_network_step(b)
        b.wait_visible("#enrollmentStep")

    def testEnrollmentPageDisplay(self):
        """Test that Flight Control enrollment is displayed correctly"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        b.wait_in_text(".pf-v5-c-card", "Flight Control")
        b.wait_in_text(".pf-v5-c-card", "Enroll this device into Flight Control fleet management")

    def testEnrollmentServiceSelection(self):
        """Test selecting and deselecting Flight Control enrollment"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        checkbox_selector = "#flightctl-enrollment"
        b.wait_visible(checkbox_selector)
        self.assertFalse(b.is_present(f"{checkbox_selector}:checked"))

        b.click(checkbox_selector)
        b.wait_visible(f"{checkbox_selector}:checked")

        b.wait_visible("#credential-token")

        b.click(checkbox_selector)
        self.assertFalse(b.is_present(f"{checkbox_selector}:checked"))

        b.wait_not_present("#credential-token")

    def testEnrollmentCredentialsInput(self):
        """Test entering credentials for enrollment"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        b.click("#flightctl-enrollment")
        b.wait_visible("#flightctl-enrollment:checked")

        b.set_input_text("#credential-token", "test-token")

        self.assertEqual(b.val("#credential-token"), "test-token")

    def testEnrollmentEndpointOverride(self):
        """Test overriding the enrollment endpoint URL"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        b.click("#flightctl-enrollment")
        b.wait_visible("#flightctl-enrollment:checked")

        endpoint_selector = "#endpoint-flightctl"
        b.wait_visible(endpoint_selector)
        self.assertEqual(b.val(endpoint_selector), "https://test.example.com")

        b.set_input_text(endpoint_selector, "https://custom.example.com")
        self.assertEqual(b.val(endpoint_selector), "https://custom.example.com")

    def testEnrollmentStepAlwaysVisible(self):
        """Enrollment step is always available for Flight Control"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        complete_network_step(b)
        b.wait_visible("#enrollmentStep")

    def testEnrollmentCredentialsValidation(self):
        """Test that credentials are validated"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        b.click("#flightctl-enrollment")
        b.wait_visible("#flightctl-enrollment:checked")

        b.click("#auth-password")
        b.wait_visible("#credential-username")
        b.wait_visible("#credential-password")

        b.set_input_text("#credential-username", "testuser")
        b.set_input_text("#credential-password", "testpassword")


if __name__ == '__main__':
    unittest.main()
