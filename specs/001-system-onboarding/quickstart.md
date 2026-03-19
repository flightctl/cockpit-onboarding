# Quickstart Guide: Cockpit System Onboarding Plugin

**Date**: 2025-10-27
**Target Audience**: Developers implementing the System Onboarding feature
**Prerequisites**: Familiarity with TypeScript, React, and Linux system administration

## 1. Development Environment Setup

### Clone and Build

```bash
# Clone repository
git clone https://github.com/cockpit-project/cockpit-system-onboarding.git
cd cockpit-system-onboarding

# Install dependencies (from existing package.json)
npm install

# Build the project
make

# Watch mode for development (auto-rebuild on changes)
make watch
```

### Install for Local Testing

```bash
# Create symlink to dist/ in Cockpit modules directory
make devel-install

# Access at: http://localhost:9090/system-onboarding
# Login with your local user (requires Cockpit to be running)
```

### Uninstall Development Version

```bash
make devel-uninstall
```

---

## 2. Project Structure Overview

```
cockpit-system-onboarding/
├── src/                      # Source code
│   ├── app.tsx               # Main application component
│   ├── model-context.tsx     # Wizard state management (React context)
│   ├── system-config.ts      # System configuration service (DBUS)
│   ├── config-loader.ts      # [TO ADD] Load configuration file
│   ├── led-controller.ts     # [TO ADD] LED indicator control
│   ├── enrollment-executor.ts # [TO ADD] Execute enrollment scripts
│   └── wizard/               # Wizard step components
│       ├── HostnamePage.tsx
│       ├── NetworkInterfacePage.tsx
│       ├── NetworkAddressPage.tsx
│       ├── NetworkServicesPage.tsx
│       ├── EnrollmentPage.tsx
│       ├── ReviewPage.tsx
│       └── EnrollmentProgressPage.tsx
├── test/                     # Integration tests
│   ├── check-application     # Test runner
│   └── TestMain.py           # Test suite
├── packaging/                # RPM packaging and systemd units
│   ├── cockpit-system-onboarding.spec.in
│   └── systemd/              # [TO ADD] First-boot systemd units
├── specs/                    # Design documents
│   └── 001-system-onboarding/
│       ├── spec.md           # Feature specification
│       ├── plan.md           # Implementation plan
│       ├── research.md       # Research findings
│       ├── data-model.md     # Data model
│       ├── contracts/        # API contracts
│       └── quickstart.md     # This file
└── pkg/lib/                  # Vendored Cockpit libraries (READ-ONLY)
```

---

## 3. Key Implementation Tasks

### Phase 1: Configuration Loading (Priority: High)

**File**: `src/config-loader.ts`

**Purpose**: Load plugin configuration from JSON files with fallback hierarchy

**Implementation Checklist**:
- [ ] Read default config from `/usr/share/cockpit/system-onboarding/config.json`
- [ ] Read user override from `/etc/cockpit/system-onboarding/config.json`
- [ ] Merge configs (user overrides default)
- [ ] Validate schema using JSON Schema validator
- [ ] Export `SystemOnboardingConfig` TypeScript interface

**Example**:
```typescript
import cockpit from 'cockpit';

export async function loadConfig(): Promise<SystemOnboardingConfig> {
  const defaultPath = '/usr/share/cockpit/system-onboarding/config.json';
  const userPath = '/etc/cockpit/system-onboarding/config.json';

  let defaultConfig = { version: '1.0' };
  let userConfig = {};

  try {
    const defaultFile = cockpit.file(defaultPath, { syntax: JSON });
    defaultConfig = await defaultFile.read();
  } catch (error) {
    console.warn('Default config not found:', error);
  }

  try {
    const userFile = cockpit.file(userPath, { syntax: JSON });
    userConfig = await userFile.read();
  } catch (error) {
    console.info('User config not found, using defaults');
  }

  return { ...defaultConfig, ...userConfig };
}
```

**Test**: Create a test config file and verify it loads correctly

---

### Phase 2: LED Controller Integration (Priority: Medium)

**File**: `src/led-controller.ts`

**Purpose**: Call external LED control tool at various onboarding stages

**Implementation Checklist**:
- [ ] Read LED config from `SystemOnboardingConfig`
- [ ] Implement `setLedState(state: LedState)` function
- [ ] Use `cockpit.spawn()` to execute LED tool
- [ ] Handle graceful degradation (tool failures should not halt onboarding)
- [ ] Call at appropriate wizard stages (ready, in-progress, applying, success, error)

**Example**:
```typescript
import cockpit from 'cockpit';

export type LedState = 'ready' | 'in-progress' | 'applying' | 'success' | 'error' | 'off';

export class LedController {
  constructor(private config: SystemOnboardingConfig) {}

  async setLedState(state: LedState): Promise<void> {
    if (!this.config.led?.enabled) return;

    const toolPath = this.config.led.tool;
    const stateArg = this.config.led.states?.[state] || state;

    try {
      const proc = cockpit.spawn([toolPath, stateArg], { err: 'message' });
      await proc;
      console.log(`LED set to state: ${state}`);
    } catch (error) {
      console.warn(`LED control failed (${state}):`, error);
      // Graceful degradation - don't fail onboarding
    }
  }
}
```

**Test**: Mock the LED tool and verify it's called with correct arguments

---

### Phase 3: Enrollment Execution (Priority: High)

**File**: `src/enrollment-executor.ts`

**Purpose**: Execute user-provided enrollment scripts with credentials

**Implementation Checklist**:
- [ ] Read enrollment services from config
- [ ] Build environment variables from wizard state
- [ ] Execute scripts using `cockpit.spawn()` with env vars
- [ ] Capture stdout/stderr in real-time
- [ ] Parse `DEVICE_URL:` from stdout
- [ ] Handle script exit codes (0=success, 1-4=specific errors)
- [ ] Display progress and results to user

**Example**:
```typescript
import cockpit from 'cockpit';

export async function executeEnrollmentScript(
  service: EnrollmentService,
  credentials: any,
  endpoint: string,
  model: OnboardingSession
): Promise<{ success: boolean; deviceUrl?: string; logs: string[] }> {

  const env = {
    ENROLLMENT_SERVICE_ID: service.id,
    ENROLLMENT_SERVICE_NAME: service.name,
    ENROLLMENT_ENDPOINT: endpoint,
    ENROLLMENT_CREDENTIALS_JSON: JSON.stringify(credentials),
    ENROLLMENT_HOSTNAME: model.hostname.value,
    ENROLLMENT_INTERFACE: model.networkInterface.selectedInterface || '',
  };

  const logs: string[] = [];
  let deviceUrl: string | undefined;

  try {
    const proc = cockpit.spawn([service.scriptPath], {
      environ: Object.keys(env).map(k => `${k}=${env[k]}`),
      err: 'message'
    });

    proc.stream((data) => {
      const lines = data.split('\n');
      lines.forEach(line => {
        logs.push(line);

        // Parse device URL
        if (line.startsWith('DEVICE_URL:')) {
          deviceUrl = line.substring('DEVICE_URL:'.length).trim();
        }
      });
    });

    await proc;
    return { success: true, deviceUrl, logs };

  } catch (error) {
    logs.push(`Error: ${error}`);
    return { success: false, logs };
  }
}
```

**Test**: Create a mock enrollment script that outputs test data

---

### Phase 4: Unit Testing Setup (Priority: High)

**Files**: `jest.config.js`, `test/__mocks__/cockpit.ts`, `test/setup.ts`

**Purpose**: Enable unit testing for React components and TypeScript modules

**Implementation Checklist**:
- [ ] Install Jest and React Testing Library
- [ ] Configure Jest for TypeScript + JSX
- [ ] Create Cockpit API mocks (cockpit.dbus, cockpit.spawn, cockpit.file)
- [ ] Write tests for wizard validation logic
- [ ] Write tests for config loading
- [ ] Write tests for LED controller
- [ ] Write tests for enrollment executor

**jest.config.js**:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '\\.(css|scss)$': 'identity-obj-proxy',
    '^cockpit$': '<rootDir>/test/__mocks__/cockpit.ts'
  }
};
```

**Example Test** (`src/wizard/__tests__/HostnamePage.test.tsx`):
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { HostnamePage } from '../HostnamePage';
import { ModelProvider } from '../../model-context';

test('validates hostname format', () => {
  render(
    <ModelProvider>
      <HostnamePage />
    </ModelProvider>
  );

  const input = screen.getByPlaceholderText(/my-system/);

  // Invalid hostname (starts with hyphen)
  fireEvent.change(input, { target: { value: '-invalid' } });
  expect(screen.getByText(/must start with alphanumeric/)).toBeInTheDocument();

  // Valid hostname
  fireEvent.change(input, { target: { value: 'valid-hostname' } });
  expect(screen.queryByText(/must start/)).not.toBeInTheDocument();
});
```

**Run Tests**:
```bash
npm test
npm test -- --watch
npm test -- --coverage
```

---

### Phase 5: Integration Testing (Priority: High)

**File**: `test/TestMain.py`

**Purpose**: Test full onboarding workflow in actual VM environment

**Implementation Checklist**:
- [ ] Test WiFi AP setup (if hardware available)
- [ ] Test Ethernet access at well-known IP
- [ ] Test wizard navigation (all steps)
- [ ] Test hostname configuration
- [ ] Test network interface selection
- [ ] Test IP address configuration (static and DHCP)
- [ ] Test NTP configuration
- [ ] Test enrollment script execution
- [ ] Test LED control integration
- [ ] Test configuration persistence after reboot

**Example Test**:
```python
import testlib

class TestSystemOnboarding(testlib.MachineCase):
    def testBasicWizard(self):
        b = self.browser
        m = self.machine

        # Login to Cockpit
        self.login_and_go("/system-onboarding")

        # Step 1: Hostname
        b.wait_visible("#hostname-input")
        b.set_input_text("#hostname-input", "test-device")
        b.click("button:contains('Next')")

        # Step 2: Network interface
        b.wait_visible("#network-interface-list")
        b.click("#interface-eth0")  # Select first Ethernet interface
        b.click("button:contains('Next')")

        # ... continue through wizard steps

        # Final step: Apply configuration
        b.click("button:contains('Apply')")
        b.wait_visible("#enrollment-progress")
        b.wait_in_text("#enrollment-progress", "✓ Hostname set to: test-device")
```

**Run Integration Tests**:
```bash
make check
TEST_OS=fedora-40 make check
test/check-application -tvs  # Verbose output
```

---

### Phase 6: Systemd Units and Packaging (Priority: Medium)

**Files**: `packaging/systemd/*`, `packaging/cockpit-system-onboarding.spec.in`

**Purpose**: Create systemd units for first-boot setup and RPM packaging

**Implementation Checklist**:
- [ ] Create `cockpit-system-onboarding-setup.service` (first-boot service)
- [ ] Create `create-onboarding-user.sh` script
- [ ] Create `setup-network.sh` script (configure well-known IP)
- [ ] Create `setup-wifi-ap.sh` script (optional WiFi AP)
- [ ] Create sudoers configuration
- [ ] Update RPM spec to install systemd units
- [ ] Add `%post` scriptlet to enable services
- [ ] Add `%preun` scriptlet to clean up on uninstall

**Example systemd unit** (`packaging/systemd/cockpit-system-onboarding-setup.service`):
```ini
[Unit]
Description=Cockpit System Onboarding Setup
After=multi-user.target network.target
ConditionPathExists=!/var/lib/cockpit-system-onboarding/.onboarding-complete

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/libexec/cockpit-system-onboarding/create-onboarding-user.sh
ExecStart=/usr/libexec/cockpit-system-onboarding/setup-network.sh

[Install]
WantedBy=multi-user.target
```

**Build RPM**:
```bash
make rpm
# Output: rpmbuild/RPMS/noarch/cockpit-system-onboarding-*.rpm
```

---

## 4. Development Workflow

### Daily Development Cycle

1. **Make changes** to source files in `src/`
2. **Rebuild** using `make` (or use `make watch` for auto-rebuild)
3. **Reload browser** to see changes in Cockpit UI
4. **Run codecheck** before committing: `make codecheck`
5. **Run tests** to verify functionality: `npm test`
6. **Commit changes** following Conventional Commits format

### Code Quality Gates

Before every commit:
```bash
# Static analysis (ESLint + Stylelint)
make codecheck

# Auto-fix issues
npm run eslint:fix
npm run stylelint:fix

# Run unit tests
npm test

# Run integration tests (before PR)
make check
```

### Debugging Tips

**Debug React Components**:
- Use React DevTools browser extension
- Add `console.log()` statements in component render
- Use `debugger;` statement to pause execution

**Debug DBUS Calls**:
```typescript
const nmClient = cockpit.dbus('org.freedesktop.NetworkManager');
nmClient.addEventListener('*', (path, iface, signal, args) => {
  console.log('DBUS signal:', signal, args);
});
```

**Debug Cockpit spawn**:
```typescript
const proc = cockpit.spawn(['command'], { err: 'message' });
proc.stream((data) => console.log('stdout:', data));
proc.catch((error) => console.error('spawn error:', error));
```

**View Cockpit Logs**:
```bash
journalctl -u cockpit.service -f
journalctl -u cockpit-system-onboarding-setup.service
```

---

## 5. Common Tasks

### Add a New Wizard Step

1. Create component file: `src/wizard/NewStepPage.tsx`
2. Implement validation logic in component
3. Update `model-context.tsx` to add state for new step
4. Add `<WizardStep>` to `app.tsx`:
   ```tsx
   <WizardStep name={_('New Step')} id="wizard-step-N">
     <NewStepPage />
   </WizardStep>
   ```
5. Update `ReviewPage.tsx` to show summary of new step
6. Add integration test for new step

### Add a New Enrollment Service

1. Create enrollment script: `/etc/cockpit/system-onboarding.d/service-name.sh`
2. Make script executable: `chmod +x service-name.sh`
3. Add service to config file: `/etc/cockpit/system-onboarding/config.json`:
   ```json
   {
     "enrollmentServices": [
       {
         "id": "service-name",
         "name": "Service Display Name",
         "endpoint": {
           "url": "https://service.example.com",
           "allowUserOverride": true
         },
         "credentialsSchema": {
           "type": "object",
           "properties": {
             "username": { "type": "string", "title": "Username" },
             "password": { "type": "string", "title": "Password", "format": "password" }
           },
           "required": ["username", "password"]
         },
         "scriptPath": "/etc/cockpit/system-onboarding.d/service-name.sh"
       }
     ]
   }
   ```
4. Test enrollment script manually
5. Test in wizard UI

### Customize LED Patterns

1. Create LED control script: `/usr/local/bin/led-control`
2. Implement state handlers (ready, in-progress, applying, success, error, off)
3. Make script executable: `chmod +x /usr/local/bin/led-control`
4. Update config: `/etc/cockpit/system-onboarding/config.json`:
   ```json
   {
     "led": {
       "enabled": true,
       "tool": "/usr/local/bin/led-control",
       "states": {
         "ready": "ready",
         "success": "success"
       }
     }
   }
   ```
5. Test LED control manually: `/usr/local/bin/led-control ready`

---

## 6. Resources

### Documentation
- **Cockpit Developer Guide**: https://cockpit-project.org/guide/latest/
- **PatternFly Components**: https://www.patternfly.org/components/all-components
- **NetworkManager DBUS API**: https://networkmanager.dev/docs/api/latest/
- **systemd Unit Files**: https://www.freedesktop.org/software/systemd/man/systemd.unit.html

### Reference Implementations
- **Cockpit Networking**: https://github.com/cockpit-project/cockpit/tree/main/pkg/networkmanager
- **Cockpit System**: https://github.com/cockpit-project/cockpit/tree/main/pkg/systemd

### Support
- **GitHub Issues**: https://github.com/cockpit-project/cockpit-system-onboarding/issues
- **Cockpit Mailing List**: cockpit-devel@lists.fedorahosted.org
- **Matrix Chat**: #cockpit:fedoraproject.org

---

## 7. Next Steps

After completing this quickstart:

1. **Review design documents** in `specs/001-system-onboarding/`
   - Read `spec.md` for full feature requirements
   - Review `data-model.md` for entity definitions
   - Check `contracts/` for API specifications

2. **Run the `/speckit.tasks` command** to generate detailed implementation tasks

3. **Start implementing** following the priority order:
   - P1: Configuration loading, wizard UI, hostname/network configuration
   - P2: IP configuration, time/NTP, enrollment execution, summary
   - P3: LED indicators, WiFi AP setup, advanced features

4. **Write tests** as you implement (TDD recommended)

5. **Submit pull requests** when features are complete with tests passing

---

## Summary

This quickstart provides everything needed to start implementing the Cockpit System Onboarding plugin. Focus on the high-priority tasks first (configuration loading, wizard UI, basic network setup) before moving to advanced features like LED control and WiFi AP setup.

**Key Principles**:
- Follow the project constitution (see `.specify/memory/constitution.md`)
- Use DBUS APIs over CLI commands
- Write integration tests for all features
- Keep dependencies minimal
- Prioritize user experience

Happy coding! 🚀
