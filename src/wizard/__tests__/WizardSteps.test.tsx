import { validateHostnameOrIP } from "../../validation";

describe("connectivity test host validation", () => {
    test("rejects empty string", () => {
        expect(validateHostnameOrIP("")).toBe("Hostname or IP address is required");
    });

    test("rejects whitespace-only", () => {
        expect(validateHostnameOrIP("   ")).toBe("Hostname or IP address is required");
    });

    test("accepts valid hostname", () => {
        expect(validateHostnameOrIP("cockpit-project.org")).toBeNull();
    });

    test("accepts valid IPv4 address", () => {
        expect(validateHostnameOrIP("192.168.1.1")).toBeNull();
    });

    test("accepts valid IPv6 address", () => {
        expect(validateHostnameOrIP("::1")).toBeNull();
    });

    test("rejects hostname with spaces", () => {
        expect(validateHostnameOrIP("not a hostname")).toBe("Invalid hostname or IP address");
    });

    test("rejects hostname with special characters", () => {
        expect(validateHostnameOrIP("host@name!")).toBe("Invalid hostname or IP address");
    });

    test("accepts single-label hostname", () => {
        expect(validateHostnameOrIP("myserver")).toBeNull();
    });

    test("accepts multi-label FQDN", () => {
        expect(validateHostnameOrIP("api.flightctl.example.com")).toBeNull();
    });

    test("not required when required=false", () => {
        expect(validateHostnameOrIP("", false)).toBeNull();
    });
});
