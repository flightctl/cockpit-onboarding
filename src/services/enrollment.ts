import cockpit from "cockpit";
import { SCRIPT_FINALIZE } from "../paths";
import type { EnrollmentService } from "../types";
import type { Model } from "../model-context";
import type { CancellationSignal } from "./connectivity";
import { disarmWatchdog } from "./watchdog";
import { deleteAttemptedMarker } from "../attempted-marker";
import { createSecureTempFile } from "./spawn-helpers";

const EXIT_CODE_MESSAGES: Record<number, string> = {
    2: "The provided credentials were rejected by the server",
    3: "Cannot reach the enrollment server",
    4: "Network connectivity error — check your network configuration",
};

function getExitCodeMessage(exitCode: number, endpoint?: string): string | null {
    const template = EXIT_CODE_MESSAGES[exitCode];
    if (!template) {
        return null;
    }
    if (exitCode === 3 && endpoint) {
        return `${template} at ${endpoint}`;
    }
    return template;
}

export interface EnrollmentResult {
    success: boolean;
    output: string;
    deviceUrl?: string;
}

export function buildEnrollmentParams(model: Model, service: EnrollmentService): Record<string, unknown> {
    const isUsingExisting = model.enrollment.useExisting?.[service.id] ?? false;
    const endpoint = model.enrollment.endpoints[service.id] || service.endpoint.url;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _variantIndex, ...credentials } = model.enrollment.credentials[service.id] || {};

    return {
        ENROLLMENT_SERVICE_ID: service.id,
        ENROLLMENT_SERVICE_NAME: service.name,
        ENROLLMENT_ENDPOINT: endpoint,
        ENROLLMENT_CREDENTIALS_JSON: JSON.stringify(credentials),
        ENROLLMENT_USE_EXISTING: isUsingExisting,
        ENROLLMENT_HOSTNAME: model.hostname.value,
        ENROLLMENT_INTERFACE: model.networkInterface.selectedInterface || "",
        // TODO: Review backend wiring for proxy.applyForHttps (flightctl-enroll.sh).
        ENROLLMENT_PROXY_ENABLED: model.networkServices.proxy.enabled,
        ENROLLMENT_PROXY_PROTOCOL: model.networkServices.proxy.protocol || "http",
        ENROLLMENT_PROXY_HOSTNAME: model.networkServices.proxy.hostname || "",
        ENROLLMENT_PROXY_PORT: model.networkServices.proxy.port ?? "",
        ENROLLMENT_PROXY_USERNAME: model.networkServices.proxy.username || "",
        ENROLLMENT_PROXY_PASSWORD: model.networkServices.proxy.password || "",
        ENROLLMENT_PROXY_NO_PROXY: model.networkServices.proxy.noProxy || "",
    };
}

export async function executeEnrollmentScript(
    scriptPath: string,
    params: Record<string, unknown>,
    signal?: CancellationSignal,
    onOutput?: (output: string) => void
): Promise<EnrollmentResult> {
    let capturedOutput = "";
    let paramsFile = "";
    const serviceId = String(params.ENROLLMENT_SERVICE_ID || "");
    const serviceName = String(params.ENROLLMENT_SERVICE_NAME || "");
    const endpoint = String(params.ENROLLMENT_ENDPOINT || "");

    try {
        console.log(`Executing enrollment script: ${scriptPath}`);
        console.log("Service:", serviceName, `(${serviceId})`);
        console.log("Endpoint:", endpoint);

        onOutput?.(`Executing enrollment script for ${serviceName}...\n`);

        paramsFile = await createSecureTempFile(JSON.stringify(params), `.enrollment-${serviceId}-`);

        const proc = cockpit.spawn(["sudo", scriptPath, paramsFile], {
            err: "out",
        });
        if (signal) {
            signal.process = proc;
        }

        proc.stream((data) => {
            capturedOutput += data;
            onOutput?.(data);
        });

        await proc;
        if (signal) {
            signal.process = undefined;
        }
        console.log(`Script ${scriptPath} completed successfully`);

        const deviceUrlMatch = capturedOutput.match(/^DEVICE_URL:\s*(.+)$/m);
        if (deviceUrlMatch) {
            const url = deviceUrlMatch[1].trim();
            if (url.startsWith("http://") || url.startsWith("https://")) {
                console.log(`Parsed device URL: ${url}`);
                return {
                    success: true,
                    output: capturedOutput || "Script completed successfully",
                    deviceUrl: url,
                };
            }
        }

        return {
            success: true,
            output: capturedOutput || "Script completed successfully",
        };
    } catch (error) {
        if (signal) {
            signal.process = undefined;
        }
        console.error(`Script ${scriptPath} failed:`, error);

        let errorMsg = "";
        let friendlyMsg = "";

        if (capturedOutput.trim()) {
            errorMsg = capturedOutput.trim();
        }

        if (error instanceof cockpit.ProcessError && error.exit_status !== null) {
            const exitCode = error.exit_status;
            friendlyMsg = getExitCodeMessage(exitCode, endpoint) || "";

            const statusMsg = `Script exited with status ${exitCode}`;
            errorMsg = errorMsg ? `${errorMsg}\n${statusMsg}` : statusMsg;
        }

        const fullMsg = friendlyMsg ? `${friendlyMsg}\n\n${errorMsg}` : errorMsg || "Script failed with unknown error";

        onOutput?.(fullMsg);
        return { success: false, output: fullMsg };
    } finally {
        if (paramsFile) {
            cockpit.spawn(["rm", "-f", paramsFile], { err: "message" }).catch(() => {});
        }
    }
}

export async function finalizeEnrollment(hostname: string): Promise<{ success: boolean; output: string }> {
    const outputs: string[] = [];

    try {
        await cockpit.spawn(["sudo", SCRIPT_FINALIZE, hostname], { err: "message" });
        outputs.push("✓ Onboarding completion marker created");
    } catch (error) {
        console.error("Failed to finalize onboarding:", error);
        outputs.push(`✗ Failed to create completion marker: ${String(error)}`);
        return { success: false, output: outputs.join("\n") };
    }

    await disarmWatchdog();
    await deleteAttemptedMarker();

    return { success: true, output: outputs.join("\n") };
}
