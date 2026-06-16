/**
 * Unit tests for hostname validation logic
 *
 * These tests verify that the validateHostname function correctly implements
 * RFC 1123 hostname validation rules as specified in data-model.md
 */

// Import the validation function directly
import { validateHostname } from "../../validation";

describe("validateHostname - RFC 1123 Validation", () => {
    describe("Required field validation", () => {
        test("returns error for empty string", () => {
            expect(validateHostname("")).toBe("Hostname is required");
        });

        test("returns error for whitespace only", () => {
            expect(validateHostname("   ")).toBe("Hostname is required");
            expect(validateHostname("\t")).toBe("Hostname is required");
        });
    });

    describe("Total length validation (max 253 characters)", () => {
        test("accepts hostname with total length at 253 characters (with dots)", () => {
            // Create a valid FQDN with total length exactly 253
            // Using labels: 63 + 1 (dot) + 63 + 1 + 63 + 1 + 61 = 253
            const label63 = "a".repeat(63);
            const label61 = "a".repeat(61);
            const hostname = `${label63}.${label63}.${label63}.${label61}`; // 253 chars
            expect(validateHostname(hostname)).toBeNull();
            expect(hostname.length).toBe(253);
        });

        test("rejects hostname over 253 characters", () => {
            const label63 = "a".repeat(63);
            const label64 = "a".repeat(64);
            const hostname = `${label63}.${label63}.${label63}.${label64}`; // 254 chars
            expect(validateHostname(hostname)).toBe("Hostname must be 253 characters or less");
        });

        test("accepts short hostname", () => {
            expect(validateHostname("server")).toBeNull();
        });
    });

    describe("Label length validation (max 63 characters per label)", () => {
        test("accepts label at 63 characters (max)", () => {
            const label = "a".repeat(63);
            expect(validateHostname(label)).toBeNull();
        });

        test("rejects label over 63 characters", () => {
            const label = "a".repeat(64);
            expect(validateHostname(label)).toBe("Each hostname label must be 63 characters or less");
        });

        test("rejects hostname with empty label (consecutive dots)", () => {
            expect(validateHostname("server..example.com")).toBe("Hostname cannot have empty labels");
        });

        test("rejects hostname ending with dot", () => {
            expect(validateHostname("server.example.com.")).toBe("Hostname cannot have empty labels");
        });

        test("rejects hostname starting with dot", () => {
            expect(validateHostname(".server.example.com")).toBe("Hostname cannot have empty labels");
        });

        test("validates each label in FQDN", () => {
            const label63 = "a".repeat(63);
            expect(validateHostname(`${label63}.example.com`)).toBeNull();

            const label64 = "a".repeat(64);
            expect(validateHostname(`${label64}.example.com`)).toBe(
                "Each hostname label must be 63 characters or less"
            );
        });
    });

    describe("Character restrictions", () => {
        test("accepts alphanumeric characters", () => {
            expect(validateHostname("server123")).toBeNull();
            expect(validateHostname("SERVER123")).toBeNull();
            expect(validateHostname("Server123")).toBeNull();
        });

        test("accepts hyphens in middle of label", () => {
            expect(validateHostname("my-server")).toBeNull();
            expect(validateHostname("web-server-01")).toBeNull();
        });

        test("rejects label starting with hyphen", () => {
            expect(validateHostname("-server")).toBe("Each hostname label must start with an alphanumeric character");
            expect(validateHostname("web.-server.com")).toBe(
                "Each hostname label must start with an alphanumeric character"
            );
        });

        test("rejects label ending with hyphen", () => {
            expect(validateHostname("server-")).toBe("Each hostname label must end with an alphanumeric character");
            expect(validateHostname("server-.example.com")).toBe(
                "Each hostname label must end with an alphanumeric character"
            );
        });

        test("rejects special characters", () => {
            expect(validateHostname("server_01")).toBe("Hostname can only contain letters, numbers, and hyphens");
            expect(validateHostname("server@example.com")).toBe(
                "Hostname can only contain letters, numbers, and hyphens"
            );
            expect(validateHostname("server#1")).toBe("Hostname can only contain letters, numbers, and hyphens");
            expect(validateHostname("server$")).toBe("Hostname can only contain letters, numbers, and hyphens");
        });

        test("rejects spaces", () => {
            expect(validateHostname("my server")).toBe("Hostname can only contain letters, numbers, and hyphens");
        });
    });

    describe("FQDN rules - all-numeric labels", () => {
        test("accepts FQDN with multiple labels", () => {
            expect(validateHostname("server.example.com")).toBeNull();
            expect(validateHostname("web01.prod.example.com")).toBeNull();
        });

        test("accepts single label hostname", () => {
            expect(validateHostname("localhost")).toBeNull();
            expect(validateHostname("server")).toBeNull();
        });

        test("rejects all-numeric labels in FQDN (IPv4-like)", () => {
            // Reject when ALL labels are numeric (looks like IPv4 address)
            expect(validateHostname("192.168.1.1")).toBe("Hostname labels cannot be all numeric in a FQDN");
            expect(validateHostname("1.2.3.4")).toBe("Hostname labels cannot be all numeric in a FQDN");
        });

        test("accepts FQDN with some numeric labels", () => {
            // Accept when not all labels are numeric (valid hostnames)
            expect(validateHostname("server.123.com")).toBeNull();
            expect(validateHostname("1.ntp.org")).toBeNull();
            expect(validateHostname("0.pool.ntp.org")).toBeNull();
        });

        test("accepts all-numeric single label (not FQDN)", () => {
            expect(validateHostname("12345")).toBeNull();
            expect(validateHostname("1")).toBeNull();
        });

        test("accepts numeric characters mixed with letters in FQDN", () => {
            expect(validateHostname("web01.example.com")).toBeNull();
            expect(validateHostname("server1.prod2.example3.com")).toBeNull();
            expect(validateHostname("1server.example.com")).toBeNull();
        });
    });

    describe("Real-world hostname examples", () => {
        test("accepts common valid hostnames", () => {
            expect(validateHostname("localhost")).toBeNull();
            expect(validateHostname("web-server-01")).toBeNull();
            expect(validateHostname("db.example.com")).toBeNull();
            expect(validateHostname("api-gateway.prod.example.com")).toBeNull();
            expect(validateHostname("server01")).toBeNull();
            expect(validateHostname("my-system.example.com")).toBeNull();
        });

        test("rejects common invalid hostnames", () => {
            expect(validateHostname("")).not.toBeNull();
            expect(validateHostname("server_01")).not.toBeNull();
            expect(validateHostname("-server")).not.toBeNull();
            expect(validateHostname("server-")).not.toBeNull();
            expect(validateHostname("192.168.1.1")).not.toBeNull();
            expect(validateHostname("server..example.com")).not.toBeNull();
        });
    });

    describe("Edge cases", () => {
        test("accepts single character hostname", () => {
            expect(validateHostname("a")).toBeNull();
            expect(validateHostname("1")).toBeNull();
            expect(validateHostname("Z")).toBeNull();
        });

        test("accepts hostname with numbers only (single label)", () => {
            expect(validateHostname("123")).toBeNull();
            expect(validateHostname("999")).toBeNull();
        });

        test("accepts mixed case", () => {
            expect(validateHostname("MyServer")).toBeNull();
            expect(validateHostname("WEB-SERVER-01")).toBeNull();
            expect(validateHostname("Web.Server.Com")).toBeNull();
        });

        test("handles label exactly at boundary (63 chars)", () => {
            const label63 = "a".repeat(63);
            expect(validateHostname(`${label63}.example.com`)).toBeNull();
        });

        test("handles label just over boundary (64 chars)", () => {
            const label64 = "a".repeat(64);
            expect(validateHostname(`${label64}.example.com`)).toBe(
                "Each hostname label must be 63 characters or less"
            );
        });

        test("handles total length exactly at boundary (253 chars)", () => {
            // Create a valid FQDN with total length exactly 253
            const label63 = "a".repeat(63);
            const label61 = "a".repeat(61);
            const hostname253 = `${label63}.${label63}.${label63}.${label61}`; // 253 chars total
            expect(validateHostname(hostname253)).toBeNull();
            expect(hostname253.length).toBe(253);
        });

        test("handles total length just over boundary (254 chars)", () => {
            const label63 = "a".repeat(63);
            const label64 = "a".repeat(64);
            const hostname254 = `${label63}.${label63}.${label63}.${label64}`; // 254 chars total
            expect(validateHostname(hostname254)).toBe("Hostname must be 253 characters or less");
        });

        test("accepts hostname with maximum number of labels", () => {
            // Create a hostname with many labels (all within bounds)
            const labels = Array(10).fill("label")
.join(".");
            expect(validateHostname(labels)).toBeNull();
        });
    });

    describe("Comprehensive validation matrix", () => {
        // Create a valid 253-char FQDN for the matrix
        const label63 = "a".repeat(63);
        const label61 = "a".repeat(61);
        const hostname253 = `${label63}.${label63}.${label63}.${label61}`;

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
            hostname253, // 253 chars total (valid FQDN)
            "a".repeat(63) + ".com", // 63 char label + '.com'
        ];

        const invalidHostnames = [
            { hostname: "", error: "Hostname is required" },
            { hostname: "   ", error: "Hostname is required" },
            { hostname: "a".repeat(254), error: "Hostname must be 253 characters or less" },
            { hostname: "a".repeat(64), error: "Each hostname label must be 63 characters or less" },
            { hostname: "-server", error: "Each hostname label must start with an alphanumeric character" },
            { hostname: "server-", error: "Each hostname label must end with an alphanumeric character" },
            { hostname: "server_01", error: "Hostname can only contain letters, numbers, and hyphens" },
            { hostname: "192.168.1.1", error: "Hostname labels cannot be all numeric in a FQDN" },
            { hostname: "server..example.com", error: "Hostname cannot have empty labels" },
            { hostname: ".server.com", error: "Hostname cannot have empty labels" },
            { hostname: "server.com.", error: "Hostname cannot have empty labels" },
        ];

        test.each(validHostnames)("accepts valid hostname: %s", (hostname) => {
            expect(validateHostname(hostname)).toBeNull();
        });

        test.each(invalidHostnames)("rejects invalid hostname: $hostname", ({ hostname, error }) => {
            expect(validateHostname(hostname)).toBe(error);
        });
    });
});
