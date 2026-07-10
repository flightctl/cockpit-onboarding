import cockpit from "cockpit";

import { SCRIPT_READ_FLIGHTCTL_CONFIG } from "../paths";

export interface FlightctlConfigInfo {
    exists: boolean;
    serverUrl: string | null;
    hasCredentials: boolean;
}

export async function detectFlightctlConfig(): Promise<FlightctlConfigInfo> {
    try {
        const output = await cockpit.spawn(["sudo", SCRIPT_READ_FLIGHTCTL_CONFIG], { err: "message" });
        return JSON.parse(output);
    } catch (error) {
        console.warn("Failed to read flightctl config:", error);
        return { exists: false, serverUrl: null, hasCredentials: false };
    }
}
