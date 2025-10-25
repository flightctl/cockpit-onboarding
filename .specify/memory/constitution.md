<!--
Sync Impact Report (2025-10-25)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION CHANGE: 1.0.0 → 1.1.0
RATIONALE: Added new principle VI (DBUS Over CLI) - MINOR version bump per
           governance rules (new principle = materially expanded guidance)

SECTIONS ADDED/MODIFIED:
  - VI. DBUS Over CLI (NEW)

PREVIOUS PRINCIPLES (unchanged):
  - I. Starter Kit Fidelity
  - II. Zero Dependency Growth
  - III. Integration Test Discipline
  - IV. Code Quality Gates (Non-Negotiable)
  - V. User-Centric Design
  - Development Workflow (unchanged)
  - Governance (unchanged)

TEMPLATES STATUS:
  ✅ plan-template.md - Constitution Check section compatible with new principle
  ✅ spec-template.md - No changes required
  ✅ tasks-template.md - No changes required
  ✅ All command files reviewed - No updates needed

FOLLOW-UP: None required
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-->

# Cockpit System Onboarding Constitution

## Core Principles

### I. Starter Kit Fidelity

**Rule**: The project MUST maintain compatibility with the upstream Cockpit starter kit.

- Vendored libraries in `pkg/lib/` MUST NOT be modified or replaced
- The core build system (`build.js`, esbuild configuration) MUST NOT be fundamentally
  altered in ways that prevent upstream updates
- Deviations from starter kit structure require explicit documentation of merge strategy
- When upstream starter kit updates are available, they MUST be evaluated for
  integration within one release cycle

**Rationale**: Preserving alignment with the starter kit ensures the project benefits from
upstream improvements in build tooling, testing infrastructure, and Cockpit integration
patterns without costly merge conflicts or technical debt.

### II. Zero Dependency Growth

**Rule**: New runtime or development dependencies MUST NOT be added without exceptional
justification and explicit approval in design documents.

- The existing stack (React 18, PatternFly 6, TypeScript, esbuild) is sufficient for all
  typical module needs
- Additional libraries violate resource-efficiency and increase maintenance burden
- If a dependency is deemed truly necessary, the design document MUST include:
  - Clear justification why existing tools are insufficient
  - Bundle size impact analysis
  - Long-term maintenance commitment plan
  - Simpler alternatives that were rejected and why

**Rationale**: Every dependency is a liability—security updates, breaking changes, bundle
bloat. The Cockpit ecosystem provides rich component libraries (PatternFly) and utilities.
Resource-constrained environments benefit from lean bundles and minimal attack surface.

### III. Integration Test Discipline

**Rule**: All user-facing features MUST have integration test coverage using Cockpit's
test framework before being considered complete.

- Tests MUST be written using the Cockpit browser test framework (Python + CDP)
- Tests MUST verify actual user workflows, not just API contracts
- Tests MUST run in CI (Cirrus CI and Packit) and pass before merge
- Non-destructive tests are preferred for Packit compatibility (no VM-only features
  unless marked `@nondestructive`)
- When tests fail in CI, fixing tests takes priority over new features

**Rationale**: Cockpit modules run in diverse environments (RHEL, Fedora, Debian). Manual
testing cannot cover this matrix reliably. Integration tests catch real-world breakage from
OS updates, browser changes, and interaction bugs that unit tests miss. This directly serves
code quality and user experience goals.

### IV. Code Quality Gates (Non-Negotiable)

**Rule**: All code changes MUST pass static analysis before commit or merge.

- `make codecheck` MUST pass (ESLint + Stylelint with zero violations)
- Auto-fixable violations SHOULD be fixed via `npm run eslint:fix` and
  `npm run stylelint:fix`
- Rules in `.eslintrc.json` and `.stylelintrc.json` MUST NOT be disabled without
  documented justification in PR description
- TypeScript type errors are considered static analysis failures
- Git commit hooks or PR checks MUST enforce these gates

**Rationale**: Consistent code style and type safety reduce cognitive load, prevent bugs,
and make the codebase accessible to new contributors. Automated enforcement removes
subjectivity and maintains quality bar across all contributors.

### V. User-Centric Design

**Rule**: User experience MUST drive technical decisions, not the reverse.

- All UI components MUST use PatternFly 6 design patterns for consistency with Cockpit
- Accessibility (WCAG 2.1 AA) is mandatory: keyboard navigation, screen readers, color
  contrast MUST be tested
- User workflows MUST be validated against actual system administrator tasks (not
  developer assumptions)
- Error messages MUST be actionable (tell users what to do, not just what failed)
- Performance targets: Initial page load <2s on typical hardware, UI interactions <200ms

**Rationale**: Cockpit targets system administrators who value efficiency and clarity. Poor
UX leads to errors, support burden, and abandonment. PatternFly compliance ensures
familiarity. Accessibility is both a legal requirement and an equity issue—many sysadmins
rely on assistive technologies.

### VI. DBUS Over CLI

**Rule**: System service control MUST use Cockpit's DBUS library functions directly over
command-line interface execution when equivalent functionality exists or can be simply
implemented.

- Prefer DBUS APIs provided by Cockpit's `cockpit.dbus()` or similar abstractions
- Use CLI commands only when:
  - No DBUS interface exists for the required functionality
  - Implementing a DBUS wrapper would be complex or unreliable
  - The operation is a one-time setup task (not a runtime operation)
- Document justification when CLI is chosen over available DBUS alternatives
- Avoid parsing CLI output (text scraping) when structured DBUS properties/methods are
  available

**Rationale**: DBUS provides type-safe, machine-readable interfaces that are more reliable
than parsing command-line output. CLI output formats can change between system versions,
breaking fragile regex parsers. DBUS also offers better performance (no process spawning
overhead), asynchronous operation support, and signal-based notifications for state changes.
This aligns with Cockpit's architectural philosophy and improves code quality and
resource-efficiency.

## Development Workflow

### Build and Test Cycle

1. **Development**: Use `make watch` for rapid iteration with automatic rebuilds
2. **Local Testing**: Use `make devel-install` to test in actual Cockpit instance
3. **Quality Check**: Run `make codecheck` before every commit
4. **Integration Testing**: Run `make check` or manual `test/check-application -tvs`
   before opening PRs
5. **Cleanup**: Use `make clean` to remove stale build artifacts when troubleshooting

### Commit Standards

- Commits MUST pass codecheck gates (enforced by hooks if configured)
- Commit messages SHOULD follow Conventional Commits format (e.g., `fix:`, `feat:`,
  `test:`)
- Each commit SHOULD represent a logical, atomic change
- Breaking changes MUST be called out in commit message body

### Review Requirements

- All PRs MUST pass CI (Cirrus CI and Packit tests)
- At least one approval required from project maintainer
- PR description MUST reference related issues or spec documents
- Screenshots/recordings SHOULD be included for UI changes

## Governance

### Authority and Precedence

This constitution supersedes informal practices, personal preferences, and undocumented
conventions. When in conflict, constitution principles override convenience.

### Amendment Process

1. Proposed amendments MUST be documented in a PR to this file
2. Version number MUST be updated according to semantic versioning:
   - **MAJOR**: Removing or fundamentally redefining principles (backward-incompatible
     governance change)
   - **MINOR**: Adding new principles or materially expanding guidance
   - **PATCH**: Clarifications, typo fixes, non-semantic refinements
3. Amendments require approval from project maintainer(s)
4. Sync Impact Report (see header comment) MUST be updated
5. Dependent templates (plan, spec, tasks) MUST be reviewed for consistency and updated
   if needed
6. Amendment rationale MUST be clear in PR description

### Compliance Review

- PRs introducing new features MUST include a "Constitution Check" section in design docs
  (per `plan-template.md`)
- Violations of core principles MUST be explicitly justified in Complexity Tracking table
- Unjustified violations are grounds for PR rejection
- Retrospective reviews (quarterly) SHOULD assess whether principles remain fit for
  purpose

### Enforcement

- CI MUST enforce Code Quality Gates (Principle IV) automatically
- Reviewers SHOULD reference specific principles when requesting changes
- Repeated violations without justification may result in PR rejection or elevated review
  requirements

**Version**: 1.1.0 | **Ratified**: 2025-10-25 | **Last Amended**: 2025-10-25
