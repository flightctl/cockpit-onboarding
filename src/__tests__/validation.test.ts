import { validateURL, validateSystemHostname } from "../validation";

describe("validateURL", () => {
    test("accepts URL with IPv4 address hostname", () => {
        expect(validateURL("https://192.168.122.1:3443")).toBeNull();
    });

    test("accepts URL with DNS hostname", () => {
        expect(validateURL("https://flightctl.example.com:3443")).toBeNull();
    });

    test("accepts URL with hostname prefix before IPv4-like suffix", () => {
        expect(validateURL("https://api.192.124.12.22:333")).toBeNull();
    });

    test("accepts URL with nip.io hostname", () => {
        expect(validateURL("https://api.192.124.12.22.nip.io:333")).toBeNull();
    });

    test("rejects invalid URL format", () => {
        expect(validateURL("not-a-url")).toBe("Invalid URL format");
    });

    test("rejects non-http protocols", () => {
        expect(validateURL("ftp://192.168.122.1:3443")).toBe("URL must use http:// or https:// protocol");
    });
});

describe("validateSystemHostname", () => {
    const INVALID_FORMAT = "Hostname must start and end with an alphanumeric character, and contain only letters, numbers, hyphens, and dots";

    const validCases: [string, string][] = [
        ["simple hostname", "myhost"],
        ["with hyphens", "my-host-01"],
        ["single character", "a"],
        ["numeric only", "123"],
        ["FQDN", "my-host.example.com"],
        ["uppercase", "MyHost"],
        ["64 characters", "a".repeat(64)],
        ["long label over 63 chars", "a".repeat(64)],
        ["FQDN with long label", "a".repeat(60) + ".b"],
        ["empty when not required", ""],
    ];

    test.each(validCases)("accepts %s: %s", (_name, input) => {
        expect(validateSystemHostname(input, false)).toBeNull();
    });

    const invalidCases: [string, string, string][] = [
        ["65 characters", "a".repeat(65), "Hostname must be 64 characters or less"],
        ["empty when required", "", "Hostname is required"],
        ["starting with hyphen", "-myhost", INVALID_FORMAT],
        ["ending with hyphen", "myhost-", INVALID_FORMAT],
        ["starting with dot", ".myhost", INVALID_FORMAT],
        ["ending with dot", "myhost.", INVALID_FORMAT],
        ["consecutive dots", "my..host", INVALID_FORMAT],
        ["underscore", "my_host", INVALID_FORMAT],
        ["spaces", "my host", INVALID_FORMAT],
        ["special characters", "host@name!", INVALID_FORMAT],
    ];

    test.each(invalidCases)("rejects %s: %s", (_name, input, expected) => {
        expect(validateSystemHostname(input)).toBe(expected);
    });
});
