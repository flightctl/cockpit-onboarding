import type { FlightctlAuthMethod, FlightctlCredentials } from "./types";

export type {
    FlightctlAuthMethod,
    FlightctlCredentials,
    FlightctlTokenCredentials,
    FlightctlPasswordCredentials,
} from "./types";

export const FLIGHTCTL_SERVICE_ID = "flightctl";

export const DEFAULT_BRAND_NAME = "Flight Control";

/** @deprecated Use getBrandName(config) for runtime branding */
export const FLIGHTCTL_SERVICE_NAME = DEFAULT_BRAND_NAME;

export function getBrandName(config?: { brandName?: string } | null): string {
    const name = config?.brandName?.trim();
    return name || DEFAULT_BRAND_NAME;
}

export const FLIGHTCTL_SCRIPT_PATH = "/usr/share/cockpit/system-onboarding/system-onboarding.d/flightctl-enroll.sh";

export interface FlightctlServiceDescriptor {
    id: string;
    name: string;
    scriptPath: string;
}

export function getFlightctlServiceDescriptor(config?: { brandName?: string } | null): FlightctlServiceDescriptor {
    return {
        id: FLIGHTCTL_SERVICE_ID,
        name: getBrandName(config),
        scriptPath: FLIGHTCTL_SCRIPT_PATH,
    };
}

export const defaultFlightctlServiceDescriptor = getFlightctlServiceDescriptor();

export function isFlightctlAuthMethod(value: unknown): value is FlightctlAuthMethod {
    return value === "token" || value === "password";
}

export function buildFlightctlCredentialsJson(credentials: FlightctlCredentials | null | undefined): string {
    if (!credentials || credentials.authMethod === "token") {
        const token = credentials?.authMethod === "token" ? credentials.token : "";
        return JSON.stringify({ token });
    }
    return JSON.stringify({
        username: credentials.username,
        password: credentials.password,
    });
}

export function validateFlightctlCredentials(credentials: FlightctlCredentials | null | undefined): boolean {
    if (!credentials) {
        return false;
    }
    if (credentials.authMethod === "token") {
        return credentials.token.trim().length > 0;
    }
    return credentials.username.trim().length > 0 && credentials.password.trim().length > 0;
}
