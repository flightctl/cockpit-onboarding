# Developer Guide

## Dependencies

On Debian/Ubuntu:

    sudo apt install gettext nodejs npm make

On Fedora:

    sudo dnf install gettext nodejs npm make

## Building

```sh
git clone https://github.com/fzdarsky/cockpit-system-onboarding.git
cd cockpit-system-onboarding
make
```

In `production` mode, source files are automatically minified and compressed. Set `NODE_ENV=production` to duplicate this behavior.

## Installing locally

`make install` installs the package to `/usr/local/share/cockpit/`. For RPM builds, use `make srpm` or `make rpm`.

For development, link the build output directly into Cockpit's package directory:

```sh
make devel-install
```

Or manually:

```sh
mkdir -p ~/.local/share/cockpit
ln -s "$(pwd)/dist" ~/.local/share/cockpit/system-onboarding
```

To uninstall: `make devel-uninstall` or `rm ~/.local/share/cockpit/system-onboarding`.

## Watch mode

Automatically rebuild on code changes:

    make watch

When developing against a virtual machine, set `RSYNC` to upload changes automatically:

    RSYNC=c make watch

The `c` alias must be setup according to these [instructions](https://github.com/cockpit-project/cockpit/blob/main/test/README.md#convenient-test-vm-ssh-access). In the next section you can learn how to configure it for the test VM.

To upload to `~/.local/share/cockpit/` (as a normal user) instead of `/usr/local`:

    RSYNC_DEVEL=example.com make watch

## Code quality

Run all static checks (ESLint, Stylelint, TypeScript):

    make codecheck

Individual tools:

    npm run eslint          # JavaScript/TypeScript linting
    npm run eslint:fix      # auto-fix ESLint violations
    npm run stylelint       # CSS/SCSS linting
    npm run stylelint:fix   # auto-fix Stylelint violations

Configuration files: `.eslintrc.json`, `.stylelintrc.json`.

## Test VM

Create a Fedora QEMU/KVM VM pre-provisioned with the onboarding RPM, dual ethernet NICs, and simulated WiFi interfaces:

```sh
make deploy-test-vm
```

This downloads a Fedora Cloud image, creates a VM with two ethernet interfaces and two virtual WiFi radios (`mac80211_hwsim`), installs all dependencies, builds and installs the onboarding RPM, and starts the setup service. The VM IP is printed at the end — access the wizard at `https://<ip>:9090`.

After the VM is ready, sync local code changes on every rebuild:

    RSYNC=fedora@<ip> make watch

The deploy script prepares `/usr/local/share/cockpit/` on the VM for rsync. Cockpit loads
that directory in addition to the RPM-installed files under `/usr/share/cockpit/`.

To destroy the VM:

```sh
make clean-test-vm
```

See the [Testing WiFi Interfaces](README.md#testing-wifi-interfaces) section in the README for details on WiFi simulation and how to enable internet connectivity through the virtual radios.

## Running tests

### Locally

Build an RPM, install into a test VM, and run integration tests:

    make check

This uses Cockpit's Chrome DevTools Protocol based browser tests. After the VM is prepared, re-run tests without rebuilding:

    TEST_OS=centos-9-stream test/check-application -tvs

Set up the test environment without running tests:

    TEST_OS=centos-9-stream make prepare-check

Test against a different OS image:

    TEST_OS=fedora-40 make check

### In CI

The project supports [Cirrus CI](https://cirrus-ci.org/) (see [.cirrus.yml](.cirrus.yml)) and [Packit](https://packit.dev/) (see [packit.yaml](packit.yaml)) for automated testing. Packit tests run for all supported Fedora releases using the [FMF metadata format](https://github.com/teemtee/fmf) and the [tmt test management tool](https://docs.fedoraproject.org/en-US/ci/tmt/). Note that Packit tests only run [@nondestructive tests](https://github.com/cockpit-project/cockpit/blob/main/test/common/testlib.py).

## Releases

Create a signed tag with release notes:

```
123

- this new feature
- fix bug #123
```

Pushing the tag triggers the [release.yml](.github/workflows/release.yml.disabled) GitHub Actions workflow, which builds and publishes the release tarball. The workflow is disabled by default — see the comment at the top of the file to enable it.

Fedora and COPR releases are handled by [Packit](https://packit.dev/) (see [packit.yaml](packit.yaml)).

## Automated maintenance

NPM dependency updates are managed by [Dependabot](https://github.com/dependabot) (see [.github/dependabot.yml](.github/dependabot.yml)).

## Further reading

- [Cockpit Deployment and Developer documentation](https://cockpit-project.org/guide/latest/)
- [Making a Cockpit application](https://cockpit-project.org/blog/making-a-cockpit-application.html)
