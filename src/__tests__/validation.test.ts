import { validateURL } from "../validation";

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
