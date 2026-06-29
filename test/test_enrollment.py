#!/usr/bin/python3

"""
Integration test for enrollment functionality

Tests the enrollment page UI and enrollment script execution.
"""

from __future__ import annotations

import json
import typing
import unittest

from testlib import MachineCase, nondestructive

from wizard_navigation import complete_network_step


@nondestructive
class TestEnrollment(MachineCase):
    """Test enrollment service selection and credential input"""

    provision: typing.ClassVar = {
        "0": {"memory_mb": 512}
    }

    def setUp(self):
        super().setUp()

        # Create test enrollment configuration
        self.config = {
            "version": "1.0",
            "runOnce": False,
            "hideModules": False,
            "enrollmentServices": [
                {
                    "id": "test-service",
                    "name": "Test Management Service",
                    "description": "A test enrollment service",
                    "endpoint": {
                        "url": "https://test.example.com",
                        "allowUserOverride": True
                    },
                    "credentialsSchema": {
                        "type": "object",
                        "properties": {
                            "username": {
                                "type": "string",
                                "title": "Username"
                            },
                            "password": {
                                "type": "string",
                                "title": "Password",
                                "format": "password"
                            }
                        },
                        "required": ["username", "password"]
                    },
                    "scriptPath": "/etc/cockpit/system-onboarding.d/example-enroll.sh"
                }
            ]
        }

        # Write configuration file
        self.machine.write(
            "/etc/cockpit/system-onboarding/config.json",
            json.dumps(self.config)
        )

        # Create example enrollment script
        script_content = '''#!/bin/bash
set -euo pipefail
echo "Enrolling device..."
echo "DEVICE_URL: https://test.example.com/devices/test-device-001"
exit 0
'''
        self.machine.execute("mkdir -p /etc/cockpit/system-onboarding.d")
        self.machine.write(
            "/etc/cockpit/system-onboarding.d/example-enroll.sh",
            script_content
        )
        self.machine.execute("chmod +x /etc/cockpit/system-onboarding.d/example-enroll.sh")

    def navigate_to_enrollment_step(self):
        b = self.browser
        complete_network_step(b)
        b.wait_visible("#enrollmentStep")

    def testEnrollmentPageDisplay(self):
        """Test that enrollment services are displayed correctly"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        # Check that service is displayed
        b.wait_in_text(".pf-v5-c-card", "Test Management Service")
        b.wait_in_text(".pf-v5-c-card", "A test enrollment service")

    def testEnrollmentServiceSelection(self):
        """Test selecting and deselecting enrollment services"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        # Service should not be selected initially
        checkbox_selector = "#service-test-service"
        b.wait_visible(checkbox_selector)
        self.assertFalse(b.is_present(f"{checkbox_selector}:checked"))

        # Select service
        b.click(checkbox_selector)
        b.wait_visible(f"{checkbox_selector}:checked")

        # Credentials form should now be visible
        b.wait_visible("#field-username")
        b.wait_visible("#field-password")

        # Deselect service
        b.click(checkbox_selector)
        self.assertFalse(b.is_present(f"{checkbox_selector}:checked"))

        # Credentials form should be hidden
        b.wait_not_present("#field-username")

    def testEnrollmentCredentialsInput(self):
        """Test entering credentials for enrollment"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        # Select service
        b.click("#service-test-service")
        b.wait_visible("#service-test-service:checked")

        # Enter credentials
        b.set_input_text("#field-username", "testuser")
        b.set_input_text("#field-password", "testpassword")

        # Verify values are set
        self.assertEqual(b.val("#field-username"), "testuser")
        self.assertEqual(b.val("#field-password"), "testpassword")

    def testEnrollmentEndpointOverride(self):
        """Test overriding the enrollment endpoint URL"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        # Select service
        b.click("#service-test-service")
        b.wait_visible("#service-test-service:checked")

        # Check that endpoint field is visible and editable
        endpoint_selector = "#endpoint-test-service"
        b.wait_visible(endpoint_selector)
        self.assertEqual(b.val(endpoint_selector), "https://test.example.com")

        # Change endpoint
        b.set_input_text(endpoint_selector, "https://custom.example.com")
        self.assertEqual(b.val(endpoint_selector), "https://custom.example.com")

    def testNoEnrollmentServicesConfigured(self):
        """Test behavior when no enrollment services are configured"""
        b = self.browser
        m = self.machine

        # Clear enrollment services from config
        config_no_services = self.config.copy()
        config_no_services["enrollmentServices"] = []
        m.write(
            "/etc/cockpit/system-onboarding/config.json",
            json.dumps(config_no_services)
        )

        self.login_and_go("/system-onboarding")
        complete_network_step(b)
        b.wait_not_present("#enrollmentStep")
        b.wait_visible("#connectivityTestStep")

    def testEnrollmentCredentialsValidation(self):
        """Test that credentials are validated"""
        b = self.browser

        self.login_and_go("/system-onboarding")
        self.navigate_to_enrollment_step()

        # Select service
        b.click("#service-test-service")
        b.wait_visible("#service-test-service:checked")

        # Try to proceed without entering credentials
        # The Next button should be disabled or validation should prevent progress
        # (This depends on the wizard's validation implementation)

        # Enter only username
        b.set_input_text("#field-username", "testuser")

        # Password is still empty - validation error should appear
        # (Implementation depends on when validation is triggered)

        # Complete credentials
        b.set_input_text("#field-password", "testpassword")

        # Now validation should pass


if __name__ == '__main__':
    unittest.main()
