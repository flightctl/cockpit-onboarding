/**
 * Unit tests for system hostname validation logic
 *
 * These tests verify that validateSystemHostname correctly implements
 * hostnamectl's static hostname rules: up to 64 characters of
 * [a-zA-Z0-9.-], starting and ending with an alphanumeric character,
 * with no consecutive dots.
 */

import { LINUX_HOSTNAME_MAX_LENGTH, validateSystemHostname } from "../../validation";

const FORMAT_ERROR =
    "Hostname must start and end with an alphanumeric character, and contain only letters, numbers, hyphens, and dots";

describe("validateSystemHostname", () => {
    describe("Required field validation", () => {
        test("returns error for empty string", () => {
            expect(validateSystemHostname("")).toBe("Hostname is required");
        });

        test("returns error for whitespace only", () => {
            expect(validateSystemHostname("   ")).toBe("Hostname is required");
            expect(validateSystemHostname("\t")).toBe("Hostname is required");
        });

        test("returns null for empty string when not required", () => {
            expect(validateSystemHostname("", false)).toBeNull();
            expect(validateSystemHostname("   ", false)).toBeNull();
        });
    });

    describe("Linux total length validation (max 64 characters)", () => {
        test("accepts hostname at Linux maximum length", () => {
            const hostname = "a".repeat(LINUX_HOSTNAME_MAX_LENGTH);
            expect(validateSystemHostname(hostname)).toBeNull();
        });

        test("rejects hostname over Linux maximum length", () => {
            const hostname = "a".repeat(LINUX_HOSTNAME_MAX_LENGTH + 1);
            expect(validateSystemHostname(hostname)).toBe("Hostname must be 64 characters or less");
        });

        test("accepts FQDN at exactly 64 characters", () => {
            const hostname = `${"a".repeat(30)}.${"b".repeat(33)}`;
            expect(hostname.length).toBe(LINUX_HOSTNAME_MAX_LENGTH);
            expect(validateSystemHostname(hostname)).toBeNull();
        });

        test("rejects FQDN over 64 characters", () => {
            const hostname = `${"a".repeat(30)}.${"b".repeat(34)}`;
            expect(validateSystemHostname(hostname)).toBe("Hostname must be 64 characters or less");
        });

        test("accepts short hostname", () => {
            expect(validateSystemHostname("server")).toBeNull();
        });
    });

    describe("Format validation", () => {
        test("accepts alphanumeric characters", () => {
            expect(validateSystemHostname("server123")).toBeNull();
            expect(validateSystemHostname("SERVER123")).toBeNull();
            expect(validateSystemHostname("Server123")).toBeNull();
        });

        test("accepts hyphens in middle", () => {
            expect(validateSystemHostname("my-server")).toBeNull();
            expect(validateSystemHostname("web-server-01")).toBeNull();
        });

        test("accepts dots in FQDN", () => {
            expect(validateSystemHostname("server.example.com")).toBeNull();
            expect(validateSystemHostname("web01.prod.example.com")).toBeNull();
        });

        test("rejects hostname starting with hyphen", () => {
            expect(validateSystemHostname("-server")).toBe(FORMAT_ERROR);
        });

        test("rejects hostname ending with hyphen", () => {
            expect(validateSystemHostname("server-")).toBe(FORMAT_ERROR);
        });

        test("rejects hostname starting with dot", () => {
            expect(validateSystemHostname(".server.com")).toBe(FORMAT_ERROR);
        });

        test("rejects hostname ending with dot", () => {
            expect(validateSystemHostname("server.com.")).toBe(FORMAT_ERROR);
        });

        test("rejects consecutive dots", () => {
            expect(validateSystemHostname("server..example.com")).toBe(FORMAT_ERROR);
        });

        test("rejects special characters", () => {
            expect(validateSystemHostname("server_01")).toBe(FORMAT_ERROR);
            expect(validateSystemHostname("server@example.com")).toBe(FORMAT_ERROR);
            expect(validateSystemHostname("server#1")).toBe(FORMAT_ERROR);
            expect(validateSystemHostname("server$")).toBe(FORMAT_ERROR);
        });

        test("rejects spaces", () => {
            expect(validateSystemHostname("my server")).toBe(FORMAT_ERROR);
        });
    });

    describe("Valid hostnames", () => {
        test("accepts common valid hostnames", () => {
            expect(validateSystemHostname("localhost")).toBeNull();
            expect(validateSystemHostname("web-server-01")).toBeNull();
            expect(validateSystemHostname("db.example.com")).toBeNull();
            expect(validateSystemHostname("server01")).toBeNull();
            expect(validateSystemHostname("my-system.example.com")).toBeNull();
        });

        test("accepts single character hostname", () => {
            expect(validateSystemHostname("a")).toBeNull();
            expect(validateSystemHostname("1")).toBeNull();
            expect(validateSystemHostname("Z")).toBeNull();
        });

        test("accepts all-numeric hostnames", () => {
            expect(validateSystemHostname("123")).toBeNull();
            expect(validateSystemHostname("12345")).toBeNull();
            expect(validateSystemHostname("192.168.1.1")).toBeNull();
        });

        test("accepts mixed case", () => {
            expect(validateSystemHostname("MyServer")).toBeNull();
            expect(validateSystemHostname("WEB-SERVER-01")).toBeNull();
            expect(validateSystemHostname("Web.Server.Com")).toBeNull();
        });

        test("accepts NTP-style hostnames", () => {
            expect(validateSystemHostname("0.pool.ntp.org")).toBeNull();
            expect(validateSystemHostname("1.ntp.org")).toBeNull();
        });
    });

    describe("Comprehensive validation matrix", () => {
        const validHostnames = [
            "a",
            "a1",
            "1a",
            "localhost",
            "server",
            "web-server",
            "web-server-01",
            "server.example.com",
            "web01.prod.example.com",
            "192.168.1.1",
            "0.pool.ntp.org",
            `${"a".repeat(30)}.${"b".repeat(33)}`,
        ];

        const invalidHostnames = [
            { hostname: "", error: "Hostname is required" },
            { hostname: "   ", error: "Hostname is required" },
            { hostname: `${"a".repeat(30)}.${"b".repeat(34)}`, error: "Hostname must be 64 characters or less" },
            { hostname: "-server", error: FORMAT_ERROR },
            { hostname: "server-", error: FORMAT_ERROR },
            { hostname: "server_01", error: FORMAT_ERROR },
            { hostname: "server..example.com", error: FORMAT_ERROR },
            { hostname: ".server.com", error: FORMAT_ERROR },
            { hostname: "server.com.", error: FORMAT_ERROR },
            {
                hostname: "thishostnameisnotavalidalias.becauseitislongerthanwhatspossibleforalabelvalue",
                error: "Hostname must be 64 characters or less",
            },
            {
                hostname: `${"a".repeat(63)}.example.com`,
                error: "Hostname must be 64 characters or less",
            },
        ];

        test.each(validHostnames)("accepts valid hostname: %s", (hostname) => {
            expect(validateSystemHostname(hostname)).toBeNull();
        });

        test.each(invalidHostnames)("rejects invalid hostname: $hostname", ({ hostname, error }) => {
            expect(validateSystemHostname(hostname)).toBe(error);
        });
    });
});
