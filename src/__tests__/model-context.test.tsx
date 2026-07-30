/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";

import { ModelProvider, useModelContext } from "../model-context";
import { systemConfigurationService, SystemInfo } from "../system-config";
import { detectFlightctlConfig } from "../services/flightctl-config";
import { SystemOnboardingConfig } from "../types";

jest.mock("../system-config", () => ({
    systemConfigurationService: {
        getSystemInfo: jest.fn(),
        close: jest.fn(),
    },
}));

jest.mock("../services/flightctl-config", () => ({
    detectFlightctlConfig: jest.fn(),
}));

const mockedGetSystemInfo = systemConfigurationService.getSystemInfo as jest.MockedFunction<
    typeof systemConfigurationService.getSystemInfo
>;
const mockedDetectFlightctlConfig = detectFlightctlConfig as jest.MockedFunction<typeof detectFlightctlConfig>;

const defaultSystemInfo: SystemInfo = {
    hostname: "localhost",
    dhcpHostname: "",
    defaultInterface: null,
    ntpServers: [],
};

const mockNetworkManager = {
    ready: true,
    list_interfaces: jest.fn(() => []),
} as unknown as Parameters<typeof ModelProvider>[0]["networkManager"];

const renderWithProvider = (config?: SystemOnboardingConfig | null) => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ModelProvider networkManager={mockNetworkManager} config={config ?? null}>
            {children}
        </ModelProvider>
    );
    return renderHook(() => useModelContext(), { wrapper });
};

describe("ModelProvider defaults", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetSystemInfo.mockResolvedValue(defaultSystemInfo);
        mockedDetectFlightctlConfig.mockResolvedValue({
            exists: false,
            serverUrl: null,
            hasCredentials: false,
        });
    });

    test("applies NTP server defaults when system has no NTP servers", async () => {
        const config: SystemOnboardingConfig = {
            version: "1.0",
            defaults: {
                ntp: {
                    servers: ["ntp1.example.com", "ntp2.example.com"],
                },
            },
        };

        const { result } = renderWithProvider(config);

        await waitFor(() => {
            expect(result.current.isInitialized).toBe(true);
        });

        expect(result.current.model.networkServices.ntp.servers).toEqual([
            "ntp1.example.com",
            "ntp2.example.com",
        ]);
        expect(result.current.model.networkServices.ntp.autoConfig).toBe(false);
    });

    test("skips NTP defaults when system already has servers", async () => {
        mockedGetSystemInfo.mockResolvedValue({
            ...defaultSystemInfo,
            ntpServers: ["pool.ntp.org"],
        });

        const config: SystemOnboardingConfig = {
            version: "1.0",
            defaults: {
                ntp: {
                    servers: ["ntp1.example.com"],
                },
            },
        };

        const { result } = renderWithProvider(config);

        await waitFor(() => {
            expect(result.current.isInitialized).toBe(true);
        });

        expect(result.current.model.networkServices.ntp.servers).toEqual(["pool.ntp.org"]);
    });

    test("applies IPv4 network address defaults", async () => {
        const config: SystemOnboardingConfig = {
            version: "1.0",
            defaults: {
                networkAddress: {
                    ipv4: {
                        method: "static",
                        address: "10.0.0.1",
                        subnetMask: "255.255.255.0",
                        gateway: "10.0.0.254",
                    },
                },
            },
        };

        const { result } = renderWithProvider(config);

        await waitFor(() => {
            expect(result.current.isInitialized).toBe(true);
        });

        expect(result.current.model.networkAddress.ipv4.method).toBe("static");
        expect(result.current.model.networkAddress.ipv4.address).toBe("10.0.0.1");
        expect(result.current.model.networkAddress.ipv4.subnetMask).toBe("255.255.255.0");
        expect(result.current.model.networkAddress.ipv4.gateway).toBe("10.0.0.254");
    });

    test("applies IPv6 network address defaults", async () => {
        const config: SystemOnboardingConfig = {
            version: "1.0",
            defaults: {
                networkAddress: {
                    ipv6: {
                        method: "static",
                        address: "2001:db8::1/64",
                        gateway: "2001:db8::ffff",
                    },
                },
            },
        };

        const { result } = renderWithProvider(config);

        await waitFor(() => {
            expect(result.current.isInitialized).toBe(true);
        });

        expect(result.current.model.networkAddress.ipv6.method).toBe("static");
        expect(result.current.model.networkAddress.ipv6.address).toBe("2001:db8::1/64");
        expect(result.current.model.networkAddress.ipv6.gateway).toBe("2001:db8::ffff");
    });

    test("applies proxy noProxy default", async () => {
        const config: SystemOnboardingConfig = {
            version: "1.0",
            defaults: {
                proxy: {
                    noProxy: "10.0.0.0/8,172.16.0.0/12",
                },
            },
        };

        const { result } = renderWithProvider(config);

        await waitFor(() => {
            expect(result.current.isInitialized).toBe(true);
        });

        expect(result.current.model.networkServices.proxy.noProxy).toBe("10.0.0.0/8,172.16.0.0/12");
    });

    test("partial networkAddress defaults preserve other fields", async () => {
        const config: SystemOnboardingConfig = {
            version: "1.0",
            defaults: {
                networkAddress: {
                    ipv4: {
                        method: "static",
                    },
                },
            },
        };

        const { result } = renderWithProvider(config);

        await waitFor(() => {
            expect(result.current.isInitialized).toBe(true);
        });

        expect(result.current.model.networkAddress.ipv4.method).toBe("static");
        expect(result.current.model.networkAddress.ipv6.method).toBe("auto");
    });
});
