# Feature Specification: Cockpit System Onboarding Plugin

**Feature Branch**: `001-system-onboarding`
**Created**: 2025-10-26
**Status**: Draft
**Input**: User description: "Build a plugin for the Cockpit Project, a web-based Linux system administration tool. The plugin is called 'System Onboarding' and its purpose is to help users perform the bare minimum network configuration to allow the Linux system to connect to the internet and enroll into one or more management services using user-provided credentials."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initial System Access and Wizard Entry (Priority: P1)

A system administrator or end user needs to access a newly deployed headless Linux system to begin the onboarding process. The system does not have a console or keyboard attached, so the user connects via either a temporary WiFi access point created by the plugin or via Ethernet on a well-known IP address (e.g. 192.168.100.1). Which interfaces are available depends on the hardware and the configuration in the plugin's configuration file.

**Why this priority**: This is the foundation for all other functionality. Without the ability to access the Cockpit web console with the wizard, no other configuration can occur. This represents the absolute minimum viable product.

**Independent Test**: Can be fully tested by powering on the system, connecting to the WiFi access point or Ethernet interface, accessing the Cockpit web console at the well-known address, logging in with preconfigured credentials (onboarding/onboarding), and verifying the Onboarding menu item appears in the sidebar.

**Acceptance Scenarios**:

1. **Given** a newly deployed system with the plugin installed, **When** the user connects a phone or laptop to the temporary WiFi access point, **Then** the user is automatically redirected to the Cockpit web console login page
2. **Given** a user connected to the system's WiFi access point, **When** the user logs in with the preconfigured credentials, **Then** the user sees the Onboarding item in the Cockpit navigation sidebar
3. **Given** a newly deployed system with Ethernet connected, **When** the user navigates to http://192.168.100.1 in a browser, **Then** the Cockpit login page appears
4. **Given** the plugin configuration disables other modules, **When** the user logs into Cockpit, **Then** only the Onboarding module and Cockpit's Overview and Logs modules are visible in the sidebar
5. **Given** the user has logged in successfully, **When** the user clicks the Onboarding item in the sidebar, **Then** the wizard interface loads with the first configuration step

---

### User Story 2 - Hostname Configuration (Priority: P1)

A user wants to assign a meaningful hostname to the system to identify it on the network and in management services. The system may already have a network-assigned hostname from DHCP.

**Why this priority**: Hostname is a fundamental system identity attribute and typically the first configuration step in any setup wizard. It's simple to implement and provides immediate value.

**Independent Test**: Can be fully tested by accessing the wizard, viewing the hostname step with pre-populated DHCP hostname (if available), entering a custom hostname, validating the input, and confirming the value is accepted.

**Acceptance Scenarios**:

1. **Given** the wizard is at the hostname step, **When** the user views the hostname input field, **Then** the field is pre-populated with the network-assigned hostname if available
2. **Given** the user enters a valid hostname, **When** the user attempts to proceed to the next step, **Then** the system validates the hostname format and allows progression
3. **Given** the user enters an invalid hostname (e.g., with spaces or special characters), **When** the user attempts to proceed, **Then** the system displays a clear error message and prevents progression
4. **Given** the hostname field is empty, **When** the user attempts to proceed, **Then** the system displays a validation error requiring a hostname

---

### User Story 3 - Network Interface and Connection Selection (Priority: P1)

A user needs to select and configure the primary network interface to connect the system to the internet. The user can choose between available Ethernet and WiFi interfaces and configure WiFi credentials if needed.

**Why this priority**: Network connectivity is essential for accessing management services and completing the onboarding. This is the core purpose of the plugin.

**Independent Test**: Can be fully tested by presenting the interface selection screen, choosing an Ethernet interface (simplest case), or choosing a WiFi interface, scanning for networks, selecting a network, entering credentials, and validating the configuration.

**Acceptance Scenarios**:

1. **Given** the wizard is at the network interface step, **When** the page loads, **Then** the user sees a list of available Ethernet and WiFi interfaces
2. **Given** the user selects an Ethernet interface, **When** the user proceeds to the next step, **Then** the interface is marked as the primary connection
3. **Given** the user selects a WiFi interface, **When** the interface is selected, **Then** the user sees a list of available WiFi networks (scanned before the access point was activated)
4. **Given** a WiFi network requires authentication, **When** the user selects it, **Then** the user is prompted to select encryption type and enter the WiFi password
5. **Given** the user enters WiFi credentials, **When** the user proceeds, **Then** the system validates that all required fields are completed
6. **Given** the user wants to connect to a VLAN, **When** configuring the interface, **Then** the user can optionally enter a VLAN ID
7. **Given** the user has not selected an interface, **When** the user attempts to proceed, **Then** the system displays an error and prevents progression

---

### User Story 4 - IP Address and DNS Configuration (Priority: P2)

A user needs to configure how the system obtains its IP address, default gateway, and DNS servers. The user can choose between automatic (DHCP), manual (static), or disabled address assignment for both IPv4 and IPv6. The use can further configure a gateway (next hop router) and DNS servers.

**Why this priority**: While network interface selection (P1) establishes the connection, IP and DNS configuration is necessary for proper network communication. Many users will use DHCP defaults, but static configuration is essential for some environments. Some environments may require IPv4 only, while others may use IPv6 or dual stack.

**Independent Test**: Can be fully tested by presenting IP configuration options, selecting DHCP for quick setup, or selecting static configuration and entering IP address, netmask, gateway, and DNS servers, with validation for each field.

**Acceptance Scenarios**:

1. **Given** the wizard is at the IP configuration step, **When** the user views the page, **Then** the user sees options to configure IPv4 and IPv6 separately
2. **Given** the user selects DHCP for IPv4, **When** the user proceeds, **Then** the system marks IPv4 as automatically configured
3. **Given** the user selects static IPv4, **When** the option is chosen, **Then** the user sees input fields for IP address, netmask, and gateway
4. **Given** the user enters a static IPv4 address, **When** the format is invalid, **Then** the system displays a validation error with a clear message
5. **Given** the user configures DNS, **When** choosing between automatic and manual, **Then** the user can either use DHCP-assigned DNS or enter specific DNS server IP addresses
6. **Given** the user enters manual DNS servers, **When** the IP addresses are invalid, **Then** the system displays validation errors
7. **Given** the user selects IPv6 configuration, **When** configuring the address, **Then** the same DHCP vs static options are available as for IPv4

---

### User Story 5 - Time and NTP Configuration (Priority: P2)

A user needs to configure the system time, either manually or via NTP servers. Proper time synchronization is essential for security certificates, logging, and service enrollment.

**Why this priority**: Accurate time is critical for many system operations including TLS/SSL, authentication, and logging. However, many systems can function with default time settings initially, making this P2 rather than P1.

**Independent Test**: Can be fully tested by presenting time configuration options, selecting manual or NTP-based time, choosing network-assigned or custom NTP servers, and selecting hardware clock mode (system clock vs UTC).

**Acceptance Scenarios**:

1. **Given** the wizard is at the time configuration step, **When** the user views the page, **Then** the user sees options to configure time manually or via NTP
2. **Given** the user selects NTP time synchronization, **When** choosing NTP servers, **Then** the user can select network-assigned NTP servers or enter custom NTP server addresses
3. **Given** the user enters custom NTP servers, **When** the server addresses are invalid, **Then** the system displays validation errors
4. **Given** the user configures time settings, **When** selecting hardware clock mode, **Then** the user can choose between using system clock as hardware clock or UTC
5. **Given** the user selects manual time configuration, **When** entering the time, **Then** the user can set the current date and time

---

### User Story 6 - Configuration Summary and Confirmation (Priority: P2)

Before applying changes, the user needs to review all configuration choices made throughout the wizard to ensure everything is correct. The user can navigate back to previous steps to make changes if needed.

**Why this priority**: A summary view is essential for preventing configuration errors and giving users confidence before applying potentially disruptive changes. This completes the wizard flow and enables testing of the full user journey.

**Independent Test**: Can be fully tested by completing all wizard steps, viewing the summary page showing all configurations, using back navigation to modify a setting, returning to the summary, and confirming the changes are reflected.

**Acceptance Scenarios**:

1. **Given** the user has completed all wizard steps, **When** the user reaches the final step, **Then** the user sees a summary of all configuration choices
2. **Given** the user is viewing the summary, **When** the user clicks a "Back" or "Edit" option, **Then** the user can navigate to previous steps to review or change inputs
3. **Given** the user modifies a setting in a previous step, **When** the user returns to the summary, **Then** the updated configuration is reflected in the summary
4. **Given** the user reviews the summary, **When** the user clicks the "Apply" or "Confirm" button, **Then** the system begins applying the configuration changes
5. **Given** the wizard has a navigation flow, **When** the user is on any step, **Then** the user can navigate backward but cannot skip forward without completing required fields

---

### User Story 7 - Proxy Server Configuration (Priority: P3)

A user whose network requires a proxy server to access the internet needs to configure proxy settings including hostname, port, and optional authentication credentials.

**Why this priority**: Proxy configuration is only needed in specific network environments. Most users will not need this, making it lower priority than core networking functionality. The system can be functional without proxy support.

**Independent Test**: Can be fully tested by accessing the proxy configuration step, entering proxy hostname and port, optionally entering username and password, validating the inputs, and confirming the configuration is accepted.

**Acceptance Scenarios**:

1. **Given** the wizard is at the proxy configuration step, **When** the user views the page, **Then** the user sees input fields for proxy server hostname and port
2. **Given** the proxy requires authentication, **When** the user configures the proxy, **Then** the user can optionally enter username and password
3. **Given** the user enters proxy settings, **When** the values are invalid (e.g., non-numeric port), **Then** the system displays validation errors
4. **Given** the user's network does not require a proxy, **When** the user is at the proxy step, **Then** the user can leave fields empty and proceed to the next step

---

### User Story 8 - Management Service Enrollment (Priority: P2)

A user wants to enroll the system into one or more management services (e.g., Flight Control) using provided credentials. The specific services and their credential requirements are defined in the main configuration file or a drop-in configuration file.

**Why this priority**: Management service enrollment is essential for completing system onboarding. Further configuration of the system can depend on the system being enrolled into these services.

**Independent Test**: Can be fully tested by providing a configuration file listing management services with their credential schemas, presenting the enrollment options, selecting services to enroll in, entering credentials validated against the schema, and confirming the input is accepted.

**Acceptance Scenarios**:

1. **Given** the plugin configuration file lists management services, **When** the user reaches the enrollment step, **Then** the user sees options to enroll in each configured service
2. **Given** the user selects a management service, **When** the service requires credentials, **Then** the user sees input fields based on the schema defined in the configuration file (e.g., username/password or organization ID/activation key)
3. **Given** the user enters credentials, **When** the input format is invalid according to the schema, **Then** the system displays validation errors
4. **Given** no management services are configured, **When** the wizard runs, **Then** the enrollment step is skipped entirely
5. **Given** multiple services are available, **When** the user selects which services to enroll in, **Then** the user can choose to enroll in all, some, or none of the services

---

### User Story 9 - Change Application and Progress Monitoring (Priority: P2)

After confirming the configuration, the user needs to apply the changes to the system. During this process, the user should see progress information and understand that connectivity may be lost. The system may automatically reboot depending on configuration.

**Why this priority**: This is essential for completing the onboarding process, but it's tested as part of the full integration rather than as an independent unit. The user interface aspect can be tested independently from actual system changes.

**Independent Test**: Can be fully tested by triggering the apply changes process, observing the progress indicator, viewing log messages of actions being performed, and confirming the completion status (with or without connectivity).

**Acceptance Scenarios**:

1. **Given** the user has confirmed the configuration, **When** the system begins applying changes, **Then** the user sees a progress indicator
2. **Given** changes are being applied, **When** each action completes, **Then** the user sees log messages describing the actions (e.g., "Setting hostname to...", "Configuring network interface...")
3. **Given** the network configuration changed, **When** changes are applied, **Then** the user may lose connectivity to the Cockpit web console
4. **Given** the configuration specifies auto-reboot, **When** all changes are successfully applied, **Then** the system automatically reboots
5. **Given** the configuration specifies manual reboot, **When** all changes are applied, **Then** the user is prompted to reboot manually later
6. **Given** the configuration specifies plugin self-disable, **When** all changes are successfully applied, **Then** the plugin disables itself and creates a marker file indicating successful completion
7. **Given** an error occurs during application, **When** the process fails, **Then** the user sees a clear error message with details

---

### User Story 10 - LED Visual Feedback (Priority: P3)

During the onboarding process, especially when the user cannot see the Cockpit web console (e.g., during network reconfiguration or reboot), the user needs visual feedback via an LED connected to a GPIO pin on the system's motherboard.

**Why this priority**: LED feedback is a nice-to-have enhancement for user experience but not essential for functionality. The onboarding can be completed successfully without it, and not all systems will have LED hardware available.

**Independent Test**: Can be fully tested by calling the LED control tool at different stages with commands (on, off, slow blink, fast blink, solid), observing the LED behavior on hardware that supports it, and handling graceful degradation when LED hardware is unavailable.

**Acceptance Scenarios**:

1. **Given** the LED control tool is available, **When** the onboarding process starts, **Then** the LED shows a slow blink pattern to indicate "in progress"
2. **Given** an error occurs during onboarding, **When** the error is detected, **Then** the LED shows a fast blink pattern to indicate "error"
3. **Given** the onboarding completes successfully, **When** all changes are applied, **Then** the LED shows solid on to indicate "success"
4. **Given** the LED control tool is called during network reconfiguration, **When** the user cannot see the web console, **Then** the LED provides visual status feedback
5. **Given** the system does not have LED hardware, **When** the LED control tool is called, **Then** the tool fails gracefully without disrupting the onboarding process
6. **Given** the LED tool is packaged as an RPM, **When** the package is installed, **Then** the tool is available for the plugin to call

---

### Edge Cases

- What happens when the user loses WiFi connectivity while connected to the temporary access point and the wizard is in progress?
- How does the system handle invalid WiFi credentials that result in connection failure?
- What happens when a management service enrollment fails due to invalid credentials or service unavailability?
- How does the system behave when the LED control tool is called but GPIO hardware is not available?
- What happens when the configuration file is malformed or contains invalid JSON schema definitions?
- How does the system handle the case where no network interfaces are available?
- What happens when the user provides a static IP configuration that conflicts with the network?
- How does the system handle partial application of changes (e.g., some steps succeed, others fail)?
- What happens when the user attempts to configure a VLAN that doesn't exist on the network?
- How does the system respond when attempting to disable itself after completion but the marker file cannot be written due to permissions?

## Requirements *(mandatory)*

### Functional Requirements

**Initial Access & Authentication:**
- **FR-001**: System MUST provide a temporary WiFi access point on first startup to allow initial connection from user devices if a WiFi interface is available and configured in the plugin configuration file
- **FR-002**: System MUST be accessible via a well-known Ethernet IP address (by default 192.168.100.1) as an alternative to WiFi access point if an Ethernet interface is available and configured in the plugin configuration file
- **FR-003**: System MUST automatically redirect users connecting to the WiFi access point to the Cockpit web console login page
- **FR-004**: System MUST provide preconfigured login credentials (username: "onboarding", password: "onboarding") for initial access
- **FR-005**: Plugin MUST appear as "Onboarding" item in the Cockpit navigation sidebar
- **FR-006**: Plugin MUST support a configuration file that can disable other Cockpit modules when specified

**Wizard Interface:**
- **FR-007**: Plugin MUST present a step-by-step wizard interface for guiding users through configuration
- **FR-008**: System MUST validate user inputs at each step and provide clear error messages for invalid inputs
- **FR-009**: System MUST prevent users from proceeding to the next step until all required inputs are provided and valid
- **FR-010**: Users MUST be able to navigate backward to previous steps to review or change inputs
- **FR-011**: System MUST prevent users from skipping forward past required configuration steps

**Hostname Configuration:**
- **FR-012**: System MUST provide a text input field for entering the desired hostname
- **FR-013**: System MUST pre-populate the hostname field with the network-assigned hostname if available via DHCP
- **FR-014**: System MUST validate hostname format according to standard hostname conventions
- **FR-015**: System MUST require a hostname before allowing progression to the next step

**Network Interface Selection:**
- **FR-016**: System MUST display a list of available network interfaces including both Ethernet and WiFi
- **FR-017**: System MUST allow the user to select one interface as the primary connection
- **FR-018**: System MUST scan for available WiFi networks before activating the temporary access point
- **FR-019**: When a WiFi interface is selected, system MUST present the list of scanned WiFi networks
- **FR-020**: System MUST prompt the user to select encryption type when configuring a WiFi connection
- **FR-021**: System MUST provide a secure input field for entering WiFi passwords
- **FR-022**: System MUST allow optional VLAN ID configuration for the selected network interface
- **FR-023**: System MUST validate VLAN ID as a numeric value in the valid range (1-4094)

**IP Address and DNS Configuration:**
- **FR-024**: System MUST provide separate configuration options for IPv4 and IPv6
- **FR-025**: System MUST allow users to choose between automatic (DHCPv4), static, or disabled IP address assignment for IPv4
- **FR-026**: System MUST allow users to choose between automatic (DHCPv6), static, or disabled IP address assignment for IPv6
- **FR-027**: When static IPv4 is selected, system MUST provide input fields for IP address, netmask, and gateway
- **FR-028**: When static IPv6 is selected, system MUST provide input fields for IPv6 address, prefix length, and gateway
- **FR-029**: System MUST validate IP address formats (IPv4 and IPv6) and display clear error messages for invalid entries
- **FR-030**: System MUST allow users to choose between automatic DNS server assignment via DHCP or manual DNS server entry
- **FR-031**: When manual DNS is selected, system MUST provide input fields for entering DNS server IP addresses
- **FR-032**: System MUST validate DNS server IP addresses and display errors for invalid formats

**Proxy Configuration:**
- **FR-033**: System MUST provide input fields for proxy server hostname and port
- **FR-034**: System MUST allow proxy configuration to be optional (fields can be left empty)
- **FR-035**: System MUST provide optional input fields for proxy username and password
- **FR-036**: System MUST validate proxy port as a numeric value

**Time/NTP Configuration:**
- **FR-037**: System MUST allow users to choose between manual time configuration and NTP-based synchronization
- **FR-038**: When NTP is selected, system MUST allow users to choose between network-assigned NTP servers or manually entered NTP server addresses
- **FR-039**: System MUST validate manually entered NTP server addresses
- **FR-040**: System MUST allow users to choose between using system clock as hardware clock or UTC

**Management Service Enrollment:**
- **FR-041**: Plugin MUST read a configuration file that lists available management services and their credential schemas
- **FR-042**: System MUST present enrollment options for each management service defined in the configuration file
- **FR-043**: System MUST allow users to select which services to enroll in (all, some, or none)
- **FR-044**: For each selected service, system MUST present input fields based on the JSON schema defined in the configuration file
- **FR-045**: System MUST validate service credentials against the schema from the configuration file
- **FR-046**: When no management services are configured, system MUST skip the enrollment step entirely

**Summary and Confirmation:**
- **FR-047**: System MUST present a summary page showing all configuration choices made by the user
- **FR-048**: Summary page MUST allow users to navigate back to any previous step to modify settings
- **FR-049**: System MUST reflect any modified settings in the summary when the user returns from a previous step
- **FR-050**: System MUST require explicit user confirmation before applying configuration changes

**Change Application:**
- **FR-051**: System MUST apply all confirmed configuration changes to the underlying Linux system
- **FR-052**: System MUST display a progress indicator during the change application process
- **FR-053**: System MUST display log messages describing each action being performed (e.g., "Setting hostname to...", "Configuring network interface...")
- **FR-054**: System MUST execute predefined actions for standard configurations (hostname, network, time, etc.)
- **FR-055**: System MUST execute custom actions from the configuration file for management service enrollments
- **FR-056**: Custom enrollment actions MUST support writing configuration files, executing commands, and printing log messages
- **FR-057**: System MUST support configuration option to automatically reboot after successful application of all changes
- **FR-058**: System MUST support configuration option to prompt user for manual reboot later
- **FR-059**: System MUST support configuration option to disable the Cockpit module after successful completion
- **FR-060**: When self-disable is configured, system MUST create a hidden marker file indicating successful onboarding completion
- **FR-061**: System MUST display clear error messages with details when application of changes fails

**LED Visual Feedback:**
- **FR-062**: Plugin MUST call an external LED control tool at appropriate stages of the onboarding process
- **FR-063**: LED control tool MUST accept commands to turn LED on, off, or make it blink in different patterns
- **FR-064**: LED control tool MUST support slow blink pattern for "in progress" status
- **FR-065**: LED control tool MUST support fast blink pattern for "error" status
- **FR-066**: LED control tool MUST support solid on for "success" status
- **FR-067**: LED control tool MUST interact with GPIO pins on the system motherboard
- **FR-068**: LED control tool MUST fail gracefully when GPIO hardware is not available
- **FR-069**: LED control tool MUST be packaged as an installable RPM alongside the plugin

**Packaging and Deployment:**
- **FR-070**: Plugin MUST be packaged as an installable RPM for supported Linux distributions
- **FR-071**: Plugin MUST support an optional configuration file to customize onboarding behavior
- **FR-072**: Plugin MUST follow Cockpit's design principles and integration guidelines
- **FR-073**: Plugin MUST be accessible and usable without deep technical knowledge of Linux system administration

### Key Entities

- **Configuration File**: Defines onboarding behavior including which Cockpit modules to disable, whether to auto-reboot, whether to self-disable, available management services, and service credential schemas (JSON-based, react-jsonschema format)
- **Network Interface**: Represents an Ethernet or WiFi interface available on the system; includes attributes like interface name, type (Ethernet/WiFi), MAC address, current status
- **WiFi Network**: Represents a scanned WiFi network; includes SSID, signal strength, encryption type
- **IP Configuration**: Contains IPv4/IPv6 address assignment method (DHCP/static), IP address, netmask/prefix, gateway, DNS servers
- **Management Service**: Represents a service for system enrollment; includes service name, connection details, credential requirements (defined by JSON schema), enrollment commands/scripts
- **Onboarding Session**: Tracks the state of a user's progress through the wizard; includes current step, configuration values for each step, validation status
- **Marker File**: Hidden file indicating successful onboarding completion; prevents the wizard from running again after successful configuration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Non-technical users can successfully complete the entire onboarding process in under 15 minutes
- **SC-002**: 95% of users successfully configure network connectivity on the first attempt without requiring technical support
- **SC-003**: Users receive visual LED feedback within 2 seconds of each major state change (progress, error, success)
- **SC-004**: Configuration changes are successfully applied and persist after system reboot
- **SC-005**: Users can navigate backward through the wizard and modify settings without losing data in under 30 seconds
- **SC-006**: 90% of users correctly understand wizard validation errors and can resolve input issues on the first attempt
- **SC-007**: The wizard handles loss of connectivity gracefully, allowing users to reconnect and complete the process
- **SC-008**: Management service enrollment succeeds within 60 seconds when valid credentials are provided
- **SC-009**: The plugin successfully disables itself after completion when configured to do so, preventing re-run
- **SC-010**: LED control tool fails gracefully on systems without GPIO hardware without disrupting the onboarding process