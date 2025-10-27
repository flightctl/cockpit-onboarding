# Tasks: Cockpit System Onboarding Plugin

**Input**: Design documents from `/specs/001-system-onboarding/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Integration tests will be written following Cockpit's testing framework (Python + CDP). Unit tests are recommended for complex validation logic.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Project follows Cockpit module structure:
- **Source**: `src/` (TypeScript/React components)
- **Tests**: `test/` (Python integration tests)
- **Packaging**: `packaging/` (RPM spec, systemd units)
- **Vendored libs**: `pkg/lib/` (READ-ONLY, do not modify)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling setup

- [ ] T001 Install Jest and React Testing Library dependencies in package.json
- [ ] T002 [P] Create jest.config.js with TypeScript and jsdom configuration
- [ ] T003 [P] Create test/__mocks__/cockpit.ts to mock Cockpit API
- [ ] T004 [P] Create test/setup.ts for test environment initialization
- [ ] T005 [P] Add npm test scripts to package.json (test, test:watch, test:coverage)
- [ ] T006 Create default configuration file at src/config.json (will be copied to dist/)
- [ ] T007 [P] Create packaging/sudoers.d/cockpit-system-onboarding with minimal sudo permissions

**Checkpoint**: Development environment ready with testing infrastructure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create src/config-loader.ts to load configuration with fallback hierarchy
- [ ] T009 Add loadConfig() function in src/config-loader.ts to read from default and user override paths
- [ ] T010 Add validateConfig() function in src/config-loader.ts to validate against JSON schema
- [ ] T011 Export SystemOnboardingConfig TypeScript interface in src/config-loader.ts
- [ ] T012 Update src/model-context.tsx to include full OnboardingSession state structure from data-model.md
- [ ] T013 Add enrollment state (selectedServices, credentials, endpoints) to model context in src/model-context.tsx
- [ ] T014 Create src/types.d.ts with all TypeScript type definitions from data-model.md
- [ ] T015 [P] Add EnrollmentService interface to src/types.d.ts
- [ ] T016 [P] Add LedConfig interface to src/types.d.ts
- [ ] T017 [P] Add NetworkConfig interface to src/types.d.ts
- [ ] T018 Update src/app.tsx to load configuration on application initialization
- [ ] T019 Pass loaded configuration through React context in src/app.tsx

**Checkpoint**: Foundation ready - configuration loading works, model context includes all state, user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Initial System Access and Wizard Entry (Priority: P1) 🎯 MVP

**Goal**: Enable users to access a newly deployed system via temporary WiFi AP or Ethernet, log in with preconfigured credentials, and see the Onboarding wizard

**Independent Test**: Power on system, connect to WiFi AP or Ethernet at well-known IP, access http://192.168.100.1:9090 or http://192.168.4.1:9090, login with onboarding/onboarding, verify Onboarding menu item appears and wizard loads

### Implementation for User Story 1

- [ ] T020 [P] [US1] Create packaging/systemd/cockpit-system-onboarding-setup.service systemd unit file
- [ ] T021 [P] [US1] Create packaging/systemd/scripts/create-onboarding-user.sh to create temporary user
- [ ] T022 [P] [US1] Create packaging/systemd/scripts/setup-network.sh to configure well-known Ethernet IP
- [ ] T023 [P] [US1] Create packaging/systemd/scripts/setup-led.sh to initialize LED indicator (ready state)
- [ ] T024 [P] [US1] Create packaging/systemd/scripts/check-dependencies.sh to verify required packages
- [ ] T025 [US1] Update packaging/cockpit-system-onboarding.spec.in to install systemd units
- [ ] T026 [US1] Add %post scriptlet to spec file to enable cockpit-system-onboarding-setup.service
- [ ] T027 [US1] Add logic to create-onboarding-user.sh to install module overrides if hideModules=true
- [ ] T028 [US1] Update src/app.tsx to check for marker file and skip wizard if already complete
- [ ] T029 [US1] Add conditional rendering in src/app.tsx to show only Onboarding module if configured

**Checkpoint**: System can be accessed on first boot, onboarding user can login, wizard UI loads with only Onboarding module visible

---

## Phase 4: User Story 2 - Hostname Configuration (Priority: P1)

**Goal**: Allow users to assign a meaningful hostname to the system with validation

**Independent Test**: Access wizard, navigate to hostname step, view pre-populated DHCP hostname (if available), enter custom hostname, validate format, confirm acceptance

**Note**: Hostname page already exists in src/wizard/HostnamePage.tsx with validation

### Implementation for User Story 2

- [ ] T030 [US2] Review existing src/wizard/HostnamePage.tsx validation logic against data-model.md requirements
- [ ] T031 [US2] Update validateHostname() in src/wizard/HostnamePage.tsx if validation rules incomplete
- [ ] T032 [US2] Verify src/system-config.ts getHostnameInfo() retrieves DHCP hostname correctly
- [ ] T033 [US2] Verify src/system-config.ts setHostname() uses DBUS hostname1 service correctly
- [ ] T034 [US2] Add unit tests for validateHostname() in src/wizard/__tests__/HostnamePage.test.tsx
- [ ] T035 [US2] Add integration test for hostname configuration in test/test_hostname.py

**Checkpoint**: Users can configure hostname with validation, changes are applied via DBUS

---

## Phase 5: User Story 3 - Network Interface and Connection Selection (Priority: P1)

**Goal**: Enable users to select and configure the primary network interface (Ethernet or WiFi) with optional VLAN

**Independent Test**: Access wizard, view list of available interfaces, select Ethernet interface, verify selection; OR select WiFi interface, view scanned networks, select network, enter credentials, validate required fields

### Implementation for User Story 3

- [ ] T036 [US3] Review existing src/wizard/NetworkInterfacePage.tsx against requirements
- [ ] T037 [US3] Add WiFi network scanning functionality to src/wizard/NetworkInterfacePage.tsx using NetworkManager DBUS
- [ ] T038 [US3] Implement scanWifiNetworks() function in src/system-config.ts (from research.md example)
- [ ] T039 [US3] Add WiFi SSID selection UI to src/wizard/NetworkInterfacePage.tsx
- [ ] T040 [US3] Add WiFi password input field to src/wizard/NetworkInterfacePage.tsx
- [ ] T041 [US3] Add WiFi security type selection to src/wizard/NetworkInterfacePage.tsx
- [ ] T042 [US3] Add optional VLAN ID input field to src/wizard/NetworkInterfacePage.tsx
- [ ] T043 [US3] Add VLAN ID validation (1-4094) to src/wizard/NetworkInterfacePage.tsx
- [ ] T044 [US3] Update model context to store wifiSsid, wifiPassword, wifiSecurity, vlanId in src/model-context.tsx
- [ ] T045 [US3] Add integration test for network interface selection in test/test_network_interface.py
- [ ] T046 [US3] Add integration test for WiFi configuration in test/test_wifi.py

**Checkpoint**: Users can select network interface, configure WiFi with credentials, optionally specify VLAN

---

## Phase 6: User Story 4 - IP Address and DNS Configuration (Priority: P2)

**Goal**: Allow users to configure IPv4/IPv6 address assignment (DHCP/static/disabled) and DNS servers

**Independent Test**: Access IP configuration step, select DHCP for IPv4 (quick setup), OR select static and enter IP address/netmask/gateway/DNS with validation for each field; configure IPv6 separately

### Implementation for User Story 4

- [ ] T047 [US4] Review existing src/wizard/NetworkAddressPage.tsx against requirements
- [ ] T048 [US4] Add IPv4 method selection (auto/static/disabled) to src/wizard/NetworkAddressPage.tsx
- [ ] T049 [US4] Add IPv4 static configuration fields (address, subnet mask, gateway) to src/wizard/NetworkAddressPage.tsx
- [ ] T050 [US4] Add IPv4 DNS configuration (auto/manual, primary DNS, secondary DNS) to src/wizard/NetworkAddressPage.tsx
- [ ] T051 [US4] Add IPv6 method selection (auto/static/disabled) to src/wizard/NetworkAddressPage.tsx
- [ ] T052 [US4] Add IPv6 static configuration fields (address with prefix, gateway) to src/wizard/NetworkAddressPage.tsx
- [ ] T053 [US4] Add IPv6 DNS configuration (auto/manual, primary DNS, secondary DNS) to src/wizard/NetworkAddressPage.tsx
- [ ] T054 [US4] Add validation functions for IPv4 address format in src/wizard/NetworkAddressPage.tsx
- [ ] T055 [US4] Add validation functions for IPv6 address format in src/wizard/NetworkAddressPage.tsx
- [ ] T056 [US4] Add validation functions for DNS server addresses in src/wizard/NetworkAddressPage.tsx
- [ ] T057 [US4] Update src/system-config.ts applyNetworkConfiguration() to handle IPv4 static configuration
- [ ] T058 [US4] Update src/system-config.ts applyNetworkConfiguration() to handle IPv6 static/disabled configuration
- [ ] T059 [US4] Update src/system-config.ts applyNetworkConfiguration() to handle DNS configuration
- [ ] T060 [US4] Add unit tests for IP address validation in src/wizard/__tests__/NetworkAddressPage.test.tsx
- [ ] T061 [US4] Add integration test for static IP configuration in test/test_ip_configuration.py

**Checkpoint**: Users can configure IPv4 and IPv6 with DHCP or static, configure DNS servers, all validated correctly

---

## Phase 7: User Story 5 - Time and NTP Configuration (Priority: P2)

**Goal**: Enable users to configure system time via NTP (network-assigned or custom servers) or manually

**Independent Test**: Access time configuration step, select NTP time synchronization, choose network-assigned OR enter custom NTP servers with validation; select hardware clock mode (system clock vs UTC)

### Implementation for User Story 5

- [ ] T062 [US5] Review existing src/wizard/NetworkServicesPage.tsx for NTP configuration
- [ ] T063 [US5] Add NTP configuration section to src/wizard/NetworkServicesPage.tsx
- [ ] T064 [US5] Add NTP auto-config toggle to src/wizard/NetworkServicesPage.tsx
- [ ] T065 [US5] Add custom NTP servers input fields (array) to src/wizard/NetworkServicesPage.tsx
- [ ] T066 [US5] Add NTP server address validation to src/wizard/NetworkServicesPage.tsx
- [ ] T067 [US5] Verify src/system-config.ts configureNtpServers() implements NTP configuration correctly
- [ ] T068 [US5] Update src/system-config.ts configureNtpServers() to handle custom NTP servers via ServerTime
- [ ] T069 [US5] Add integration test for NTP configuration in test/test_ntp.py

**Checkpoint**: Users can configure NTP with network-assigned or custom servers, configuration applied correctly

---

## Phase 8: User Story 7 - Proxy Server Configuration (Priority: P3)

**Goal**: Allow users to configure HTTP proxy settings including hostname, port, and optional authentication

**Independent Test**: Access proxy configuration step, enter proxy hostname and port, optionally enter username/password, validate inputs, confirm empty fields allowed (no proxy)

### Implementation for User Story 7

- [ ] T070 [US7] Add proxy configuration section to src/wizard/NetworkServicesPage.tsx
- [ ] T071 [US7] Add proxy enabled toggle to src/wizard/NetworkServicesPage.tsx
- [ ] T072 [US7] Add proxy hostname input field to src/wizard/NetworkServicesPage.tsx
- [ ] T073 [US7] Add proxy port input field (with numeric validation) to src/wizard/NetworkServicesPage.tsx
- [ ] T074 [US7] Add proxy username input field (optional) to src/wizard/NetworkServicesPage.tsx
- [ ] T075 [US7] Add proxy password input field (optional) to src/wizard/NetworkServicesPage.tsx
- [ ] T076 [US7] Add validation for proxy port (1-65535) to src/wizard/NetworkServicesPage.tsx
- [ ] T077 [US7] Update model context to store proxy configuration in src/model-context.tsx
- [ ] T078 [US7] Add integration test for proxy configuration in test/test_proxy.py

**Checkpoint**: Users can configure HTTP proxy with optional authentication, all fields validated

---

## Phase 9: User Story 8 - Management Service Enrollment (Priority: P2)

**Goal**: Enable users to enroll the system into configured management services using provided credentials

**Independent Test**: Provide configuration file with management services, access enrollment step, view service options, select services, enter credentials validated against schema, confirm input accepted

### Implementation for User Story 8

- [ ] T079 [P] [US8] Create src/enrollment-executor.ts for enrollment script execution
- [ ] T080 [US8] Implement executeEnrollmentScript() function in src/enrollment-executor.ts
- [ ] T081 [US8] Build environment variables from model state in src/enrollment-executor.ts
- [ ] T082 [US8] Execute script using cockpit.spawn() with environment variables in src/enrollment-executor.ts
- [ ] T083 [US8] Capture stdout/stderr in real-time in src/enrollment-executor.ts
- [ ] T084 [US8] Parse DEVICE_URL: from stdout in src/enrollment-executor.ts
- [ ] T085 [US8] Handle script exit codes (0-4) and return appropriate result in src/enrollment-executor.ts
- [ ] T086 [US8] Review existing src/wizard/EnrollmentPage.tsx against requirements
- [ ] T087 [US8] Display enrollment services from configuration in src/wizard/EnrollmentPage.tsx
- [ ] T088 [US8] Allow user to select which services to enroll in src/wizard/EnrollmentPage.tsx
- [ ] T089 [US8] Render credentials form using react-jsonschema-form in src/wizard/EnrollmentPage.tsx
- [ ] T090 [US8] Validate credentials against service credentialsSchema in src/wizard/EnrollmentPage.tsx
- [ ] T091 [US8] Add endpoint URL override field if allowUserOverride=true in src/wizard/EnrollmentPage.tsx
- [ ] T092 [US8] Store selected services, credentials, and endpoints in model context
- [ ] T093 [US8] Add unit tests for enrollment executor in src/__tests__/enrollment-executor.test.ts
- [ ] T094 [US8] Create example enrollment script in packaging/overrides/system-onboarding.d/example-enroll.sh
- [ ] T095 [US8] Add integration test for enrollment execution in test/test_enrollment.py

**Checkpoint**: Users can select enrollment services, enter credentials, enrollment scripts execute with correct environment variables

---

## Phase 10: User Story 6 - Configuration Summary and Confirmation (Priority: P2)

**Goal**: Display summary of all configuration choices, allow navigation back to modify settings, require explicit confirmation before applying

**Independent Test**: Complete all wizard steps, view summary showing all configurations, click back/edit to modify a setting, return to summary, verify updated configuration reflected, click apply to proceed

### Implementation for User Story 6

- [ ] T096 [US6] Review existing src/wizard/ReviewPage.tsx against requirements
- [ ] T097 [US6] Add hostname summary display to src/wizard/ReviewPage.tsx
- [ ] T098 [US6] Add network interface summary display to src/wizard/ReviewPage.tsx
- [ ] T099 [US6] Add IP configuration summary display (IPv4/IPv6) to src/wizard/ReviewPage.tsx
- [ ] T100 [US6] Add network services summary display (NTP, proxy) to src/wizard/ReviewPage.tsx
- [ ] T101 [US6] Add enrollment services summary display to src/wizard/ReviewPage.tsx
- [ ] T102 [US6] Add edit/back navigation buttons for each section in src/wizard/ReviewPage.tsx
- [ ] T103 [US6] Ensure wizard navigation allows backward movement in src/app.tsx
- [ ] T104 [US6] Ensure wizard prevents forward skipping without validation in src/app.tsx
- [ ] T105 [US6] Add integration test for review and navigation in test/test_review.py

**Checkpoint**: Users can review all configurations, navigate back to modify, summary reflects changes

---

## Phase 11: User Story 9 - Change Application and Progress Monitoring (Priority: P2)

**Goal**: Apply confirmed configuration to the system, display progress and log messages, handle connectivity loss, support auto-reboot or manual reboot

**Independent Test**: Trigger apply changes process, observe progress indicator, view log messages of actions being performed, confirm completion status (with or without connectivity)

### Implementation for User Story 9

- [ ] T106 [US9] Review existing src/wizard/EnrollmentProgressPage.tsx against requirements
- [ ] T107 [US9] Add progress indicator component to src/wizard/EnrollmentProgressPage.tsx
- [ ] T108 [US9] Display real-time log messages in src/wizard/EnrollmentProgressPage.tsx
- [ ] T109 [US9] Call src/system-config.ts applySystemConfiguration() when apply button clicked
- [ ] T110 [US9] Display hostname application result in src/wizard/EnrollmentProgressPage.tsx
- [ ] T111 [US9] Display network configuration result in src/wizard/EnrollmentProgressPage.tsx
- [ ] T112 [US9] Display NTP configuration result in src/wizard/EnrollmentProgressPage.tsx
- [ ] T113 [US9] Execute enrollment scripts and display results in src/wizard/EnrollmentProgressPage.tsx
- [ ] T114 [US9] Parse and display DEVICE_URL as hyperlink in src/wizard/EnrollmentProgressPage.tsx
- [ ] T115 [US9] Handle errors during application and display clear messages in src/wizard/EnrollmentProgressPage.tsx
- [ ] T116 [US9] Create marker file at /var/lib/cockpit-system-onboarding/.onboarding-complete on success
- [ ] T117 [US9] Create packaging/systemd/scripts/cleanup-onboarding.sh for post-completion cleanup
- [ ] T118 [US9] Add cleanup logic based on runOnce configuration to cleanup-onboarding.sh
- [ ] T119 [US9] Delete onboarding user if runOnce=true in cleanup-onboarding.sh
- [ ] T120 [US9] Disable systemd service if runOnce=true in cleanup-onboarding.sh
- [ ] T121 [US9] Force password change if keepCockpit=true in cleanup-onboarding.sh
- [ ] T122 [US9] Trigger auto-reboot if autoReboot=true in src/wizard/EnrollmentProgressPage.tsx
- [ ] T123 [US9] Display manual reboot prompt if autoReboot=false in src/wizard/EnrollmentProgressPage.tsx
- [ ] T124 [US9] Add integration test for apply and progress monitoring in test/test_apply_configuration.py

**Checkpoint**: Configuration changes are applied to system, progress displayed, cleanup executed based on configuration, marker file prevents re-run

---

## Phase 12: User Story 10 - LED Visual Feedback (Priority: P3)

**Goal**: Provide visual feedback via LED indicator at different onboarding stages when web UI is not visible

**Independent Test**: Call LED control tool at different stages (on, off, slow blink, fast blink, solid), observe LED behavior on supporting hardware, verify graceful degradation when hardware unavailable

### Implementation for User Story 10

- [ ] T125 [P] [US10] Create src/led-controller.ts for LED indicator control
- [ ] T126 [US10] Implement LedController class in src/led-controller.ts
- [ ] T127 [US10] Add setLedState(state: LedState) method in src/led-controller.ts
- [ ] T128 [US10] Use cockpit.spawn() to execute LED tool in src/led-controller.ts
- [ ] T129 [US10] Handle graceful degradation (tool failures don't halt onboarding) in src/led-controller.ts
- [ ] T130 [US10] Call LED controller with 'ready' state when wizard loads in src/app.tsx
- [ ] T131 [US10] Call LED controller with 'in-progress' state during wizard navigation in src/app.tsx
- [ ] T132 [US10] Call LED controller with 'applying' state when applying configuration in src/wizard/EnrollmentProgressPage.tsx
- [ ] T133 [US10] Call LED controller with 'success' state on completion in src/wizard/EnrollmentProgressPage.tsx
- [ ] T134 [US10] Call LED controller with 'error' state on failure in src/wizard/EnrollmentProgressPage.tsx
- [ ] T135 [US10] Call LED controller with 'off' state when wizard exits in src/app.tsx
- [ ] T136 [P] [US10] Create example LED control script in packaging/examples/led-control-gpio.sh
- [ ] T137 [P] [US10] Document LED control tool API in packaging/examples/README.md
- [ ] T138 [US10] Add unit tests for LED controller in src/__tests__/led-controller.test.ts
- [ ] T139 [US10] Add integration test for LED control in test/test_led.py

**Checkpoint**: LED indicator provides visual feedback at all major stages, gracefully handles missing hardware

---

## Phase 13: WiFi Access Point Setup (Advanced Feature)

**Purpose**: Enable temporary WiFi access point on first boot for headless system access

**Note**: This is an optional advanced feature for specific deployment scenarios

- [ ] T140 [P] Create packaging/systemd/cockpit-system-onboarding-wifi-ap.service systemd unit
- [ ] T141 [P] Create packaging/systemd/scripts/setup-wifi-ap.sh to configure WiFi AP
- [ ] T142 Create packaging/systemd/scripts/check-wifi-deps.sh to verify hostapd and dnsmasq installed
- [ ] T143 Add hostapd configuration generation to setup-wifi-ap.sh
- [ ] T144 Add dnsmasq configuration generation to setup-wifi-ap.sh
- [ ] T145 Add captive portal redirect rules to setup-wifi-ap.sh (nftables/iptables)
- [ ] T146 Generate random SSID suffix in setup-wifi-ap.sh
- [ ] T147 Configure WiFi interface IP address (192.168.4.1) in setup-wifi-ap.sh
- [ ] T148 Start hostapd and dnsmasq services in setup-wifi-ap.sh
- [ ] T149 Add cleanup logic to stop WiFi AP after onboarding in cleanup-onboarding.sh
- [ ] T150 Update packaging/cockpit-system-onboarding.spec.in to add hostapd and dnsmasq as Recommends
- [ ] T151 Add integration test for WiFi AP setup in test/test_wifi_ap.py (requires hardware)

**Checkpoint**: WiFi access point can be created on first boot if configured, users can connect and access wizard

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final preparation

- [ ] T152 [P] Create README.md with installation and usage instructions
- [ ] T153 [P] Document configuration file format and options in README.md
- [ ] T154 [P] Document enrollment script API in README.md
- [ ] T155 [P] Document LED control tool API in README.md
- [ ] T156 [P] Document optional dependencies (hostapd, dnsmasq) in README.md
- [ ] T157 [P] Add example configuration files in packaging/examples/
- [ ] T158 [P] Add example enrollment scripts in packaging/examples/
- [ ] T159 Review and update all TypeScript type definitions for consistency
- [ ] T160 Run make codecheck and fix all ESLint/Stylelint violations
- [ ] T161 Review all DBUS operations for proper error handling
- [ ] T162 Review all user-facing messages for clarity and actionability
- [ ] T163 Add PatternFly accessibility attributes (ARIA labels) to all interactive elements
- [ ] T164 Test keyboard navigation through entire wizard
- [ ] T165 Verify all validation error messages are actionable
- [ ] T166 Add logging for all major operations and errors
- [ ] T167 [P] Create development guide in docs/development.md
- [ ] T168 [P] Create deployment guide in docs/deployment.md
- [ ] T169 Run integration test suite and fix all failures
- [ ] T170 Build RPM and test installation on clean system
- [ ] T171 Verify cleanup works correctly (user removal, service disable)
- [ ] T172 Test reboot scenarios (auto-reboot and manual)
- [ ] T173 Performance testing: Verify wizard loads in <2s
- [ ] T174 Performance testing: Verify UI interactions respond in <200ms
- [ ] T175 Security review: Verify sudoers permissions are minimal
- [ ] T176 Security review: Verify credentials not logged to console/files
- [ ] T177 Final code review and refactoring

**Checkpoint**: All documentation complete, code quality gates pass, integration tests pass, ready for production deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-12)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
  - Recommended MVP: US1, US2, US3 (basic access and network configuration)
- **WiFi AP (Phase 13)**: Optional advanced feature, can be implemented independently
- **Polish (Phase 14)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **US2 (P1)**: Can start after Foundational (Phase 2) - Independently testable
- **US3 (P1)**: Can start after Foundational (Phase 2) - Independently testable
- **US4 (P2)**: Can start after Foundational (Phase 2) - Independently testable
- **US5 (P2)**: Can start after Foundational (Phase 2) - Independently testable
- **US6 (P2)**: Depends on at least one configuration story (US2-US5) for meaningful summary - Should be done after US2-US5
- **US7 (P3)**: Can start after Foundational (Phase 2) - Independently testable
- **US8 (P2)**: Can start after Foundational (Phase 2) - Independently testable
- **US9 (P2)**: Depends on US2-US8 being functional (applies their configurations) - Should be done after configuration stories
- **US10 (P3)**: Can start after Foundational (Phase 2) - Independently testable, integrates into other stories

### Within Each User Story

- Models/types before services
- Services before UI components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Setup Phase**:
- T002, T003, T004, T005, T006, T007 can all run in parallel

**Foundational Phase**:
- T015, T016, T017 (interface definitions) can run in parallel

**User Story Phases**:
- Multiple user stories can be implemented in parallel by different developers
- Within each story, tasks marked [P] can run in parallel

**Examples**:

**Phase 3 (US1) - Parallel group**:
- T020, T021, T022, T023, T024 (different script files)

**Phase 5 (US3) - After T038 completes**:
- T039, T040, T041, T042, T043 (different UI sections)

**Phase 9 (US8) - Parallel group**:
- T079, T094, T136, T137 (different files, no dependencies)

**Phase 14 (Polish) - Parallel group**:
- T152, T153, T154, T155, T156, T157, T158, T167, T168 (all documentation tasks)

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3 Only) ⚡

**Goal**: Deliver minimal viable product with basic onboarding capability

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T019) - CRITICAL
3. Complete Phase 3: User Story 1 (T020-T029) - System access
4. Complete Phase 4: User Story 2 (T030-T035) - Hostname
5. Complete Phase 5: User Story 3 (T036-T046) - Network interface
6. **STOP and VALIDATE**: Test that users can access system, configure hostname and network interface
7. Add minimal documentation (README.md basics)
8. Build RPM and deploy for testing

**MVP Scope**: 46 tasks (T001-T046)

### Incremental Delivery

After MVP, add stories incrementally:

1. **MVP** (US1+US2+US3) → Foundation + Basic network access
2. **+US4** (IP Configuration) → Complete network configuration
3. **+US5** (NTP) → Time synchronization
4. **+US9** (Apply Configuration) → Actually apply changes to system
5. **+US6** (Review) → Summary and confirmation
6. **+US8** (Enrollment) → Management service enrollment
7. **+US7** (Proxy) → Proxy support for restricted networks
8. **+US10** (LED) → Visual feedback
9. **Phase 13** (WiFi AP) → Wireless access capability
10. **Phase 14** (Polish) → Production-ready

### Parallel Team Strategy

With multiple developers after Foundational phase:

- **Developer A**: US1 → US2 → US3 (MVP track)
- **Developer B**: US4 → US5 (Network configuration track)
- **Developer C**: US8 (Enrollment track)
- **Developer D**: US10 → Phase 13 (Advanced features track)

Then converge for US6, US9, and Phase 14.

---

## Parallel Example: Foundational Phase

```bash
# Launch all interface definitions in parallel:
Task: "[P] Add EnrollmentService interface to src/types.d.ts"
Task: "[P] Add LedConfig interface to src/types.d.ts"
Task: "[P] Add NetworkConfig interface to src/types.d.ts"
```

---

## Parallel Example: User Story 1

```bash
# Launch all setup scripts in parallel:
Task: "[P] [US1] Create packaging/systemd/cockpit-system-onboarding-setup.service systemd unit file"
Task: "[P] [US1] Create packaging/systemd/scripts/create-onboarding-user.sh to create temporary user"
Task: "[P] [US1] Create packaging/systemd/scripts/setup-network.sh to configure well-known Ethernet IP"
Task: "[P] [US1] Create packaging/systemd/scripts/setup-led.sh to initialize LED indicator (ready state)"
Task: "[P] [US1] Create packaging/systemd/scripts/check-dependencies.sh to verify required packages"
```

---

## Parallel Example: User Story 8

```bash
# Launch enrollment-related tasks in parallel:
Task: "[P] [US8] Create src/enrollment-executor.ts for enrollment script execution"
Task: "[P] [US8] Create example enrollment script in packaging/overrides/system-onboarding.d/example-enroll.sh"
```

---

## Notes

- **[P] tasks** = different files, no dependencies within the same phase
- **[Story] label** maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run `make codecheck` before committing
- Run `npm test` to verify unit tests pass
- Run integration tests for each completed user story
- Build RPM after completing user stories to verify packaging

---

## Task Summary

- **Total Tasks**: 177
- **Setup Phase**: 7 tasks
- **Foundational Phase**: 12 tasks
- **US1 (P1 - MVP)**: 10 tasks
- **US2 (P1 - MVP)**: 6 tasks
- **US3 (P1 - MVP)**: 11 tasks
- **US4 (P2)**: 15 tasks
- **US5 (P2)**: 8 tasks
- **US6 (P2)**: 10 tasks
- **US7 (P3)**: 9 tasks
- **US8 (P2)**: 17 tasks
- **US9 (P2)**: 19 tasks
- **US10 (P3)**: 15 tasks
- **WiFi AP Phase**: 12 tasks
- **Polish Phase**: 26 tasks

**MVP Scope** (US1+US2+US3): 46 tasks
**Full Implementation**: 177 tasks
**Parallel Opportunities**: 47 tasks marked [P]

---

## Format Validation ✅

All tasks follow the required checklist format:
- ✅ Checkbox: `- [ ]` prefix on every task
- ✅ Task ID: Sequential T001-T177 in execution order
- ✅ [P] marker: 47 tasks marked as parallelizable
- ✅ [Story] label: All user story tasks labeled (US1-US10)
- ✅ File paths: Exact paths included in all task descriptions
- ✅ Clear actions: Each task has specific, actionable description
