/* SPDX-License-Identifier: LGPL-2.1-or-later */
import { useEffect, useState } from "react";

import { isConnectedViaInterface } from "../services/network";

export function useIsConnectedViaInterface(selectedInterface: string | null | undefined): {
    isConnected: boolean;
    isResolved: boolean;
} {
    const [isConnected, setIsConnected] = useState(false);
    const [isResolved, setIsResolved] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (!selectedInterface) {
            setIsConnected(false);
            setIsResolved(true);
            return;
        }

        setIsResolved(false);
        isConnectedViaInterface(selectedInterface).then((result) => {
            if (!cancelled) {
                setIsConnected(result);
                setIsResolved(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [selectedInterface]);

    return { isConnected, isResolved };
}
