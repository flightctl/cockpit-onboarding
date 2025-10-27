# Implementation Plan: Cockpit System Onboarding Plugin

**Branch**: `001-system-onboarding` | **Date**: 2025-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-system-onboarding/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

The Cockpit System Onboarding Plugin provides a wizard-based interface for performing initial network configuration and management service enrollment on newly deployed headless Linux systems. The plugin enables users to access the system via a temporary WiFi access point or well-known Ethernet IP, configure hostname, network interfaces, IP addresses, time services, and enroll into management services (e.g., Red Hat Insights, Flight Control). The implementation leverages Cockpit's DBUS libraries for system configuration, React 18 + PatternFly 6 for the UI, and follows Cockpit's testing and packaging standards.

## Technical Context

**Language/Version**: TypeScript 5.x + JavaScript ES2022 (React components in TSX, utilities in TS/JS)
**Primary Dependencies**: React 18.x, PatternFly 6.x, Cockpit framework, NetworkManager (DBUS API), esbuild (build system)
**Storage**: JSON configuration files (default: `/usr/share/cockpit/system-onboarding/config.json`, user override: `/etc/cockpit/system-onboarding/config.json`), DBUS services (hostname1, timedate1, NetworkManager), marker files
**Testing**: Cockpit browser test framework (Python + Chrome DevTools Protocol for integration tests), Jest + React Testing Library (for unit tests - NEEDS IMPLEMENTATION)
**Target Platform**: Linux (RHEL 9+, Fedora 40+, CentOS Stream 9+, other systemd-based distributions)
**Project Type**: Web application (Cockpit module - single-page React application)
**Performance Goals**: <2s initial page load on typical hardware, <200ms UI interactions (per constitution Principle V)
**Constraints**: Minimal runtime dependencies, must work on resource-constrained embedded systems, <5MB bundle size
**Scale/Scope**: Single-page wizard (~10 steps), configuration management for network/system services, extensible enrollment framework

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Starter Kit Fidelity ✅ PASS
- Using existing `build.js` and esbuild configuration without modifications
- Maintaining `pkg/lib/` vendored libraries as read-only
- No structural changes that would prevent upstream updates
- **Action**: Continue using existing build system

### Principle II: Zero Dependency Growth ✅ PASS
- No new runtime dependencies required
- Existing stack (React 18, PatternFly 6, TypeScript, esbuild) is sufficient
- Optional dependencies (hostapd, dnsmasq) for WiFi AP feature are runtime-only, not build dependencies
- **Action**: Implement all features using existing dependencies

### Principle III: Integration Test Discipline ⚠️ NEEDS ATTENTION
- Integration tests MUST be written using Cockpit's Python + CDP framework
- Tests must cover all user workflows from spec (User Stories 1-10)
- Tests must run in CI (Cirrus CI and Packit)
- **Action Required**: Write comprehensive integration test suite before feature completion
- **Risk**: Feature cannot be merged without integration tests

### Principle IV: Code Quality Gates ✅ PASS
- `make codecheck` will be enforced (ESLint + Stylelint)
- TypeScript type checking enabled
- Pre-commit hooks can enforce quality gates
- **Action**: Ensure all code passes static analysis

### Principle V: User-Centric Design ✅ PASS
- Using PatternFly 6 wizard component for consistent UX
- Keyboard navigation and accessibility built into PatternFly
- Error messages are actionable (validation feedback on each field)
- Performance targets met (<2s load, <200ms interactions)
- **Action**: Follow PatternFly design patterns, test accessibility

### Principle VI: DBUS Over CLI ✅ PASS
- Already using DBUS for:
  - hostname1 service (hostname configuration)
  - timedate1 service (NTP configuration)
  - NetworkManager (network configuration)
- CLI commands only where necessary (e.g., enrollment scripts, WiFi AP setup)
- **Action**: Continue preferring DBUS APIs

### Gate Status: ✅ CONDITIONAL PASS
**Requirements for full pass**:
1. Complete integration test suite (Principle III)
2. All tests passing in CI before merge

**No violations requiring justification in Complexity Tracking table**

## Project Structure

### Documentation (this feature)

```text
specs/001-system-onboarding/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── configuration-schema.json    # Config file JSON schema
│   ├── enrollment-api.md            # Enrollment script interface
│   └── led-controller-api.md        # LED control tool interface
├── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
├── spec.md              # Feature specification
└── checklists/
    └── requirements.md  # Requirements checklist
```

### Source Code (repository root)

```text
src/                                 # Application source code
├── index.tsx                        # Entry point
├── app.tsx                          # Main application component
├── model-context.tsx                # React context for wizard state
├── interfaces.js                    # NetworkManager interfaces
├── helpers.js                       # Utility functions
├── utils.js                         # General utilities
├── types.d.ts                       # TypeScript type definitions
├── service.d.ts                     # Service type definitions
├── system-config.ts                 # System configuration service (DBUS operations)
├── config-loader.ts                 # [TO ADD] Configuration file loader
├── led-controller.ts                # [TO ADD] LED indicator controller
├── enrollment-executor.ts           # [TO ADD] Enrollment script executor
└── wizard/                          # Wizard step components
    ├── HostnamePage.tsx
    ├── NetworkInterfacePage.tsx
    ├── NetworkAddressPage.tsx
    ├── NetworkServicesPage.tsx      # NTP, Proxy configuration
    ├── EnrollmentPage.tsx
    ├── ReviewPage.tsx
    └── EnrollmentProgressPage.tsx

test/                                # Integration tests (Python + CDP)
├── check-application                # Main test runner script
├── common/                          # Test utilities
└── TestMain.py                      # Test suite entry point

packaging/                           # RPM packaging and systemd units
├── cockpit-system-onboarding.spec.in   # RPM spec template
├── arch/
│   └── PKGBUILD.in                  # Arch Linux package template
├── overrides/                       # Cockpit module overrides
│   ├── apps.override.json
│   ├── machines.override.json
│   └── ...                          # Other module overrides
├── system-onboarding.d/             # Enrollment action scripts
│   ├── 01-flightctl-login.sh
│   ├── 02-flightctl-get-enrollment-config.sh
│   └── 03-flightctl-enroll.sh
├── systemd/                         # [TO ADD] Systemd units
│   ├── cockpit-system-onboarding-setup.service
│   ├── cockpit-system-onboarding-wifi-ap.service
│   └── scripts/
│       ├── create-onboarding-user.sh
│       ├── setup-wifi-ap.sh
│       └── cleanup-onboarding.sh
└── sudoers.d/                       # [TO ADD] Sudoers configuration
    └── cockpit-system-onboarding

pkg/lib/                             # Vendored Cockpit libraries (READ-ONLY)
├── cockpit.js                       # Core Cockpit API
├── service.js                       # Service management
├── serverTime.js                    # Time/NTP utilities
└── ...                              # Other Cockpit libraries

dist/                                # Build output (generated, not committed)
└── system-onboarding/
    ├── index.html
    ├── manifest.json
    ├── index.js
    ├── index.css
    └── config.json                  # Default configuration
```

**Structure Decision**: This is a Cockpit module (web application) following the standard Cockpit starter kit structure. The `src/` directory contains TypeScript/React components for the UI, `test/` contains Python-based integration tests using Cockpit's browser test framework, and `packaging/` contains RPM spec files and systemd units for installation. The `pkg/lib/` directory is maintained as read-only vendored code from upstream Cockpit.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**No violations** - All constitutional principles are satisfied or have clear mitigation paths. The conditional pass on Principle III (Integration Test Discipline) is addressed through the requirement to complete tests before merge.

---

## Post-Design Constitution Re-Evaluation

*Re-evaluated after completing Phase 0 (Research) and Phase 1 (Design)*

### Updated Assessment

After completing the design phase with research.md, data-model.md, contracts/, and quickstart.md, the constitutional compliance remains strong:

**Principle I: Starter Kit Fidelity** ✅ CONFIRMED PASS
- Design maintains existing build.js and esbuild configuration
- No modifications to pkg/lib/ vendored libraries
- All new code in src/ follows existing patterns
- **Evidence**: Project structure in plan.md preserves starter kit layout

**Principle II: Zero Dependency Growth** ✅ CONFIRMED PASS
- No new runtime dependencies required
- Optional dependencies (hostapd, dnsmasq) are runtime-only, not build deps
- Unit testing dependencies (Jest, RTL) are devDependencies only
- **Evidence**: research.md confirms existing stack is sufficient

**Principle III: Integration Test Discipline** ⚠️ STILL NEEDS ATTENTION
- Integration test strategy defined in quickstart.md
- Test coverage must include all 10 user stories from spec
- Remains a gate for merge approval
- **Action**: Write integration tests during implementation phase
- **Risk**: No change from initial assessment

**Principle IV: Code Quality Gates** ✅ CONFIRMED PASS
- Code quality workflow documented in quickstart.md
- ESLint + Stylelint + TypeScript checking will be enforced
- **Evidence**: Development workflow section in quickstart.md

**Principle V: User-Centric Design** ✅ CONFIRMED PASS
- PatternFly Wizard component provides consistent UX
- Validation rules defined in data-model.md provide clear error messages
- Device URL hyperlinks improve user experience
- LED feedback provides non-visual status updates
- **Evidence**: data-model.md validation rules, enrollment-api.md device URLs

**Principle VI: DBUS Over CLI** ✅ CONFIRMED PASS
- All system operations use DBUS APIs:
  - hostname1 for hostname configuration
  - timedate1 for NTP configuration
  - NetworkManager for network configuration
- CLI commands only used where DBUS unavailable (WiFi AP setup, enrollment scripts)
- **Evidence**: research.md sections 7-8, system-config.ts already implements DBUS calls

### Gate Status: ✅ CONDITIONAL PASS (Unchanged)

**No new concerns identified** during design phase. All decisions align with constitutional principles.

**Path to Full Pass**:
1. Complete integration test suite covering all user stories
2. Ensure tests pass in CI (Cirrus CI and Packit)
3. No violations requiring complexity tracking
