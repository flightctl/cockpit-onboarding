/* SPDX-License-Identifier: LGPL-2.1-or-later */
import { renderHook, waitFor } from "@testing-library/react";

import { useCockpitConnectedInterface } from "../hooks/useCockpitConnectedInterface";
import { getCockpitConnectedInterfaces } from "../services/network";

jest.mock("../services/network", () => {
    const actual = jest.requireActual("../services/network");
    return {
        ...actual,
        getCockpitConnectedInterfaces: jest.fn(),
    };
});

const mockedGetCockpitConnectedInterfaces = getCockpitConnectedInterfaces as jest.MockedFunction<typeof getCockpitConnectedInterfaces>;

describe("useCockpitConnectedInterface", () => {
    beforeEach(() => {
        mockedGetCockpitConnectedInterfaces.mockReset();
    });

    test("returns empty array and resolved when no cockpit interface is found", async () => {
        mockedGetCockpitConnectedInterfaces.mockResolvedValue([]);

        const { result } = renderHook(() => useCockpitConnectedInterface());

        await waitFor(() => {
            expect(result.current.isResolved).toBe(true);
        });
        expect(result.current.cockpitInterfaces).toEqual([]);
    });

    test("returns interface names when cockpit is connected through interfaces", async () => {
        mockedGetCockpitConnectedInterfaces.mockResolvedValue(["eth0"]);

        const { result } = renderHook(() => useCockpitConnectedInterface());

        await waitFor(() => {
            expect(result.current.isResolved).toBe(true);
            expect(result.current.cockpitInterfaces).toEqual(["eth0"]);
        });
    });

    test("returns multiple interfaces when cockpit has multiple connections", async () => {
        mockedGetCockpitConnectedInterfaces.mockResolvedValue(["eth0", "eth1"]);

        const { result } = renderHook(() => useCockpitConnectedInterface());

        await waitFor(() => {
            expect(result.current.isResolved).toBe(true);
            expect(result.current.cockpitInterfaces).toEqual(["eth0", "eth1"]);
        });
    });

    test("starts unresolved and transitions to resolved", async () => {
        let resolve: (value: string[]) => void = () => {};
        const promise = new Promise<string[]>((_resolve) => {
            resolve = _resolve;
        });
        mockedGetCockpitConnectedInterfaces.mockReturnValue(promise);

        const { result } = renderHook(() => useCockpitConnectedInterface());

        expect(result.current.isResolved).toBe(false);
        expect(result.current.cockpitInterfaces).toEqual([]);

        resolve(["eth1"]);

        await waitFor(() => {
            expect(result.current.isResolved).toBe(true);
            expect(result.current.cockpitInterfaces).toEqual(["eth1"]);
        });
    });
});
