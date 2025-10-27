/**
 * Mock implementation of Cockpit API for unit testing
 *
 * This provides mock implementations of the core Cockpit functions
 * used by the System Onboarding plugin.
 */

// Mock DBUS client
const createMockDbusClient = () => ({
  proxy: jest.fn((iface, path) => ({
    wait: jest.fn((callback) => {
      callback?.();
      return Promise.resolve();
    }),
    call: jest.fn(() => Promise.resolve()),
    data: {},
    valid: true
  })),
  close: jest.fn(),
  addEventListener: jest.fn()
});

// Mock spawn process
const createMockProcess = (stdout = '', exitCode = 0) => {
  const promise = Promise.resolve();
  (promise as any).stream = jest.fn((callback) => {
    setTimeout(() => callback(stdout), 0);
  });
  (promise as any).then = jest.fn((resolve, reject) => {
    if (exitCode === 0) {
      resolve?.(stdout);
    } else {
      reject?.(new Error(`Process exited with code ${exitCode}`));
    }
    return promise;
  });
  (promise as any).catch = jest.fn((reject) => {
    if (exitCode !== 0) {
      reject?.(new Error(`Process exited with code ${exitCode}`));
    }
    return promise;
  });
  return promise;
};

// Mock file interface
const createMockFile = (content: any) => ({
  read: jest.fn(() => Promise.resolve(content)),
  replace: jest.fn(() => Promise.resolve()),
  modify: jest.fn(() => Promise.resolve()),
  watch: jest.fn((callback) => {
    // Optionally trigger callback
    return { remove: jest.fn() };
  }),
  close: jest.fn()
});

// Mock transport
const mockTransport = {
  host: 'localhost'
};

// Mock cockpit object
const cockpit = {
  // DBUS API
  dbus: jest.fn((busName, options?) => createMockDbusClient()),

  // Spawn API
  spawn: jest.fn((command, options?) => createMockProcess('', 0)),

  // File API
  file: jest.fn((path, options?) => {
    const content = options?.syntax === 'JSON' ? {} : '';
    return createMockFile(content);
  }),

  // Gettext API
  gettext: jest.fn((message) => message),
  ngettext: jest.fn((singular, plural, n) => n === 1 ? singular : plural),

  // User info
  user: jest.fn(() => ({
    name: 'testuser',
    id: 1000,
    groups: ['testuser'],
    home: '/home/testuser',
    shell: '/bin/bash'
  })),

  // Jump/navigation
  jump: jest.fn((location, host?) => {
    console.log(`Mock jump to: ${location}`);
  }),

  // Transport
  transport: mockTransport,

  // Location API
  location: {
    path: [],
    href: '',
    go: jest.fn()
  },

  // Event API
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),

  // Manifest
  manifests: {},

  // Permissions
  permission: jest.fn(() => ({
    allowed: true
  }))
};

// Export as default for ES6 imports
export default cockpit;

// Also export for CommonJS
module.exports = cockpit;
