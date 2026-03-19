/**
 * Unit tests for enrollment executor
 */

import { executeEnrollmentScript, validateEnrollmentScript } from '../enrollment-executor';
import type { EnrollmentService } from '../types';
import cockpit from 'cockpit';

// Mock cockpit.spawn to control execution behavior
jest.mock('cockpit');

describe('enrollment-executor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('executeEnrollmentScript', () => {
        const mockService: EnrollmentService = {
            id: 'test-service',
            name: 'Test Service',
            endpoint: {
                url: 'https://test.example.com',
                allowUserOverride: false,
            },
            credentialsSchema: {
                type: 'object',
                properties: {
                    username: { type: 'string' },
                    password: { type: 'string' },
                },
                required: ['username', 'password'],
            },
            scriptPath: '/usr/bin/test-enroll.sh',
        };

        const mockParams = {
            service: mockService,
            credentials: { username: 'testuser', password: 'testpass' },
            endpoint: 'https://test.example.com',
            hostname: 'test-device',
            networkInterface: 'eth0',
        };

        it('should execute script successfully with valid parameters', async () => {
            const mockStdout = 'Enrollment successful\nDEVICE_URL: https://test.example.com/devices/test-device-001\n';

            // Mock spawn to return success
            const mockProcess = {
                stream: jest.fn((callback) => {
                    callback(mockStdout);
                }),
                done: jest.fn((callback) => {
                    callback();
                }),
                fail: jest.fn(),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const result = await executeEnrollmentScript(mockParams);

            expect(result.success).toBe(true);
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toBe(mockStdout);
            expect(result.deviceUrl).toBe('https://test.example.com/devices/test-device-001');

            // Verify environment variables were passed correctly
            expect(cockpit.spawn).toHaveBeenCalledWith(
                ['/usr/bin/test-enroll.sh'],
                expect.objectContaining({
                    environ: expect.arrayContaining([
                        'ENROLLMENT_SERVICE_ID=test-service',
                        'ENROLLMENT_SERVICE_NAME=Test Service',
                        'ENROLLMENT_ENDPOINT=https://test.example.com',
                        expect.stringContaining('ENROLLMENT_CREDENTIALS_JSON='),
                        'ENROLLMENT_HOSTNAME=test-device',
                        'ENROLLMENT_INTERFACE=eth0',
                    ]),
                })
            );
        });

        it('should capture stdout in real-time via progress callback', async () => {
            const mockStdout = 'Line 1\nLine 2\nLine 3\n';
            const progressLines: string[] = [];

            const mockProcess = {
                stream: jest.fn((callback) => {
                    callback(mockStdout);
                }),
                done: jest.fn((callback) => {
                    callback();
                }),
                fail: jest.fn(),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            await executeEnrollmentScript(mockParams, (line) => {
                progressLines.push(line);
            });

            expect(progressLines.length).toBeGreaterThan(0);
        });

        it('should handle exit code 2 (invalid credentials)', async () => {
            const mockStderr = 'Authentication failed';

            const mockProcess = {
                stream: jest.fn(),
                done: jest.fn(),
                fail: jest.fn((callback) => {
                    const error = new Error(mockStderr) as unknown as cockpit.ProcessError;
                    error.exit_status = 2;
                    error.message = mockStderr;
                    callback(error);
                }),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const result = await executeEnrollmentScript(mockParams);

            expect(result.success).toBe(false);
            expect(result.exitCode).toBe(2);
            expect(result.errorMessage).toContain('Invalid credentials');
        });

        it('should handle exit code 3 (service unavailable)', async () => {
            const mockStderr = 'Service unreachable';

            const mockProcess = {
                stream: jest.fn(),
                done: jest.fn(),
                fail: jest.fn((callback) => {
                    const error = new Error(mockStderr) as unknown as cockpit.ProcessError;
                    error.exit_status = 3;
                    error.message = mockStderr;
                    callback(error);
                }),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const result = await executeEnrollmentScript(mockParams);

            expect(result.success).toBe(false);
            expect(result.exitCode).toBe(3);
            expect(result.errorMessage).toContain('Service unavailable');
        });

        it('should handle exit code 4 (network error)', async () => {
            const mockStderr = 'Network timeout';

            const mockProcess = {
                stream: jest.fn(),
                done: jest.fn(),
                fail: jest.fn((callback) => {
                    const error = new Error(mockStderr) as unknown as cockpit.ProcessError;
                    error.exit_status = 4;
                    error.message = mockStderr;
                    callback(error);
                }),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const result = await executeEnrollmentScript(mockParams);

            expect(result.success).toBe(false);
            expect(result.exitCode).toBe(4);
            expect(result.errorMessage).toContain('Network error');
        });

        it('should parse DEVICE_URL from stdout', async () => {
            const mockStdout = `
Connecting to service...
Authenticating...
Enrollment successful
DEVICE_URL: https://management.example.com/devices/device-123
Device enrolled successfully
            `.trim();

            const mockProcess = {
                stream: jest.fn((callback) => {
                    callback(mockStdout);
                }),
                done: jest.fn((callback) => {
                    callback();
                }),
                fail: jest.fn(),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const result = await executeEnrollmentScript(mockParams);

            expect(result.deviceUrl).toBe('https://management.example.com/devices/device-123');
        });

        it('should not set deviceUrl if DEVICE_URL not in stdout', async () => {
            const mockStdout = 'Enrollment successful\nNo device URL provided\n';

            const mockProcess = {
                stream: jest.fn((callback) => {
                    callback(mockStdout);
                }),
                done: jest.fn((callback) => {
                    callback();
                }),
                fail: jest.fn(),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const result = await executeEnrollmentScript(mockParams);

            expect(result.deviceUrl).toBeUndefined();
        });

        it('should reject invalid DEVICE_URL format (not http/https)', async () => {
            const mockStdout = 'DEVICE_URL: ftp://invalid.example.com/device\n';

            const mockProcess = {
                stream: jest.fn((callback) => {
                    callback(mockStdout);
                }),
                done: jest.fn((callback) => {
                    callback();
                }),
                fail: jest.fn(),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const result = await executeEnrollmentScript(mockParams);

            expect(result.deviceUrl).toBeUndefined();
        });

        it('should handle timeout', async () => {
            jest.useFakeTimers();

            const mockProcess = {
                stream: jest.fn(),
                done: jest.fn(),
                fail: jest.fn(),
                close: jest.fn(),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const promise = executeEnrollmentScript(mockParams);

            // Fast-forward time by 5 minutes (timeout period)
            jest.advanceTimersByTime(300000);

            await expect(promise).rejects.toThrow('timed out');

            jest.useRealTimers();
        });
    });

    describe('validateEnrollmentScript', () => {
        it('should return true for valid executable script', async () => {
            const mockProcess = {
                done: jest.fn((callback) => {
                    callback();
                }),
                fail: jest.fn(),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const result = await validateEnrollmentScript('/usr/bin/test-script.sh');

            expect(result).toBe(true);
            expect(cockpit.spawn).toHaveBeenCalledWith(
                ['test', '-x', '/usr/bin/test-script.sh'],
                expect.objectContaining({ err: 'ignore' })
            );
        });

        it('should return false for non-executable script', async () => {
            const mockProcess = {
                done: jest.fn(),
                fail: jest.fn((callback) => {
                    callback(new Error('File not executable'));
                }),
            };

            (cockpit.spawn as jest.Mock).mockReturnValue(mockProcess);

            const result = await validateEnrollmentScript('/usr/bin/invalid-script.sh');

            expect(result).toBe(false);
        });
    });
});
