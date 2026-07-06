# extract name from package.json
PACKAGE_NAME := $(shell awk '/"name":/ {gsub(/[",]/, "", $$2); print $$2}' package.json)
RPM_NAME := cockpit-$(PACKAGE_NAME)
VERSION := $(shell T=$$(git describe --tags 2>/dev/null | sed 's/^v//'); [ -z "$$T" ] && T=0.0.1; echo $$T | tr '-' '.')
ifeq ($(TEST_OS),)
TEST_OS = centos-9-stream
endif
export TEST_OS
TARFILE=$(RPM_NAME)-$(VERSION).tar.xz
NODE_CACHE=$(RPM_NAME)-node-$(VERSION).tar.xz
SPEC=$(RPM_NAME).spec
PREFIX ?= /usr/local
BRAND_NAME ?= Flight Control
export BRAND_NAME
APPSTREAMFILE=org.cockpit_project.$(subst -,_,$(PACKAGE_NAME)).metainfo.xml
VM_IMAGE=$(CURDIR)/test/images/$(TEST_OS)
# stamp file to check for node_modules/
NODE_MODULES_STAMP=node_modules/.install-stamp
# one example file in dist/ from bundler to check if that already ran
DIST_TEST=dist/manifest.json
# one example file in pkg/lib to check if it was already checked out
COCKPIT_REPO_STAMP=pkg/lib/cockpit-po-plugin.js
# common arguments for tar, mostly to make the generated tarballs reproducible
TAR_ARGS = --sort=name --mtime "@$(shell git show --no-patch --format='%at')" --mode=go=rX,u+rw,a-s --numeric-owner --owner=0 --group=0

all: $(DIST_TEST)

# checkout common files from Cockpit repository required to build this project;
# this has no API stability guarantee, so check out a stable tag when you start
# a new project, use the latest release, and update it from time to time
COCKPIT_REPO_FILES = \
	pkg/lib \
	pkg/networkmanager/interfaces.js \
	pkg/networkmanager/networking.scss \
	pkg/networkmanager/utils.js \
	test/common \
	$(NULL)

COCKPIT_REPO_URL = https://github.com/cockpit-project/cockpit.git
COCKPIT_REPO_COMMIT = 00f46a53197e480489378f6a130f1520bbc93c32 # 350 release

$(COCKPIT_REPO_FILES): $(COCKPIT_REPO_STAMP)
COCKPIT_REPO_TREE = '$(strip $(COCKPIT_REPO_COMMIT))^{tree}'
$(COCKPIT_REPO_STAMP): Makefile
	@git rev-list --quiet --objects $(COCKPIT_REPO_TREE) -- 2>/dev/null || \
	    git fetch --no-tags --no-write-fetch-head --depth=1 $(COCKPIT_REPO_URL) $(COCKPIT_REPO_COMMIT)
	git archive $(COCKPIT_REPO_TREE) -- $(COCKPIT_REPO_FILES) | tar x
	# patch to exclude .md files from being considered scripts
	sed -i -e "s#| sort -z | uniq -z#& | grep -z -v '\\\.md\$$'#" test/common/static-code

#
# i18n
#

LINGUAS=$(basename $(notdir $(wildcard po/*.po)))

po/$(PACKAGE_NAME).js.pot:
	xgettext --default-domain=$(PACKAGE_NAME) --output=- --language=C --keyword= \
		--add-comments=Translators: \
		--keyword=_:1,1t --keyword=_:1c,2,2t --keyword=C_:1c,2 \
		--keyword=N_ --keyword=NC_:1c,2 \
		--keyword=gettext:1,1t --keyword=gettext:1c,2,2t \
		--keyword=ngettext:1,2,3t --keyword=ngettext:1c,2,3,4t \
		--keyword=gettextCatalog.getString:1,3c --keyword=gettextCatalog.getPlural:2,3,4c \
		--from-code=UTF-8 $$(find src/ -name '*.[jt]s' -o -name '*.[jt]sx') | \
		sed '/^#/ s/, c-format//' > $@

po/$(PACKAGE_NAME).html.pot: $(NODE_MODULES_STAMP) $(COCKPIT_REPO_STAMP)
	pkg/lib/html2po -o $@ $$(find src -name '*.html')

po/$(PACKAGE_NAME).manifest.pot: $(COCKPIT_REPO_STAMP)
	pkg/lib/manifest2po -o $@ src/manifest.json

po/$(PACKAGE_NAME).metainfo.pot: $(APPSTREAMFILE)
	xgettext --default-domain=$(PACKAGE_NAME) --output=$@ $<

po/$(PACKAGE_NAME).pot: po/$(PACKAGE_NAME).html.pot po/$(PACKAGE_NAME).js.pot po/$(PACKAGE_NAME).manifest.pot po/$(PACKAGE_NAME).metainfo.pot
	msgcat --sort-output --output-file=$@ $^

po/LINGUAS:
	echo $(LINGUAS) | tr ' ' '\n' > $@

#
# Build/Install/dist
#

$(SPEC): packaging/$(SPEC).in package-lock.json
	provides=$$(npm ls --omit dev --package-lock-only --depth=Infinity | grep -Eo '[^[:space:]]+@[^[:space:]]+' | sort -u | sed 's/^/Provides: bundled(npm(/; s/\(.*\)@/\1)) = /'); \
	awk -v p="$$provides" '{gsub(/%{VERSION}/, "$(VERSION)"); gsub(/%{NPM_PROVIDES}/, p)}1' $< > $@

packaging/arch/PKGBUILD: packaging/arch/PKGBUILD.in
	sed 's/VERSION/$(VERSION)/; s/SOURCE/$(TARFILE)/' $< > $@

$(DIST_TEST): $(NODE_MODULES_STAMP) $(COCKPIT_REPO_STAMP) $(shell find src/ -type f) package.json build.js scripts/render-config.cjs
	@mkdir -p dist
	@if [ ! -f dist/.brand-name ] || [ "$$(cat dist/.brand-name)" != "$(BRAND_NAME)" ]; then rm -f dist/manifest.json; fi
	NODE_ENV=$(NODE_ENV) ./build.js
	@echo "$(BRAND_NAME)" > dist/.brand-name

watch: $(NODE_MODULES_STAMP) $(COCKPIT_REPO_STAMP)
	NODE_ENV=$(NODE_ENV) ./build.js --watch

clean:
	rm -rf dist/
	rm -f $(SPEC) packaging/arch/PKGBUILD
	rm -f $(TARFILE) $(NODE_CACHE)
	rm -f po/LINGUAS

install: $(DIST_TEST) po/LINGUAS
	mkdir -p $(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)
	cp -r dist/* $(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)
	mkdir -p $(DESTDIR)$(PREFIX)/share/metainfo/
	msgfmt --xml -d po \
		--template $(APPSTREAMFILE) \
		-o $(DESTDIR)$(PREFIX)/share/metainfo/$(APPSTREAMFILE)

# this requires a built source tree and avoids having to install anything system-wide
devel-install: $(DIST_TEST)
	mkdir -p ~/.local/share/cockpit
	ln -s `pwd`/dist ~/.local/share/cockpit/$(PACKAGE_NAME)

# assumes that there was symlink set up using the above devel-install target,
# and removes it
devel-uninstall:
	rm -f ~/.local/share/cockpit/$(PACKAGE_NAME)

print-version:
	@echo "$(VERSION)"

dist: $(TARFILE)
	@ls -1 $(TARFILE)

# when building a distribution tarball, call bundler with a 'production' environment
# we don't ship node_modules for license and compactness reasons; we ship a
# pre-built dist/ (so it's not necessary) and ship package-lock.json (so that
# node_modules/ can be reconstructed if necessary)
$(TARFILE): export NODE_ENV=production
$(TARFILE): $(DIST_TEST) $(SPEC) packaging/arch/PKGBUILD
	if type appstream-util >/dev/null 2>&1; then appstream-util validate-relax --nonet *.metainfo.xml; fi
	tar --xz $(TAR_ARGS) -cf $(TARFILE) --transform 's,^,$(RPM_NAME)/,' \
		--exclude packaging/$(SPEC).in --exclude node_modules \
		$$(git ls-files) $(COCKPIT_REPO_FILES) \
		$(SPEC) packaging/arch/PKGBUILD dist/

$(NODE_CACHE): $(NODE_MODULES_STAMP)
	tar --xz $(TAR_ARGS) -cf $@ node_modules

node-cache: $(NODE_CACHE)

# convenience target for developers
srpm: $(TARFILE) $(NODE_CACHE) $(SPEC)
	rpmbuild -bs \
	  --define "_sourcedir `pwd`" \
	  --define "_srcrpmdir `pwd`" \
	  $(SPEC)

# convenience target for developers
rpm: $(SPEC)
	rm -f $(TARFILE)
	$(MAKE) $(TARFILE) $(NODE_CACHE)
	mkdir -p "`pwd`/output"
	mkdir -p "`pwd`/rpmbuild"
	rpmbuild -bb \
	  --define "_sourcedir `pwd`" \
	  --define "_specdir `pwd`" \
	  --define "_builddir `pwd`/rpmbuild" \
	  --define "_srcrpmdir `pwd`" \
	  --define "_rpmdir `pwd`/output" \
	  --define "_buildrootdir `pwd`/build" \
	  --define "brand_name $(BRAND_NAME)" \
	  $(SPEC)
	find `pwd`/output -name '*.rpm' -printf '%f\n' -exec mv {} . \;
	rm -rf "`pwd`/rpmbuild"
	rm -rf "`pwd`/output" "`pwd`/build"

# build a VM with locally built distro pkgs installed
# disable networking, VM images have mock/pbuilder with the common build dependencies pre-installed
$(VM_IMAGE): export XZ_OPT=-0
$(VM_IMAGE): $(TARFILE) $(NODE_CACHE) bots test/vm.install
	bots/image-customize --no-network --fresh \
		--upload $(NODE_CACHE):/var/tmp/ --build $(TARFILE) \
		--script $(CURDIR)/test/vm.install $(TEST_OS)

# convenience target for the above
vm: $(VM_IMAGE)
	@echo $(VM_IMAGE)

# convenience target to print the filename of the test image
print-vm:
	@echo $(VM_IMAGE)

# convenience target to setup all the bits needed for the integration tests
# without actually running them
prepare-check: $(NODE_MODULES_STAMP) $(VM_IMAGE) test/common

# run the browser integration tests
# this will run all tests/check-* and format them as TAP
check: prepare-check
	test/common/run-tests ${RUN_TESTS_OPTIONS}

codecheck: test/common $(NODE_MODULES_STAMP)
	test/common/static-code

# checkout Cockpit's bots for standard test VM images and API to launch them
bots: $(COCKPIT_REPO_STAMP)
	test/common/make-bots

$(NODE_MODULES_STAMP): package.json package-lock.json
	# unset NODE_ENV, skips devDependencies otherwise
	env -u NODE_ENV npm ci --ignore-scripts
	env -u NODE_ENV npm prune
	@touch $@

# Fedora test VM with WiFi simulation (mac80211_hwsim)
deploy-test-vm:
	hack/deploy-test-vm.sh

clean-test-vm:
	hack/clean-test-vm.sh

reset-test-vm:
	hack/reset-test-vm.sh

help:
	@echo "Development targets:"
	@echo "  all              Build the project (default)"
	@echo "  watch            Build and watch for changes"
	@echo "  clean            Remove build artifacts"
	@echo "  codecheck        Run static analysis (ESLint, Stylelint)"
	@echo ""
	@echo "Install targets:"
	@echo "  install          Install to PREFIX (default /usr/local)"
	@echo "  devel-install    Symlink dist/ into ~/.local/share/cockpit for development"
	@echo "  devel-uninstall  Remove the development symlink"
	@echo ""
	@echo "Packaging targets:"
	@echo "  dist             Create release tarball"
	@echo "  srpm             Build source RPM"
	@echo "  rpm              Build binary RPM"
	@echo "  node-cache       Create node_modules cache tarball"
	@echo "  print-version    Print the current version"
	@echo ""
	@echo "Testing targets:"
	@echo "  check            Run browser integration tests"
	@echo "  prepare-check    Set up test VM and dependencies without running tests"
	@echo "  vm               Build a test VM image"
	@echo "  print-vm         Print the test VM image path"
	@echo ""
	@echo "VM targets:"
	@echo "  deploy-test-vm   Create a Fedora test VM with WiFi simulation"
	@echo "  reset-test-vm    Reset VM to post-deploy state after enrollment testing"
	@echo "  clean-test-vm    Destroy the test VM and clean up"
	@echo ""
	@echo "i18n targets:"
	@echo "  po/$(PACKAGE_NAME).pot  Extract translatable strings"

.PHONY: all clean install devel-install devel-uninstall print-version dist node-cache rpm srpm prepare-check check vm print-vm deploy-test-vm reset-test-vm clean-test-vm help
