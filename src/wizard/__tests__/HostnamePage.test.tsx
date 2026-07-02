/**
 * Unit tests for system hostname validation logic
 *
 * These tests verify that validateSystemHostname correctly implements
 * RFC 1123 hostname rules and Linux's static hostname length limit.
 */

import { LINUX_HOSTNAME_MAX_LENGTH, validateSystemHostname } from "../../validation";

describe("validateSystemHostname", () => {
    describe("Required field validation", () => {
        test("returns error for empty string", () => {
            expect(validateSystemHostname("")).toBe("Hostname is required");
        });

        test("returns error for whitespace only", () => {
            expect(validateSystemHostname("   ")).toBe("Hostname is required");
            expect(validateSystemHostname("\t")).toBe("Hostname is required");
        });
    });

    describe("Linux total length validation (max 64 characters)", () => {
        test("accepts hostname at Linux maximum length", () => {
            const hostname = `${"a".repeat(30)}.${"b".repeat(33)}`;
            expect(validateSystemHostname(hostname)).toBeNull();
            expect(hostname.length).toBe(LINUX_HOSTNAME_MAX_LENGTH);
        });

        test("rejects hostname over Linux maximum length", () => {
            const hostname = `${"a".repeat(30)}.${"b".repeat(34)}`;
            expect(validateSystemHostname(hostname)).toBe("Hostname must be 64 characters or less");
        });

        test("rejects long FQDN that would be valid under RFC 1123 alone", () => {
            const hostname = "thishostnameisnotavalidalias.becauseitislongerthanwhatspossibleforalabelvalue";
            expect(validateSystemHostname(hostname)).toBe("Hostname must be 64 characters or less");
        });

        test("accepts short hostname", () => {
            expect(validateSystemHostname("server")).toBeNull();
        });
    });

    describe("Label length validation (max 63 characters per label)", () => {
        test("accepts label at 63 characters (max)", () => {
            const label = "a".repeat(63);
            expect(validateSystemHostname(label)).toBeNull();
        });

        test("rejects label over 63 characters", () => {
            const label = "a".repeat(64);
            expect(validateSystemHostname(label)).toBe("Each hostname label must be 63 characters or less");
        });

        test("rejects hostname with empty label (consecutive dots)", () => {
            expect(validateSystemHostname("server..example.com")).toBe("Hostname cannot have empty labels");
        });

        test("rejects hostname ending with dot", () => {
            expect(validateSystemHostname("server.example.com.")).toBe("Hostname cannot have empty labels");
        });

        test("rejects hostname starting with dot", () => {
            expect(validateSystemHostname(".server.example.com")).toBe("Hostname cannot have empty labels");
        });

        test("validates each label in FQDN", () => {
            expect(validateSystemHostname("server.example.com")).toBeNull();

            const label64 = "a".repeat(64);
            expect(validateSystemHostname(`${label64}.example.com`)).toBe(
                "Each hostname label must be 63 characters or less"
            );
        });

        test("rejects FQDN within label limits but over Linux total length", () => {
            const label63 = "a".repeat(63);
            expect(validateSystemHostname(`${label63}.example.com`)).toBe("Hostname must be 64 characters or less");
        });
    });

    describe("Character restrictions", () => {
        test("accepts alphanumeric characters", () => {
            expect(validateSystemHostname("server123")).toBeNull();
            expect(validateSystemHostname("SERVER123")).toBeNull();
            expect(validateSystemHostname("Server123")).toBeNull();
        });

        test("accepts hyphens in middle of label", () => {
            expect(validateSystemHostname("my-server")).toBeNull();
            expect(validateSystemHostname("web-server-01")).toBeNull();
        });

        test("rejects label starting with hyphen", () => {
            expect(validateSystemHostname("-server")).toBe(
                "Each hostname label must start with an alphanumeric character"
            );
            expect(validateSystemHostname("web.-server.com")).toBe(
                "Each hostname label must start with an alphanumeric character"
            );
        });

        test("rejects label ending with hyphen", () => {
            expect(validateSystemHostname("server-")).toBe(
                "Each hostname label must end with an alphanumeric character"
            );
            expect(validateSystemHostname("server-.example.com")).toBe(
                "Each hostname label must end with an alphanumeric character"
            );
        });

        test("rejects special characters", () => {
            expect(validateSystemHostname("server_01")).toBe(
                "Hostname can only contain letters, numbers, and hyphens"
            );
            expect(validateSystemHostname("server@example.com")).toBe(
                "Hostname can only contain letters, numbers, and hyphens"
            );
            expect(validateSystemHostname("server#1")).toBe(
                "Hostname can only contain letters, numbers, and hyphens"
            );
            expect(validateSystemHostname("server$")).toBe(
                "Hostname can only contain letters, numbers, and hyphens"
            );
        });

        test("rejects spaces", () => {
            expect(validateSystemHostname("my server")).toBe(
                "Hostname can only contain letters, numbers, and hyphens"
            );
        });
    });

    describe("FQDN rules - all-numeric labels", () => {
        test("accepts FQDN with multiple labels", () => {
            expect(validateSystemHostname("server.example.com")).toBeNull();
            expect(validateSystemHostname("web01.prod.example.com")).toBeNull();
        });

        test("accepts single label hostname", () => {
            expect(validateSystemHostname("localhost")).toBeNull();
            expect(validateSystemHostname("server")).toBeNull();
        });

        test("rejects all-numeric labels in FQDN (IPv4-like)", () => {
            expect(validateSystemHostname("192.168.1.1")).toBe("Hostname labels cannot be all numeric in a FQDN");
            expect(validateSystemHostname("1.2.3.4")).toBe("Hostname labels cannot be all numeric in a FQDN");
        });

        test("accepts FQDN with some numeric labels", () => {
            expect(validateSystemHostname("server.123.com")).toBeNull();
            expect(validateSystemHostname("1.ntp.org")).toBeNull();
            expect(validateSystemHostname("0.pool.ntp.org")).toBeNull();
        });

        test("accepts all-numeric single label (not FQDN)", () => {
            expect(validateSystemHostname("12345")).toBeNull();
            expect(validateSystemHostname("1")).toBeNull();
        });

        test("accepts numeric characters mixed with letters in FQDN", () => {
            expect(validateSystemHostname("web01.example.com")).toBeNull();
            expect(validateSystemHostname("server1.prod2.example3.com")).toBeNull();
            expect(validateSystemHostname("1server.example.com")).toBeNull();
        });
    });

    describe("Real-world hostname examples", () => {
        test("accepts common valid hostnames", () => {
            expect(validateSystemHostname("localhost")).toBeNull();
            expect(validateSystemHostname("web-server-01")).toBeNull();
            expect(validateSystemHostname("db.example.com")).toBeNull();
            expect(validateSystemHostname("api-gateway.prod.example.com")).toBeNull();
            expect(validateSystemHostname("server01")).toBeNull();
            expect(validateSystemHostname("my-system.example.com")).toBeNull();
        });

        test("rejects common invalid hostnames", () => {
            expect(validateSystemHostname("")).not.toBeNull();
            expect(validateSystemHostname("server_01")).not.toBeNull();
            expect(validateSystemHostname("-server")).not.toBeNull();
            expect(validateSystemHostname("server-")).not.toBeNull();
            expect(validateSystemHostname("192.168.1.1")).not.toBeNull();
            expect(validateSystemHostname("server..example.com")).not.toBeNull();
        });
    });

    describe("Edge cases", () => {
        test("accepts single character hostname", () => {
            expect(validateSystemHostname("a")).toBeNull();
            expect(validateSystemHostname("1")).toBeNull();
            expect(validateSystemHostname("Z")).toBeNull();
        });

        test("accepts hostname with numbers only (single label)", () => {
            expect(validateSystemHostname("123")).toBeNull();
            expect(validateSystemHostname("999")).toBeNull();
        });

        test("accepts mixed case", () => {
            expect(validateSystemHostname("MyServer")).toBeNull();
            expect(validateSystemHostname("WEB-SERVER-01")).toBeNull();
            expect(validateSystemHostname("Web.Server.Com")).toBeNull();
        });

        test("handles label exactly at boundary (63 chars)", () => {
            const label63 = "a".repeat(63);
            expect(validateSystemHostname(label63)).toBeNull();
        });

        test("handles label just over boundary (64 chars)", () => {
            const label64 = "a".repeat(64);
            expect(validateSystemHostname(label64)).toBe("Each hostname label must be 63 characters or less");
        });

        test("accepts hostname with multiple labels within Linux length limit", () => {
            const parts = Array(10).fill("label");
            const hostname = parts.join(".");
            expect(hostname.length).toBeLessThanOrEqual(LINUX_HOSTNAME_MAX_LENGTH);
            expect(validateSystemHostname(hostname)).toBeNull();
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
            "api-gateway.staging.example.com",
            `${"a".repeat(30)}.${"b".repeat(33)}`,
        ];

        const invalidHostnames = [
            { hostname: "", error: "Hostname is required" },
            { hostname: "   ", error: "Hostname is required" },
            { hostname: `${"a".repeat(30)}.${"b".repeat(34)}`, error: "Hostname must be 64 characters or less" },
            { hostname: "a".repeat(64), error: "Each hostname label must be 63 characters or less" },
            { hostname: "-server", error: "Each hostname label must start with an alphanumeric character" },
            { hostname: "server-", error: "Each hostname label must end with an alphanumeric character" },
            { hostname: "server_01", error: "Hostname can only contain letters, numbers, and hyphens" },
            { hostname: "192.168.1.1", error: "Hostname labels cannot be all numeric in a FQDN" },
            { hostname: "server..example.com", error: "Hostname cannot have empty labels" },
            { hostname: ".server.com", error: "Hostname cannot have empty labels" },
            { hostname: "server.com.", error: "Hostname cannot have empty labels" },
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
