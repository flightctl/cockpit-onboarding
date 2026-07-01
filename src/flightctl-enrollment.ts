import type { FlightctlAuthMethod, FlightctlCredentials } from "./types";

export type {
    FlightctlAuthMethod,
    FlightctlCredentials,
    FlightctlTokenCredentials,
    FlightctlPasswordCredentials,
} from "./types";

export const FLIGHTCTL_SERVICE_ID = "flightctl";

export const FLIGHTCTL_SERVICE_NAME = "Flight Control";

export const FLIGHTCTL_DESCRIPTION = "Enroll this device into Flight Control fleet management";

export const FLIGHTCTL_SCRIPT_PATH = "/usr/share/cockpit/system-onboarding/system-onboarding.d/flightctl-enroll.sh";

export interface FlightctlServiceDescriptor {
    id: string;
    name: string;
    scriptPath: string;
}

export const defaultFlightctlServiceDescriptor: FlightctlServiceDescriptor = {
    id: FLIGHTCTL_SERVICE_ID,
    name: FLIGHTCTL_SERVICE_NAME,
    scriptPath: FLIGHTCTL_SCRIPT_PATH,
};

export function isFlightctlAuthMethod(value: unknown): value is FlightctlAuthMethod {
    return value === "token" || value === "password";
}

export function buildFlightctlCredentialsJson(credentials: FlightctlCredentials | undefined): string {
    if (!credentials || credentials.authMethod === "token") {
        const token = credentials?.authMethod === "token" ? credentials.token : "";
        return JSON.stringify({ token });
    }
    return JSON.stringify({
        username: credentials.username,
        password: credentials.password,
    });
}

export function validateFlightctlCredentials(credentials: FlightctlCredentials | undefined): boolean {
    if (!credentials) {
        return false;
    }
    if (credentials.authMethod === "token") {
        return credentials.token.trim().length > 0;
    }
    return credentials.username.trim().length > 0 && credentials.password.trim().length > 0;
}
