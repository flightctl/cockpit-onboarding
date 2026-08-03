/* SPDX-License-Identifier: LGPL-2.1-or-later */
import { renderHook, waitFor } from "@testing-library/react";

import { useCockpitConnectedInterface } from "../hooks/useCockpitConnectedInterface";
import { getCockpitConnectedInterface } from "../services/network";

jest.mock("../services/network", () => {
    const actual = jest.requireActual("../services/network");
    return {
        ...actual,
        getCockpitConnectedInterface: jest.fn(),
    };
});

const mockedGetCockpitConnectedInterface = getCockpitConnectedInterface as jest.MockedFunction<typeof getCockpitConnectedInterface>;

describe("useCockpitConnectedInterface", () => {
    beforeEach(() => {
        mockedGetCockpitConnectedInterface.mockReset();
    });

    test("returns null and resolved when no cockpit interface is found", async () => {
        mockedGetCockpitConnectedInterface.mockResolvedValue(null);

        const { result } = renderHook(() => useCockpitConnectedInterface());

        await waitFor(() => {
            expect(result.current.isResolved).toBe(true);
        });
        expect(result.current.cockpitInterface).toBeNull();
    });

    test("returns interface name when cockpit is connected through an interface", async () => {
        mockedGetCockpitConnectedInterface.mockResolvedValue("eth0");

        const { result } = renderHook(() => useCockpitConnectedInterface());

        await waitFor(() => {
            expect(result.current.isResolved).toBe(true);
            expect(result.current.cockpitInterface).toBe("eth0");
        });
    });

    test("starts unresolved and transitions to resolved", async () => {
        let resolve: (value: string | null) => void = () => {};
        const promise = new Promise<string | null>((_resolve) => {
            resolve = _resolve;
        });
        mockedGetCockpitConnectedInterface.mockReturnValue(promise);

        const { result } = renderHook(() => useCockpitConnectedInterface());

        expect(result.current.isResolved).toBe(false);
        expect(result.current.cockpitInterface).toBeNull();

        resolve("eth1");

        await waitFor(() => {
            expect(result.current.isResolved).toBe(true);
            expect(result.current.cockpitInterface).toBe("eth1");
        });
    });
});
