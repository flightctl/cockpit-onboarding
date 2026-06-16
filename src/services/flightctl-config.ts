import cockpit from "cockpit";

const FLIGHTCTL_CONFIG_PATH = "/etc/flightctl/config.yaml";

export interface FlightctlConfigInfo {
    exists: boolean;
    serverUrl: string | null;
    hasCredentials: boolean;
}

export async function detectFlightctlConfig(): Promise<FlightctlConfigInfo> {
    try {
        const content = await cockpit.file(FLIGHTCTL_CONFIG_PATH).read();
        if (content === null) {
            return { exists: false, serverUrl: null, hasCredentials: false };
        }

        const serverMatch = content.match(/^\s+server:\s+(\S+)/m);
        const certMatch = content.match(/^\s+client-certificate-data:\s+(\S+)/m);

        return {
            exists: true,
            serverUrl: serverMatch ? serverMatch[1] : null,
            hasCredentials: Boolean(certMatch && certMatch[1]),
        };
    } catch (error) {
        console.warn("Failed to read flightctl config:", error);
        return { exists: false, serverUrl: null, hasCredentials: false };
    }
}
