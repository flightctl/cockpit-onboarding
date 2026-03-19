/**
 * Enrollment Script Executor
 *
 * Executes enrollment scripts for management service enrollment.
 * Implements the Enrollment Script API Contract v1.0.
 *
 * See: specs/001-system-onboarding/contracts/enrollment-api.md
 */

import cockpit from 'cockpit';
import type { EnrollmentService } from './types';

const SCRIPT_TIMEOUT = 300000; // 5 minutes (300 seconds) in milliseconds

/**
 * Result of an enrollment script execution
 */
export interface EnrollmentExecutionResult {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    deviceUrl?: string;
    errorMessage?: string;
}

/**
 * Parameters required to execute an enrollment script
 */
interface EnrollmentExecutionParams {
    service: EnrollmentService;
    credentials: Record<string, unknown>;
    endpoint: string;
    hostname: string;
    networkInterface: string;
}

/**
 * Build environment variables for enrollment script execution
 *
 * @param params - Enrollment execution parameters
 * @returns Array of environment variable strings in KEY=VALUE format
 */
function buildEnvironmentVariables(params: EnrollmentExecutionParams): string[] {
    const { service, credentials, endpoint, hostname, networkInterface } = params;

    return [
        `ENROLLMENT_SERVICE_ID=${service.id}`,
        `ENROLLMENT_SERVICE_NAME=${service.name}`,
        `ENROLLMENT_ENDPOINT=${endpoint}`,
        `ENROLLMENT_CREDENTIALS_JSON=${JSON.stringify(credentials)}`,
        `ENROLLMENT_HOSTNAME=${hostname}`,
        `ENROLLMENT_INTERFACE=${networkInterface}`,
    ];
}

/**
 * Parse DEVICE_URL from script stdout
 *
 * Looks for a line matching: DEVICE_URL: <url>
 *
 * @param stdout - Standard output from the script
 * @returns The device URL if found, undefined otherwise
 */
function parseDeviceUrl(stdout: string): string | undefined {
    const lines = stdout.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('DEVICE_URL:')) {
            const url = trimmed.substring('DEVICE_URL:'.length).trim();
            // Validate URL format (must be http or https)
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
        }
    }

    return undefined;
}

/**
 * Get user-friendly error message based on exit code
 *
 * @param exitCode - Script exit code
 * @param stderr - Standard error output
 * @returns User-friendly error message
 */
function getErrorMessage(exitCode: number, stderr: string): string {
    switch (exitCode) {
    case 0:
        return 'Success';
    case 1:
        return stderr || 'Enrollment failed: Generic error';
    case 2:
        return 'Enrollment failed: Invalid credentials';
    case 3:
        return 'Enrollment failed: Service unavailable';
    case 4:
        return 'Enrollment failed: Network error';
    default:
        return stderr || `Enrollment failed: Unknown error (exit code: ${exitCode})`;
    }
}

/**
 * Execute an enrollment script
 *
 * This function executes an enrollment script with the provided parameters,
 * captures stdout/stderr in real-time, parses the DEVICE_URL from output,
 * and handles exit codes according to the enrollment API contract.
 *
 * @param params - Enrollment execution parameters
 * @param onProgress - Optional callback for real-time progress updates (stdout lines)
 * @returns Promise resolving to enrollment execution result
 */
export async function executeEnrollmentScript(
    params: EnrollmentExecutionParams,
    onProgress?: (line: string) => void
): Promise<EnrollmentExecutionResult> {
    const { service } = params;

    // Build environment variables
    const environ = buildEnvironmentVariables(params);

    // Accumulated output
    let stdout = '';
    let stderr = '';

    return new Promise((resolve, reject) => {
        // Spawn the enrollment script
        const process = cockpit.spawn([service.scriptPath], {
            environ,
            err: 'message', // Capture stderr separately
            directory: '/home/onboarding', // Working directory per API contract
            superuser: 'try', // Try to use sudo if available
        });

        // Set timeout
        const timeoutId = setTimeout(() => {
            process.close('timeout');
            reject(new Error(`Enrollment script timed out after ${SCRIPT_TIMEOUT / 1000} seconds`));
        }, SCRIPT_TIMEOUT);

        // Capture stdout in real-time
        process.stream((data: string) => {
            stdout += data;

            // Call progress callback for each complete line
            if (onProgress) {
                const lines = data.split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        onProgress(line);
                    }
                }
            }
        });

        // Handle successful completion
        process.done(() => {
            clearTimeout(timeoutId);

            // Parse device URL from stdout
            const deviceUrl = parseDeviceUrl(stdout);

            const result: EnrollmentExecutionResult = {
                success: true,
                exitCode: 0,
                stdout,
                stderr,
            };

            if (deviceUrl !== undefined) {
                result.deviceUrl = deviceUrl;
            }

            resolve(result);
        });

        // Handle failure
        process.fail((error: Error) => {
            clearTimeout(timeoutId);

            // Extract exit code and stderr from ProcessError
            const processError = error as unknown as cockpit.ProcessError;
            const exitCode = processError.exit_status ?? 1;
            stderr = error.message || '';

            // For exit code 0, this shouldn't happen, but handle it just in case
            if (exitCode === 0) {
                const deviceUrl = parseDeviceUrl(stdout);
                const result: EnrollmentExecutionResult = {
                    success: true,
                    exitCode: 0,
                    stdout,
                    stderr,
                };
                if (deviceUrl !== undefined) {
                    result.deviceUrl = deviceUrl;
                }
                resolve(result);
                return;
            }

            // Get user-friendly error message
            const errorMessage = getErrorMessage(exitCode, stderr);

            // Parse device URL even on failure (some scripts might output it before failing)
            const deviceUrl = parseDeviceUrl(stdout);

            const result: EnrollmentExecutionResult = {
                success: false,
                exitCode,
                stdout,
                stderr,
                errorMessage,
            };

            if (deviceUrl !== undefined) {
                result.deviceUrl = deviceUrl;
            }

            resolve(result);
        });
    });
}

/**
 * Validate enrollment script exists and is executable
 *
 * @param scriptPath - Path to enrollment script
 * @returns Promise resolving to true if script is valid, false otherwise
 */
export async function validateEnrollmentScript(scriptPath: string): Promise<boolean> {
    try {
        // Use test command to check if file exists and is executable
        await cockpit.spawn(['test', '-x', scriptPath], { err: 'ignore' });
        return true;
    } catch {
        return false;
    }
}
