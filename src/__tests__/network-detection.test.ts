/* SPDX-License-Identifier: LGPL-2.1-or-later */
import { renderHook, waitFor } from "@testing-library/react";

import { useIsConnectedViaInterface } from "../hooks/useIsConnectedViaInterface";
import { isConnectedViaInterface } from "../services/network";

jest.mock("../services/network", () => {
    const actual = jest.requireActual("../services/network");
    return {
        ...actual,
        isConnectedViaInterface: jest.fn(),
    };
});

const mockedIsConnectedViaInterface = isConnectedViaInterface as jest.MockedFunction<typeof isConnectedViaInterface>;

describe("useIsConnectedViaInterface", () => {
    beforeEach(() => {
        mockedIsConnectedViaInterface.mockReset();
    });

    test("returns false when no interface is selected", () => {
        const { result } = renderHook(() => useIsConnectedViaInterface(null));
        expect(result.current).toBe(false);
        expect(mockedIsConnectedViaInterface).not.toHaveBeenCalled();
    });

    test("resolves connection state for the selected interface", async () => {
        mockedIsConnectedViaInterface.mockResolvedValue(true);

        const { result } = renderHook(() => useIsConnectedViaInterface("eth0"));

        await waitFor(() => {
            expect(result.current).toBe(true);
        });
        expect(mockedIsConnectedViaInterface).toHaveBeenCalledWith("eth0");
    });

    test("ignores stale results after the selected interface changes", async () => {
        let resolveFirst: (value: boolean) => void = () => {};
        const firstPromise = new Promise<boolean>((resolve) => {
            resolveFirst = resolve;
        });
        mockedIsConnectedViaInterface.mockReturnValueOnce(firstPromise).mockResolvedValueOnce(false);

        const { result, rerender } = renderHook(({ iface }) => useIsConnectedViaInterface(iface), {
            initialProps: { iface: "eth0" },
        });

        rerender({ iface: "eth1" });

        await waitFor(() => {
            expect(result.current).toBe(false);
        });

        resolveFirst(true);

        await waitFor(() => {
            expect(result.current).toBe(false);
        });
    });
});
