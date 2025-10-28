/**
 * Mock implementation of Cockpit API for unit testing
 *
 * This provides mock implementations of the core Cockpit functions
 * used by the System Onboarding plugin.
 */

// Mock DBUS client
const createMockDbusClient = () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  proxy: jest.fn((_iface: string, _path: string) => ({
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
interface MockProcess extends Promise<void> {
  stream: jest.Mock;
  then: jest.Mock;
  catch: jest.Mock;
}

const createMockProcess = (stdout = '', exitCode = 0): MockProcess => {
  const promise = Promise.resolve() as MockProcess;
  promise.stream = jest.fn((callback) => {
    setTimeout(() => callback(stdout), 0);
  });
  promise.then = jest.fn((resolve, reject) => {
    if (exitCode === 0) {
      resolve?.(stdout);
    } else {
      reject?.(new Error(`Process exited with code ${exitCode}`));
    }
    return promise;
  });
  promise.catch = jest.fn((reject) => {
    if (exitCode !== 0) {
      reject?.(new Error(`Process exited with code ${exitCode}`));
    }
    return promise;
  });
  return promise;
};

// Mock file interface
const createMockFile = (content: string | Record<string, unknown>) => ({
  read: jest.fn(() => Promise.resolve(content)),
  replace: jest.fn(() => Promise.resolve()),
  modify: jest.fn(() => Promise.resolve()),
  watch: jest.fn(() => {
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dbus: jest.fn((_busName: string, _options?: Record<string, unknown>) => createMockDbusClient()),

  // Spawn API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  spawn: jest.fn((_command: string[], _options?: Record<string, unknown>) => createMockProcess('', 0)),

  // File API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  file: jest.fn((_path: string, options?: { syntax?: string }) => {
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
  jump: jest.fn((location: string) => {
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
